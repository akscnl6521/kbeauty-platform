import "server-only";

import { fetchPublicHtmlPage } from "@/lib/admin/import/fetch-page";
import { extractProductFromHtml } from "@/lib/admin/import/extract-product";
import {
  htmlLooksLikeProductPage,
  isPlaceholderBrand,
  looksLikeProductTitle,
  looksLikeProductUrl,
} from "@/lib/pipeline/product-page";
import type { ExtractedCatalogProduct } from "@/lib/pipeline/types";

/**
 * Extract catalog product fields from a public product URL.
 */
export async function extractCatalogProductFromUrl(
  url: string,
  options?: { fallbackBrand?: string | null }
): Promise<
  | { ok: true; product: ExtractedCatalogProduct }
  | { ok: false; code: string; message: string }
> {
  if (!looksLikeProductUrl(url)) {
    return {
      ok: false,
      code: "NOT_PRODUCT_URL",
      message: "제품 URL 패턴이 아님",
    };
  }

  const page = await fetchPublicHtmlPage(url);
  if (!page.ok) {
    return { ok: false, code: page.code, message: page.message };
  }

  try {
    if (!htmlLooksLikeProductPage(page.html) && !/shopdetail|branduid=/i.test(url)) {
      return {
        ok: false,
        code: "NOT_PRODUCT_PAGE",
        message: "제품 페이지 신호 부족 (목록/게시판 제외)",
      };
    }

    const extracted = extractProductFromHtml(page.html, page.finalUrl);
    if (!extracted.productName || !extracted.canonicalUrl) {
      return {
        ok: false,
        code: "PRODUCT_INFO_INCOMPLETE",
        message: "제품명/URL 추출 실패",
      };
    }
    if (!looksLikeProductTitle(extracted.productName)) {
      return {
        ok: false,
        code: "NOT_PRODUCT_TITLE",
        message: "제품명으로 보기 어려운 제목",
      };
    }

    const brandFromPage = extracted.brandName?.trim() || null;
    const brandFallback = options?.fallbackBrand?.trim() || null;
    const brandName =
      (!isPlaceholderBrand(brandFromPage) ? brandFromPage : null) ||
      brandFallback ||
      null;

    if (isPlaceholderBrand(brandName)) {
      return {
        ok: false,
        code: "BRAND_MISSING",
        message: "브랜드명 추출 실패",
      };
    }

    const resolvedBrand = brandName as string;

    const fieldConfidence: Record<string, number> = {
      productName: extracted.productName ? 0.8 : 0,
      brandName: brandFromPage ? 0.6 : brandFallback ? 0.5 : 0.2,
      canonicalUrl: 0.9,
      description: extracted.description ? 0.5 : 0,
      imageUrl: extracted.imageUrl ? 0.6 : 0,
    };

    const confidence =
      Object.values(fieldConfidence).reduce((a, b) => a + b, 0) /
      Object.keys(fieldConfidence).length;

    const product: ExtractedCatalogProduct = {
      productName: extracted.productName,
      brandName: resolvedBrand,
      canonicalUrl: extracted.canonicalUrl,
      category: null,
      imageUrl: extracted.imageUrl,
      description: extracted.description,
      fullIngredientsText: null,
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
