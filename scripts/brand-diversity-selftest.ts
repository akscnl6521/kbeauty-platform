/**
 * 브랜드 상한 검증.
 *
 * 2026-07-30 Production 실측에서 「건성+장벽」 Top 5 가 전부 COSRX 였다.
 * §29 가 `brandCapDefault: 2` 를 규정하는데 핵심 추천 경로에 적용돼 있지 않았다.
 *
 * 실행: npm run test:brand-diversity
 */
import assert from "node:assert/strict";
import { applyBrandDiversity, DEFAULT_BRAND_CAP } from "../src/lib/recommend/applyBrandDiversity";

type P = { id: string; brand: string };
const r = (id: string, brand: string, score: number) => ({
  product: { id, brand } as P,
  score,
  matchedIngredients: ["x"],
  excludedIngredients: [],
});

// ── 한 브랜드가 독차지하지 못한다
{
  const ranked = [
    r("1", "COSRX", 9),
    r("2", "COSRX", 8),
    r("3", "COSRX", 7),
    r("4", "COSRX", 6),
    r("5", "Anua", 5),
    r("6", "Torriden", 4),
    r("7", "SKIN1004", 3),
  ];
  const top = applyBrandDiversity(ranked, 5);
  const brands = top.map((x) => x.product.brand);
  assert.equal(top.length, 5);
  assert.equal(brands.filter((b) => b === "COSRX").length, 2, `COSRX 가 ${brands.filter((b) => b === "COSRX").length}건`);
  assert.deepEqual(brands, ["COSRX", "COSRX", "Anua", "Torriden", "SKIN1004"]);
  // 점수 내림차순이 유지돼야 한다
  for (let i = 1; i < top.length; i += 1) assert.ok(top[i - 1].score >= top[i].score);
}

// ── 상한 때문에 최소 개수를 못 채우면 보충한다
{
  // 브랜드가 하나뿐이면 상한 2 로는 2건인데, 최소 3건은 보여준다.
  const ranked = [r("1", "COSRX", 9), r("2", "COSRX", 8), r("3", "COSRX", 7), r("4", "COSRX", 6)];
  const top = applyBrandDiversity(ranked, 5);
  assert.equal(top.length, 3, `보충 후 ${top.length}건`);
  for (let i = 1; i < top.length; i += 1) assert.ok(top[i - 1].score >= top[i].score);
}

// ── 후보가 최소 개수보다 적으면 있는 만큼만
{
  const top = applyBrandDiversity([r("1", "COSRX", 9), r("2", "COSRX", 8)], 5);
  assert.equal(top.length, 2);
}

// ── 브랜드가 충분히 다양하면 아무것도 잘리지 않는다
{
  const ranked = [
    r("1", "A", 9),
    r("2", "B", 8),
    r("3", "C", 7),
    r("4", "D", 6),
    r("5", "E", 5),
  ];
  const top = applyBrandDiversity(ranked, 5);
  assert.equal(top.length, 5);
  assert.deepEqual(top.map((x) => x.product.id), ["1", "2", "3", "4", "5"]);
}

// ── 브랜드 표기가 대소문자·공백만 다르면 같은 브랜드로 본다
{
  const ranked = [
    r("1", "COSRX", 9),
    r("2", " cosrx ", 8),
    r("3", "CosRX", 7),
    r("4", "Anua", 6),
  ];
  const top = applyBrandDiversity(ranked, 4);
  assert.equal(top.filter((x) => x.product.brand.trim().toLowerCase() === "cosrx").length, 2);
}

// ── 빈 입력
assert.deepEqual(applyBrandDiversity([], 5), []);
assert.equal(DEFAULT_BRAND_CAP, 2);

console.log("brand-diversity self-test: ok");
