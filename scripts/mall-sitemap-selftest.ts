/**
 * 국내몰 사이트맵 URL 선별 회귀 테스트.
 *
 * 표본은 전부 2026-08-05 실측 URL 이다. 목록 페이지를 제품으로 세면 상대 서버에
 * 쓸데없는 요청을 보내고, «이 몰은 가격을 안 준다» 는 잘못된 결론에 도달한다.
 *
 * 실행: npm run test:mall-sitemap
 */
import assert from "node:assert/strict";
import { extractProductUrlsFromSitemap } from "../src/lib/catalog/mallSitemap";

const sm = (...urls: string[]) =>
  `<?xml version="1.0"?><urlset>${urls.map((u) => `<loc>${u}</loc>`).join("")}</urlset>`;

// ── 제품 상세는 뽑는다 (실측) ──
{
  const got = extractProductUrlsFromSitemap(
    sm(
      "http://www.cosrx.co.kr/shop/shopdetail.html?branduid=202&amp;xcode=070",
      "https://abib.com/product/약산성-시트-마스크-어성초-핏/84/",
      "https://roundlab.co.kr/product/1025-독도-토너-대용량-500ml/14/"
    )
  );
  assert.equal(got.length, 3, `제품 3건이어야 한다: ${JSON.stringify(got)}`);
  // XML 엔티티를 풀어야 실제로 요청이 나간다 — `&amp;` 를 그대로 두면 URL 이 깨진다.
  assert.ok(got[0].includes("branduid=202&xcode=070"), "&amp; 를 풀어야 한다");
}

// ── 목록·게시판은 제품이 아니다 (아누아 몰 실측) ──
{
  const got = extractProductUrlsFromSitemap(
    sm(
      "http://anua.kr/product/list.html?cate_no=24",
      "http://anua.kr/product/eventlist.html?cate_no=42",
      "http://anua.kr/board/product/list.html?board_no=4",
      "https://klairs.co.kr/product/search.html?keyword=토너",
      "https://example.co.kr/product/category/12/"
    )
  );
  assert.deepEqual(got, [], `목록 페이지는 제외해야 한다: ${JSON.stringify(got)}`);
}

// ── 목록과 제품이 섞여 있으면 제품만 ──
{
  const got = extractProductUrlsFromSitemap(
    sm(
      "http://anua.kr/product/list.html?cate_no=24",
      "https://roundlab.co.kr/product/1025-독도-로션-200ml/15/",
      "http://anua.kr/board/product/list.html?board_no=4"
    )
  );
  assert.equal(got.length, 1);
  assert.ok(got[0].includes("1025"));
}

// ── 같은 URL 이 여러 번 있어도 한 번만 ──
{
  const u = "https://roundlab.co.kr/product/1025-독도-토너-200ml/16/";
  assert.equal(extractProductUrlsFromSitemap(sm(u, u, u)).length, 1);
}

// ── 빈 입력·제품 없는 사이트맵 ──
assert.deepEqual(extractProductUrlsFromSitemap(""), []);
assert.deepEqual(extractProductUrlsFromSitemap(sm("https://example.com/about")), []);

console.log("mall-sitemap self-test: ok");
