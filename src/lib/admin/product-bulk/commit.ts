import "server-only";

import { createAdminProduct } from "@/lib/admin/createAdminProduct";
import { assertStagingCatalogWriteAllowed } from "@/lib/admin/stagingWriteGate";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { truthyFlag } from "@/lib/admin/product-bulk/cells";
import {
  extractImagesFromZip,
  type BulkZipImage,
} from "@/lib/admin/product-bulk/imageZip";
import { fetchBulkImageFromUrl } from "@/lib/admin/product-bulk/fetchImageUrl";
import { previewProductBulkImport } from "@/lib/admin/product-bulk/preview";
import type { ProductBulkCommitItemResult } from "@/lib/admin/product-bulk/types";

function resolveZipImage(
  fileName: string,
  zipMap: Map<string, BulkZipImage>
): BulkZipImage | null {
  if (!fileName) return null;
  return (
    zipMap.get(fileName) ||
    zipMap.get(fileName.toLowerCase()) ||
    zipMap.get(fileName.split(/[/\\]/).pop() || "") ||
    null
  );
}

/**
 * Commit selected rows one-by-one via createAdminProduct.
 * Partial success: one failure does not stop others.
 */
export async function commitProductBulkImport(input: {
  spreadsheetBytes: Buffer;
  spreadsheetName: string;
  zipBytes?: Buffer | null;
  selectedRowIndexes: number[];
}): Promise<{
  results: ProductBulkCommitItemResult[];
  successCount: number;
  failureCount: number;
}> {
  const gate = assertStagingCatalogWriteAllowed();
  if (!gate.ok) {
    throw new AdminConfigurationError(`${gate.code}: ${gate.message}`);
  }

  if (!input.selectedRowIndexes.length) {
    throw new AdminConfigurationError("등록할 행을 선택해 주세요.");
  }

  // Re-validate via preview (includes parse + duplicate checks)
  const zipMap = input.zipBytes?.length
    ? await extractImagesFromZip(input.zipBytes)
    : new Map<string, BulkZipImage>();

  const preview = await previewProductBulkImport({
    spreadsheetBytes: input.spreadsheetBytes,
    spreadsheetName: input.spreadsheetName,
    zipBytes: input.zipBytes,
  });

  const selectedSet = new Set(input.selectedRowIndexes);

  const results: ProductBulkCommitItemResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const item of preview.items) {
    if (!selectedSet.has(item.rowIndex)) continue;

    if (!item.canRegister) {
      failureCount += 1;
      results.push({
        rowIndex: item.rowIndex,
        ok: false,
        productId: item.duplicateProductId,
        slug: item.slug,
        brand: item.brand,
        productName: item.productName,
        message: item.messages[0] || "등록할 수 없는 행입니다.",
        keyIngredients: item.keyIngredientPreview,
        fullIngredientCount: item.ingredientCount,
        warnings: [],
      });
      continue;
    }

    let image:
      | { bytes: Buffer; mimeType: string; fileName: string }
      | null = null;

    const zipImage = resolveZipImage(item.imageFilename, zipMap);
    if (zipImage) {
      image = {
        bytes: zipImage.bytes,
        mimeType: zipImage.mimeType,
        fileName: zipImage.fileName,
      };
    } else if (item.imageUrl) {
      const fetched = await fetchBulkImageFromUrl(item.imageUrl);
      if (!fetched.ok) {
        failureCount += 1;
        results.push({
          rowIndex: item.rowIndex,
          ok: false,
          productId: null,
          slug: item.slug,
          brand: item.brand,
          productName: item.productName,
          message: fetched.message,
          keyIngredients: item.keyIngredientPreview,
          fullIngredientCount: item.ingredientCount,
          warnings: [],
        });
        continue;
      }
      image = {
        bytes: fetched.bytes,
        mimeType: fetched.mimeType,
        fileName: fetched.fileName,
      };
    }

    try {
      const publish =
        truthyFlag(item.active) && truthyFlag(item.verified || "true");
      const result = await createAdminProduct({
        brand: item.brand,
        name: item.productName,
        nameKo: item.productNameKo || undefined,
        category: item.category,
        description: item.description || undefined,
        usageArea: item.targetAreas || undefined,
        slug: item.slug || undefined,
        fullIngredientsText: item.fullIngredients,
        officialProductUrl: item.sourceUrl || undefined,
        image,
        publishForPreview: publish,
      });

      if (result.duplicateBlocked) {
        failureCount += 1;
        results.push({
          rowIndex: item.rowIndex,
          ok: false,
          productId: result.productId,
          slug: result.slug,
          brand: item.brand,
          productName: item.productName,
          message: `이미 등록된 제품입니다 (ID ${result.productId}).`,
          keyIngredients: result.keyIngredients,
          fullIngredientCount: result.fullIngredientCount,
          warnings: result.warnings,
        });
        continue;
      }

      successCount += 1;
      results.push({
        rowIndex: item.rowIndex,
        ok: true,
        productId: result.productId,
        slug: result.slug,
        brand: item.brand,
        productName: item.productName,
        message: "등록되었습니다.",
        keyIngredients: result.keyIngredients,
        fullIngredientCount: result.fullIngredientCount,
        warnings: result.warnings,
      });
    } catch (error) {
      failureCount += 1;
      const msg =
        error instanceof Error
          ? error.message
          : "제품 등록 중 오류가 발생했습니다.";
      results.push({
        rowIndex: item.rowIndex,
        ok: false,
        productId: null,
        slug: item.slug,
        brand: item.brand,
        productName: item.productName,
        message: msg.includes(":")
          ? "제품 등록에 실패했습니다. 입력값을 확인해 주세요."
          : msg,
        keyIngredients: item.keyIngredientPreview,
        fullIngredientCount: item.ingredientCount,
        warnings: [],
      });
    }
  }

  return { results, successCount, failureCount };
}
