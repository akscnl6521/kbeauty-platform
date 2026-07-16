/**
 * Product page URL / title heuristics (no network).
 */

const NON_PRODUCT_PATH =
  /(collection|collections|category|categories|board|blog|news|about|contact|cart|account|search|login|policy|privacy|terms|review|reviews|qa|qna|event|events|coupon|member|login|join|faq|notice|community)(\/|$|\?)/i;

const PRODUCT_PATH =
  /\/products?\/|\/product\/|\/goods\/|\/item\/|\/shopdetail|branduid=|[?&]product[_-]?id=|\/product_detail|\/goods_view/i;

const NON_PRODUCT_NAME =
  /^(전제품|신상품|특가|라인별|베스트|카테고리|review|q\s*&\s*a|q&a|공지|이벤트)(\s|$|-|\/|·)/i;

export function looksLikeProductUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (NON_PRODUCT_PATH.test(u)) return false;
  if (/\/p\/[a-z0-9_-]{4,}/i.test(u)) return true;
  return PRODUCT_PATH.test(u);
}

export function isPlaceholderBrand(brand: string | null | undefined): boolean {
  const b = (brand ?? "").trim().toLowerCase();
  return !b || b === "unknown" || b === "n/a" || b === "null";
}

export function looksLikeProductTitle(name: string | null | undefined): boolean {
  const n = (name ?? "").trim();
  if (n.length < 3) return false;
  if (NON_PRODUCT_NAME.test(n)) return false;
  if (/^(review|q&a|faq)\b/i.test(n)) return false;
  return true;
}

/** HTML signals that this is a real product page, not a listing. */
export function htmlLooksLikeProductPage(html: string): boolean {
  const h = html.slice(0, 200_000);
  if (/\"@type\"\s*:\s*\"Product\"/i.test(h)) return true;
  if (/itemtype=["']https?:\/\/schema\.org\/Product["']/i.test(h)) return true;
  if (/property=["']product:price:amount["']/i.test(h)) return true;
  if (/name=["']product[_-]?id["']/i.test(h)) return true;
  if (/branduid/i.test(h) && /shopdetail/i.test(h)) return true;
  return false;
}
