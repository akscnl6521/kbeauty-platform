import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertStagingCatalogWriteAllowed } from "@/lib/admin/stagingWriteGate";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { parseIngredientList } from "@/lib/pipeline/ingredient-normalize";
import { extractKeyIngredientsFromFullList } from "@/lib/catalog/keyIngredients";
import {
  parseProductBulkSpreadsheet,
  ProductBulkParseError,
} from "@/lib/admin/product-bulk/parseSpreadsheet";
import {
  extractImagesFromZip,
  type BulkZipImage,
} from "@/lib/admin/product-bulk/imageZip";
import { fetchBulkImageFromUrl } from "@/lib/admin/product-bulk/fetchImageUrl";
import {
  PRODUCT_BULK_MAX_ROWS,
  PRODUCT_BULK_STATUS_LABELS,
  type ProductBulkParsedRow,
  type ProductBulkPreviewItem,
  type ProductBulkPreviewResult,
  type ProductBulkRowStatus,
} from "@/lib/admin/product-bulk/types";

type DupMaps = {
  bySlug: Map<string, number>;
  byBrandName: Map<string, number>;
  bySourceUrl: Map<string, number>;
};

function brandNameKey(brand: string, name: string): string {
  return `${brand.trim().toLowerCase()}||${name.trim().toLowerCase()}`;
}

async function loadDuplicateMaps(
  rows: ProductBulkParsedRow[]
): Promise<DupMaps> {
  const client = createSupabaseAdminClient();
  const bySlug = new Map<string, number>();
  const byBrandName = new Map<string, number>();
  const bySourceUrl = new Map<string, number>();

  const slugs = [...new Set(rows.map((r) => r.slug).filter(Boolean))];
  if (slugs.length > 0) {
    const { data } = await client
      .from("products")
      .select("id, slug, brand, name")
      .in("slug", slugs);
    for (const row of data ?? []) {
      if (row.slug) bySlug.set(String(row.slug), Number(row.id));
    }
  }

  const brands = [...new Set(rows.map((r) => r.brand).filter(Boolean))];
  if (brands.length > 0) {
    const { data } = await client
      .from("products")
      .select("id, brand, name")
      .in("brand", brands)
      .limit(500);
    const wanted = new Set(
      rows
        .filter((r) => r.brand && r.productName)
        .map((r) => brandNameKey(r.brand, r.productName))
    );
    for (const row of data ?? []) {
      const key = brandNameKey(String(row.brand ?? ""), String(row.name ?? ""));
      if (wanted.has(key) && !byBrandName.has(key)) {
        byBrandName.set(key, Number(row.id));
      }
    }
  }

  const urls = [...new Set(rows.map((r) => r.sourceUrl).filter(Boolean))];
  if (urls.length > 0) {
    const { data } = await client
      .from("product_ingredients")
      .select("product_id, source_url")
      .in("source_url", urls)
      .limit(200);
    for (const row of data ?? []) {
      const url = String(row.source_url ?? "");
      if (url && !bySourceUrl.has(url) && row.product_id != null) {
        bySourceUrl.set(url, Number(row.product_id));
      }
    }
  }

  return { bySlug, byBrandName, bySourceUrl };
}

function resolveZipImage(
  row: ProductBulkParsedRow,
  zipMap: Map<string, BulkZipImage>
): BulkZipImage | null {
  if (!row.imageFilename) return null;
  const key = row.imageFilename.trim();
  return (
    zipMap.get(key) ||
    zipMap.get(key.toLowerCase()) ||
    zipMap.get(key.split(/[/\\]/).pop() || "") ||
    null
  );
}

/**
 * Validate spreadsheet (+ optional ZIP / image URLs) before commit.
 */
export async function previewProductBulkImport(input: {
  spreadsheetBytes: Buffer;
  spreadsheetName: string;
  zipBytes?: Buffer | null;
}): Promise<ProductBulkPreviewResult> {
  const gate = assertStagingCatalogWriteAllowed();
  if (!gate.ok) {
    throw new AdminConfigurationError(`${gate.code}: ${gate.message}`);
  }

  let rows;
  try {
    rows = parseProductBulkSpreadsheet(
      input.spreadsheetBytes,
      input.spreadsheetName
    );
  } catch (error) {
    if (error instanceof ProductBulkParseError) {
      throw new AdminConfigurationError(error.message);
    }
    throw error;
  }
  const zipMap = input.zipBytes?.length
    ? await extractImagesFromZip(input.zipBytes)
    : new Map<string, BulkZipImage>();

  const dupMaps = await loadDuplicateMaps(rows);

  const batchSlugs = new Map<string, number>();
  const batchBrandNames = new Map<string, number>();
  const batchSourceUrls = new Map<string, number>();
  const batchImageHashes = new Map<string, number>();

  const items: ProductBulkPreviewItem[] = [];
  let estimatedImageBytes = 0;

  for (const row of rows) {
    const statuses: ProductBulkRowStatus[] = [];
    const messages: string[] = [];
    let imageMatched = false;
    let imageBytes = 0;
    let imageHash: string | null = null;
    let imageError: string | null = null;
    let duplicateProductId: number | null = null;

    if (!row.brand || !row.productName || !row.category || !row.targetAreas) {
      statuses.push("missing_required");
      messages.push("브랜드, 제품명, 카테고리, 사용 부위는 필수입니다.");
    }
    if (!row.description) {
      statuses.push("missing_required");
      messages.push("제품 설명은 필수입니다.");
    }

    const parsed = parseIngredientList(row.fullIngredients);
    if (!row.fullIngredients.trim()) {
      statuses.push("ingredients_empty");
      messages.push("전성분이 비어 있습니다.");
    } else if (parsed.normalized.length === 0) {
      statuses.push("ingredients_parse_error");
      messages.push("전성분을 인식하지 못했습니다.");
    }

    const keyHits = extractKeyIngredientsFromFullList(
      parsed.normalized.map((t) => ({
        token: t.token,
        normalizedName: t.normalizedName,
        order: t.order ?? 0,
      }))
    );
    if (keyHits.length > 0) {
      statuses.push("key_ingredients_ok");
    }

    if (row.slug) {
      const dbId = dupMaps.bySlug.get(row.slug);
      if (dbId != null) {
        statuses.push("slug_duplicate");
        duplicateProductId = dbId;
        messages.push(`이미 등록된 slug입니다 (제품 ID ${dbId}).`);
      } else if (batchSlugs.has(row.slug)) {
        statuses.push("slug_duplicate");
        messages.push("파일 안에 같은 slug가 또 있습니다.");
      } else {
        batchSlugs.set(row.slug, row.rowIndex);
      }
    }

    const bn = brandNameKey(row.brand, row.productName);
    if (row.brand && row.productName) {
      const dbId = dupMaps.byBrandName.get(bn);
      if (dbId != null) {
        statuses.push("brand_name_duplicate");
        duplicateProductId = duplicateProductId ?? dbId;
        messages.push(`같은 브랜드·제품명이 이미 있습니다 (ID ${dbId}).`);
      } else if (batchBrandNames.has(bn)) {
        statuses.push("brand_name_duplicate");
        messages.push("파일 안에 같은 브랜드·제품명이 또 있습니다.");
      } else {
        batchBrandNames.set(bn, row.rowIndex);
      }
    }

    if (row.sourceUrl) {
      const dbId = dupMaps.bySourceUrl.get(row.sourceUrl);
      if (dbId != null) {
        statuses.push("source_url_duplicate");
        duplicateProductId = duplicateProductId ?? dbId;
        messages.push(`같은 출처 URL이 이미 있습니다 (ID ${dbId}).`);
      } else if (batchSourceUrls.has(row.sourceUrl)) {
        statuses.push("source_url_duplicate");
        messages.push("파일 안에 같은 출처 URL이 또 있습니다.");
      } else {
        batchSourceUrls.set(row.sourceUrl, row.rowIndex);
      }
    }

    const zipImage = resolveZipImage(row, zipMap);
    if (zipImage) {
      imageMatched = true;
      imageBytes = zipImage.bytes.length;
      imageHash = zipImage.hash;
      estimatedImageBytes += imageBytes;
    } else if (row.imageUrl) {
      const fetched = await fetchBulkImageFromUrl(row.imageUrl);
      if (fetched.ok) {
        imageMatched = true;
        imageBytes = fetched.bytes.length;
        imageHash = fetched.hash;
        estimatedImageBytes += imageBytes;
      } else {
        statuses.push("image_format_error");
        imageError = fetched.message;
        messages.push(fetched.message);
      }
    } else if (row.imageFilename) {
      statuses.push("image_missing");
      messages.push(
        `ZIP에서 "${row.imageFilename}" 이미지를 찾지 못했습니다. 등록 전 확인하세요.`
      );
    } else {
      statuses.push("image_missing");
      messages.push("이미지 파일명 또는 이미지 주소가 없습니다.");
    }

    if (imageHash) {
      if (batchImageHashes.has(imageHash)) {
        statuses.push("image_hash_duplicate");
        messages.push("파일 안에 같은 이미지가 다른 제품에 연결되어 있습니다.");
      } else {
        batchImageHashes.set(imageHash, row.rowIndex);
      }
    }

    const blocking = new Set<ProductBulkRowStatus>([
      "missing_required",
      "slug_duplicate",
      "brand_name_duplicate",
      "source_url_duplicate",
      "image_hash_duplicate",
      "image_format_error",
      "ingredients_empty",
      "ingredients_parse_error",
    ]);
    const hasBlocking = statuses.some((s) => blocking.has(s));
    if (!hasBlocking && statuses.includes("image_missing")) {
      statuses.push("needs_review");
    }
    if (!hasBlocking && !statuses.includes("ready")) {
      statuses.push("ready");
    }

    const canRegister = !hasBlocking;
    const selectedByDefault =
      canRegister &&
      !statuses.includes("image_missing") &&
      !statuses.includes("needs_review");

    const uniqueStatuses = [...new Set(statuses)];
    items.push({
      ...row,
      statuses: uniqueStatuses,
      statusLabels: uniqueStatuses.map((s) => PRODUCT_BULK_STATUS_LABELS[s]),
      selectedByDefault,
      canRegister,
      ingredientCount: parsed.normalized.length,
      keyIngredientPreview: keyHits.map((h) => h.tokenFromList),
      imageMatched,
      imageBytes,
      imageHash,
      imageError,
      duplicateProductId,
      messages,
    });
  }

  const ready = items.filter((i) => i.canRegister && i.selectedByDefault).length;
  const blocked = items.filter((i) => !i.canRegister).length;
  const warnings = items.filter(
    (i) => i.canRegister && !i.selectedByDefault
  ).length;

  return {
    items,
    summary: {
      total: items.length,
      ready,
      blocked,
      warnings,
      estimatedImageBytes,
      maxRows: PRODUCT_BULK_MAX_ROWS,
    },
  };
}
