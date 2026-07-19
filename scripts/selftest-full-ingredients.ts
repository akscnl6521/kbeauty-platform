import assert from "node:assert/strict";
import { buildFullIngredientDisplay, normalizeFullIngredientList } from "../src/lib/catalog/fullIngredientDisplay";

assert.deepEqual(normalizeFullIngredientList("Water, Glycerin; Panthenol\nGlycerin"), ["Water", "Glycerin", "Panthenol"]);
assert.deepEqual(normalizeFullIngredientList('["정제수", "글리세린", " 판테놀 "]'), ["정제수", "글리세린", "판테놀"]);

const display = buildFullIngredientDisplay({
  ingredients: ["Water", "Glycerin", "Panthenol"],
  sourceType: "official_brand",
  sourceUrl: "https://brand.example/product",
  verifiedAt: "2026-07-19T00:00:00Z",
});
assert.ok(display);
assert.equal(display.count, 3);
assert.equal(display.displayText, "Water, Glycerin, Panthenol");

assert.equal(buildFullIngredientDisplay({
  ingredients: [],
  sourceType: "official_brand",
  sourceUrl: "https://brand.example/product",
  verifiedAt: "2026-07-19T00:00:00Z",
}), null);

assert.equal(buildFullIngredientDisplay({
  ingredients: ["Water"],
  sourceType: "official_brand",
  sourceUrl: "http://brand.example/product",
  verifiedAt: "2026-07-19T00:00:00Z",
}), null);

console.log("full ingredient display self-test: ok");
