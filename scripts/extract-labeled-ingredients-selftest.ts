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

console.log("extract-labeled-ingredients-selftest: ok");
