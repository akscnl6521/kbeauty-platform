import "server-only";

import { fetchPublicHtmlPage } from "@/lib/admin/import/fetch-page";
import { extractProductFromHtml } from "@/lib/admin/import/extract-product";
import type { ExtractedCatalogProduct } from "@/lib/pipeline/types";

/**
 * Extract catalog product fields from a public product URL.
 */
export async function extractCatalogProductFromUrl(
  url: string
): Promise<
  | { ok: true; product: ExtractedCatalogProduct }
  | { ok: false; code: string; message: string }
> {
  const page = await fetchPublicHtmlPage(url);
  if (!page.ok) {
    return { ok: false, code: page.code, message: page.message };
  }

  try {
    const extracted = extractProductFromHtml(page.html, page.finalUrl);
    if (!extracted.productName || !extracted.canonicalUrl) {
      return {
        ok: false,
        code: "PRODUCT_INFO_INCOMPLETE",
        message: "제품명/URL 추출 실패",
      };
    }

    const fieldConfidence: Record<string, number> = {
      productName: extracted.productName ? 0.8 : 0,
      brandName: extracted.brandName ? 0.6 : 0.2,
      canonicalUrl: 0.9,
      description: extracted.description ? 0.5 : 0,
      imageUrl: extracted.imageUrl ? 0.6 : 0,
    };

    const confidence =
      Object.values(fieldConfidence).reduce((a, b) => a + b, 0) /
      Object.keys(fieldConfidence).length;

    // ingredient text: look for common labels in description only (no invented lists)
    const fullIngredientsText = null;

    const product: ExtractedCatalogProduct = {
      productName: extracted.productName,
      brandName: extracted.brandName ?? "Unknown",
      canonicalUrl: extracted.canonicalUrl,
      category: null,
      imageUrl: extracted.imageUrl,
      description: extracted.description,
      fullIngredientsText,
      keyIngredients: [],
      sizeLabel: null,
      priceReference: extracted.price,
      currency: extracted.currency,
      availabilityReference: extracted.availability,
      country: extracted.detectedCountry,
      sourceType: extracted.sourceType,
      confidence,
      extractionMethod: "jsonld_og_meta_title",
      fieldConfidence,
    };

    return { ok: true, product };
  } catch {
    return {
      ok: false,
      code: "PARSE_FAILED",
      message: "제품 페이지 파싱 실패",
    };
  }
}
