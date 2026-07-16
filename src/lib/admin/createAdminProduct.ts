import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { assertStagingCatalogWriteAllowed } from "@/lib/admin/stagingWriteGate";
import {
  attachIngredientMatches,
  parseIngredientList,
  type IngredientLookupMaps,
  type NormalizedIngredientToken,
} from "@/lib/pipeline/ingredient-normalize";
import { extractKeyIngredientsFromFullList } from "@/lib/catalog/keyIngredients";
import {
  PRODUCT_IMAGE_BUCKET,
  PRODUCT_IMAGE_SIGNED_TTL_SEC,
  storageObjectCanonicalRef,
} from "@/lib/admin/productImageStorage";
import {
  normalizeManualSlug,
  slugifyBrandAndName,
} from "@/lib/admin/productSlug";

export { PRODUCT_IMAGE_BUCKET } from "@/lib/admin/productImageStorage";

export type CreateAdminProductInput = {
  brand: string;
  name: string;
  nameKo?: string;
  category: string;
  description?: string;
  usageArea?: string;
  /** Optional override; otherwise derived from brand + name. */
  slug?: string;
  fullIngredientsText: string;
  officialProductUrl?: string;
  image?: {
    bytes: Buffer;
    mimeType: string;
    fileName: string;
  } | null;
  /** When true, set active+verified so the product can appear on user surfaces. */
  publishForPreview?: boolean;
};

export type CreateAdminProductResult = {
  productId: number;
  slug: string;
  imageUrl: string | null;
  mediaId: string | null;
  fullIngredientCount: number;
  keyIngredientCount: number;
  keyIngredients: string[];
  createdIngredientIds: number[];
  linkedIngredientCount: number;
  duplicateBlocked: boolean;
  warnings: string[];
};

function resolveSlug(brand: string, name: string, manual?: string): string {
  const fromManual = manual ? normalizeManualSlug(manual) : "";
  if (fromManual) return fromManual;
  return slugifyBrandAndName(brand, name) || `product-${Date.now()}`;
}

function ingredientSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

async function loadIngredientMaps(
  client: SupabaseClient
): Promise<IngredientLookupMaps> {
  const bySlug = new Map<string, number>();
  const byNameEn = new Map<string, number>();
  const byNameKo = new Map<string, number>();
  const byAlias = new Map<string, number>();

  const { data: ingredients, error } = await client
    .from("ingredients")
    .select("id, slug, name_en, name_ko");
  if (error) {
    throw new AdminConfigurationError(
      `Unable to load ingredients dictionary. (${error.code || "no_code"}: ${error.message})`
    );
  }
  for (const row of ingredients ?? []) {
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    if (row.slug) bySlug.set(String(row.slug).toLowerCase().replace(/-/g, " "), id);
    if (row.name_en) {
      byNameEn.set(
        String(row.name_en)
          .toLowerCase()
          .replace(/[_\-]+/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
        id
      );
    }
    if (row.name_ko) {
      byNameKo.set(
        String(row.name_ko)
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim(),
        id
      );
    }
  }

  const { data: aliases } = await client
    .from("ingredient_aliases")
    .select("ingredient_id, normalized_alias, active")
    .eq("active", true)
    .limit(5000);
  for (const row of aliases ?? []) {
    const id = Number(row.ingredient_id);
    const key = String(row.normalized_alias ?? "")
      .toLowerCase()
      .trim();
    if (Number.isFinite(id) && key) byAlias.set(key, id);
  }

  return { bySlug, byNameEn, byNameKo, byAlias };
}

async function ensureProductImageBucket(client: SupabaseClient): Promise<void> {
  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError) {
    throw new AdminConfigurationError(
      `Unable to list storage buckets: ${listError.message}`
    );
  }
  const existing = (buckets ?? []).find((b) => b.id === PRODUCT_IMAGE_BUCKET);
  if (existing) {
    if (existing.public) {
      await client.storage.updateBucket(PRODUCT_IMAGE_BUCKET, {
        public: false,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      });
    }
    return;
  }
  const { error } = await client.storage.createBucket(PRODUCT_IMAGE_BUCKET, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new AdminConfigurationError(
      `Unable to create storage bucket: ${error.message}`
    );
  }
}

async function findDuplicateProduct(
  client: SupabaseClient,
  brand: string,
  name: string,
  slug: string
): Promise<number | null> {
  const { data: bySlug } = await client
    .from("products")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (bySlug?.id != null) return Number(bySlug.id);

  const { data: byName } = await client
    .from("products")
    .select("id")
    .ilike("brand", brand)
    .ilike("name", name)
    .limit(1);
  if (byName?.[0]?.id != null) return Number(byName[0].id);
  return null;
}

async function ensureIngredientId(
  client: SupabaseClient,
  token: NormalizedIngredientToken,
  created: number[]
): Promise<number> {
  if (token.matchedIngredientId != null) return token.matchedIngredientId;

  const nameEn = token.token.slice(0, 120);
  const slug =
    ingredientSlugFromName(token.normalizedName) || `unknown-${token.order}`;

  const { data: existing } = await client
    .from("ingredients")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing?.id != null) return Number(existing.id);

  const { data: inserted, error } = await client
    .from("ingredients")
    .insert({
      slug,
      name_en: nameEn,
      name_ko: /[가-힣]/.test(token.token) ? token.token : null,
      caution: "본 정보는 참고용이며 의료 진단이나 치료를 대체할 수 없습니다.",
      mechanism: null,
      effects: [],
    })
    .select("id")
    .single();

  if (error || inserted?.id == null) {
    const { data: again } = await client
      .from("ingredients")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (again?.id != null) return Number(again.id);
    throw new AdminConfigurationError(
      `Unable to create review ingredient for "${nameEn}".`
    );
  }
  const id = Number(inserted.id);
  created.push(id);
  return id;
}

export async function createAdminProduct(
  input: CreateAdminProductInput
): Promise<CreateAdminProductResult> {
  const gate = assertStagingCatalogWriteAllowed();
  if (!gate.ok) {
    throw new AdminConfigurationError(`${gate.code}: ${gate.message}`);
  }

  const brand = input.brand.trim();
  const name = input.name.trim();
  const category = input.category.trim();
  const fullText = input.fullIngredientsText.trim();
  if (!brand || !name || !category || !fullText) {
    throw new AdminConfigurationError(
      "브랜드, 제품명, 카테고리, 전성분은 필수입니다."
    );
  }

  const client = createSupabaseAdminClient();
  const warnings: string[] = [];
  const slug = resolveSlug(brand, name, input.slug);

  const dupId = await findDuplicateProduct(client, brand, name, slug);
  if (dupId != null) {
    return {
      productId: dupId,
      slug,
      imageUrl: null,
      mediaId: null,
      fullIngredientCount: 0,
      keyIngredientCount: 0,
      keyIngredients: [],
      createdIngredientIds: [],
      linkedIngredientCount: 0,
      duplicateBlocked: true,
      warnings: [`duplicate_product_id:${dupId}`],
    };
  }

  const parsed = parseIngredientList(fullText);
  if (parsed.normalized.length === 0) {
    throw new AdminConfigurationError(
      "전성분을 인식하지 못했습니다. 쉼표 또는 줄바꿈으로 성분을 구분해 주세요."
    );
  }

  const maps = await loadIngredientMaps(client);
  const matched = attachIngredientMatches(parsed, maps);
  const keyHits = extractKeyIngredientsFromFullList(
    matched.normalized.map((t) => ({
      token: t.token,
      normalizedName: t.normalizedName,
      order: t.order ?? 0,
    }))
  );
  const keyOrderSet = new Set(keyHits.map((h) => h.orderInList));
  const keyNames = keyHits.map((h) => h.tokenFromList);

  const publish = input.publishForPreview !== false;
  const nowIso = new Date().toISOString();

  const { data: product, error: productError } = await client
    .from("products")
    .insert({
      brand,
      name,
      name_ko: input.nameKo?.trim() || null,
      category,
      slug,
      usage_area: input.usageArea?.trim() || null,
      recommendation_reason: input.description?.trim() || null,
      recommendation_reason_ko: input.description?.trim() || null,
      full_ingredients: matched.normalized.map((t) => t.token),
      key_ingredients: keyNames,
      active: publish,
      verified_at: publish ? nowIso : null,
      data_confidence: "admin_manual_entry",
    })
    .select("id, slug")
    .single();

  if (productError || product?.id == null) {
    throw new AdminConfigurationError(
      productError?.message || "Unable to insert product."
    );
  }
  const productId = Number(product.id);

  const createdIngredientIds: number[] = [];
  let linked = 0;
  for (const token of matched.normalized) {
    const order = token.order ?? 0;
    const ingredientId = await ensureIngredientId(
      client,
      {
        token: token.token,
        normalizedName: token.normalizedName,
        confidence: token.confidence,
        matchedIngredientId: token.matchedIngredientId,
        needsReview: token.needsReview,
        matchKind: token.matchKind ?? "unmatched",
        order,
      },
      createdIngredientIds
    );
    const isKey = keyOrderSet.has(order);
    const { error: linkError } = await client.from("product_ingredients").insert({
      product_id: productId,
      ingredient_id: ingredientId,
      ingredient_order: order,
      is_key_ingredient: isKey,
      source_type: "admin_entry",
      source_url: input.officialProductUrl?.trim() || null,
      verification_status:
        token.needsReview || token.matchedIngredientId == null
          ? "needs_review"
          : "pending",
      source_verified: false,
      confidence: token.confidence,
      verified_at: null,
    });
    if (linkError) {
      warnings.push(`link_failed:${token.token}:${linkError.message}`);
      continue;
    }
    linked += 1;
  }

  let imageUrl: string | null = null;
  let mediaId: string | null = null;

  if (input.image?.bytes?.length) {
    const mime = input.image.mimeType || "image/jpeg";
    if (!mime.startsWith("image/")) {
      warnings.push("image_mime_rejected");
    } else if (input.image.bytes.length > 5 * 1024 * 1024) {
      warnings.push("image_too_large");
    } else {
      await ensureProductImageBucket(client);
      const ext =
        mime === "image/png"
          ? "png"
          : mime === "image/webp"
            ? "webp"
            : mime === "image/gif"
              ? "gif"
              : "jpg";
      const hash = createHash("sha256")
        .update(input.image.bytes)
        .digest("hex")
        .slice(0, 16);
      const path = `products/${productId}/primary-${hash}.${ext}`;
      const { error: uploadError } = await client.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .upload(path, input.image.bytes, {
          contentType: mime,
          upsert: false,
        });
      if (uploadError) {
        warnings.push(`image_upload_failed:${uploadError.message}`);
      } else {
        const SIGNED_TTL_SEC = PRODUCT_IMAGE_SIGNED_TTL_SEC;
        const { data: signed, error: signError } = await client.storage
          .from(PRODUCT_IMAGE_BUCKET)
          .createSignedUrl(path, SIGNED_TTL_SEC);
        if (signError || !signed?.signedUrl) {
          warnings.push(
            `image_sign_failed:${signError?.message || "missing signed url"}`
          );
        } else {
          imageUrl = signed.signedUrl;
        }
        const contentHash = createHash("sha256")
          .update(input.image.bytes)
          .digest("hex");
        const canonicalRef = storageObjectCanonicalRef(path);
        let sourceDomain = `${PRODUCT_IMAGE_BUCKET}.storage`;
        try {
          if (imageUrl) sourceDomain = new URL(imageUrl).hostname;
        } catch {
          /* keep default */
        }

        const { data: existingMedia } = await client
          .from("catalog_product_media")
          .select("id")
          .eq("product_id", productId)
          .eq("is_primary", true)
          .limit(1);

        if ((existingMedia ?? []).length > 0) {
          warnings.push("primary_media_already_exists_skipped_insert");
          mediaId = String(existingMedia![0]!.id);
        } else {
          const { data: media, error: mediaError } = await client
            .from("catalog_product_media")
            .insert({
              product_id: productId,
              media_type: "product_front",
              image_url: imageUrl || canonicalRef,
              canonical_image_url: canonicalRef,
              source_page_url:
                input.officialProductUrl?.trim() || canonicalRef,
              source_domain: sourceDomain,
              source_type: "official_brand",
              source_tier: 1,
              is_official_source: true,
              usage_rights_status: "licensed_copy_allowed",
              mime_type: mime,
              content_length: input.image.bytes.length,
              content_hash: contentHash,
              is_accessible: Boolean(imageUrl),
              is_primary: true,
              display_order: 0,
              validation_status: imageUrl ? "verified" : "needs_review",
              validation_errors: [],
              verified_at: imageUrl ? nowIso : null,
              is_fixture: false,
            })
            .select("id")
            .single();
          if (mediaError) {
            warnings.push(`media_row_failed:${mediaError.message}`);
          } else {
            mediaId = media?.id != null ? String(media.id) : null;
          }
        }
      }
    }
  }

  return {
    productId,
    slug: String(product.slug ?? slug),
    imageUrl,
    mediaId,
    fullIngredientCount: matched.normalized.length,
    keyIngredientCount: keyNames.length,
    keyIngredients: keyNames,
    createdIngredientIds,
    linkedIngredientCount: linked,
    duplicateBlocked: false,
    warnings,
  };
}
