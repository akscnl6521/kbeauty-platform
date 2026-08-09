import assert from "node:assert/strict";
import {
  extractLabeledIngredientsRaw,
  extractOpenGraph,
} from "@/lib/catalog/enrichment/extractLabeledIngredients";

const korean = extractLabeledIngredientsRaw(`
  <section>
    <h2>전성분 정보</h2>
    <p>정제수, 글리세린, 부틸렌글라이콜, 나이아신아마이드, 판테놀, 카보머, 알지닌, 다이소듐이디티에이</p>
    <h2>사용방법</h2>
    <p>적당량을 바릅니다.</p>
  </section>
`);
assert.ok(korean);
assert.match(korean.raw, /나이아신아마이드/);
assert.doesNotMatch(korean.raw, /적당량/);

const english = extractLabeledIngredientsRaw(`
  <div><strong>Full Ingredients</strong></div>
  <div>Water (Aqua), Glycerin, Butylene Glycol, Niacinamide, Panthenol, Carbomer, Arginine, Disodium EDTA</div>
  <div>Directions: Apply after cleansing.</div>
`);
assert.ok(english);
assert.match(english.raw, /Niacinamide/);
assert.doesNotMatch(english.raw, /Apply after cleansing/);

const meta = extractOpenGraph(`
  <meta content="Official &amp; Verified Product" property="og:title">
  <meta name='og:image' content='https://cdn.example.com/product.jpg'>
  <meta property="og:description" content="Barrier care &amp; hydration">
`);
assert.equal(meta.title, "Official & Verified Product");
assert.equal(meta.image, "https://cdn.example.com/product.jpg");
assert.equal(meta.description, "Barrier care & hydration");

assert.equal(
  extractLabeledIngredientsRaw("<p>Key ingredients: centella and panthenol</p>"),
  null
);


  // ── 전성분이 늘 물로 시작하지는 않는다 (2026-08-09 COSRX 실측) ──
  //
  // 예전에는 «물·글리세린 계열» 이 있어야만 목록으로 봤다. 달팽이 크림은
  // `달팽이점액여과물` 로 시작해서 통째로 «전성분 없음» 으로 버려지고 있었다.
  {
    const html =
      "<div>전성분 달팽이점액여과물, 베타인, 카프릴릭/카프릭트라이글리세라이드, " +
      "세테아릴올리베이트, 솔비탄올리베이트, 세테아릴알코올, 카보머, 알지닌, " +
      "다이메티콘, 페녹시에탄올, 판테놀, 잔탄검, 아데노신</div>";
    const got = extractLabeledIngredientsRaw(html);
    assert.ok(got, "물로 시작하지 않는 진짜 전성분을 못 뽑았다");
    assert.ok(String(got?.raw).startsWith("달팽이점액여과물"));
  }

  // **마케팅 문단은 여전히 안 뽑혀야 한다** — 넓힌 게 아니라 정확해진 것이다.
  for (const junk of [
    "<div>전성분 Body From Skin to Hair Care, works, looks, bottle, results, improvement, radiance</div>",
    "<div>전성분 배송 안내, 교환 반품, 리뷰 쓰기, 문의하기</div>",
  ]) {
    assert.equal(extractLabeledIngredientsRaw(junk), null, `쓰레기인데 뽑혔다: ${junk.slice(0, 40)}`);
  }

  console.log("extract-labeled-ingredients-selftest: ok");
