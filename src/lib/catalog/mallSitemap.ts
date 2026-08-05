/**
 * 국내몰 `sitemap.xml` 에서 **제품 상세 페이지 URL** 만 골라낸다.
 *
 * 2026-08-05 — 처음 필터는 `/product/` 만 보고 걸렀는데, Cafe24 몰의
 * `product/list.html?cate_no=24`(카테고리 목록) · `board/product/list.html`(후기 게시판)
 * 까지 제품으로 잡았다. 아누아 몰에서 «제품 34개» 로 보였던 것이 전부 목록 페이지였고,
 * 그래서 가격 정보가 0건이었다.
 *
 * 목록 페이지를 제품으로 세면 두 가지가 나빠진다:
 *   · 쓸데없는 요청으로 상대 서버에 부담을 준다 (차단당하면 다음 수집이 아예 안 된다)
 *   · «이 몰은 가격을 안 준다» 는 잘못된 결론에 도달한다
 */

/** 제품 상세로 보이는 경로 */
const PRODUCT_PATH = /shopdetail\.html|\/product\/[^/]+\/\d+\/?|\/goods\/|\/item\//i;

/**
 * 제품 상세가 **아닌** 것. 목록·게시판·이벤트·검색 페이지는 제품이 아니다.
 * `PRODUCT_PATH` 보다 먼저 본다 — `board/product/list.html` 처럼 둘 다 걸리는 것이 있다.
 */
const NOT_PRODUCT = /\/(list|search|category|board|event|eventlist|review|notice|login|cart|order)\b|list\.html|\.css|\.js(\?|$)/i;

/** 사이트맵 XML 에서 제품 상세 URL 만 뽑는다. XML 엔티티도 푼다. */
export function extractProductUrlsFromSitemap(xml: string): string[] {
  const decoded = String(xml ?? "");
  const urls = [...decoded.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim()
  );
  return [...new Set(urls.filter((u) => !NOT_PRODUCT.test(u) && PRODUCT_PATH.test(u)))];
}
