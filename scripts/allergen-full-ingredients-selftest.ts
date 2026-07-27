/**
 * 알레르기·회피 필터가 전성분까지 보도록 넓힌 뒤의 회귀 검증.
 *
 * 지켜야 하는 것:
 *   1. 기존에 정상으로 걸리던 케이스가 그대로 걸린다
 *   2. 전성분에만 있는 알레르겐도 이제 걸린다
 *   3. 지방 알코올(세테아릴·세틸·베헤닐)이 «변성알코올» 로 오탐되지 않는다
 *   4. 추천 풀 자격(incomplete_info) 판정은 넓히지 않는다 — 새 제품이 들어오지 않는다
 *   5. 알레르기 입력이 없으면 아무것도 제외하지 않는다
 *
 * 실행: npx --yes tsx scripts/allergen-full-ingredients-selftest.ts
 */
import assert from "node:assert/strict";
import { filterCandidatesBySafety } from "../src/lib/recommend/filterCandidatesBySafety";
import { applyUserIngredientPreferences } from "../src/lib/recommend/applyUserIngredientPreferences";
import type { Recommendation } from "../src/lib/recommend/types";

const base: Recommendation = {
  skinConcerns: ["dryness"],
  recommendedIngredients: ["Hyaluronic Acid"],
  ingredientsToAvoid: [],
  confidenceScore: 0.8,
};

const rec = (allergy: string[], avoided: string[] = []) =>
  applyUserIngredientPreferences(base, allergy, avoided);

const reasonOf = (
  result: ReturnType<typeof filterCandidatesBySafety>,
  id: string
): string | null => result.excludedProducts.find((e) => e.product.id === id)?.reason ?? null;

// ── 1. 기존 동작: key_ingredients 에 있는 알레르겐은 계속 걸린다
{
  const products = [
    { id: "keeps", key_ingredients: ["Fragrance", "Glycerin"] },
    { id: "clean", key_ingredients: ["Glycerin", "Panthenol"] },
  ];
  const r = filterCandidatesBySafety(products, rec(["Fragrance"]));
  assert.equal(r.excludedCount, 1);
  assert.equal(reasonOf(r, "keeps"), "allergy_or_avoided");
  assert.deepEqual(r.safe.map((p) => p.id), ["clean"]);
}

// ── 2. 넓힌 동작: 전성분에만 있는 알레르겐도 걸린다 (이번 수정의 목적)
{
  const products = [
    {
      id: "fragrance-in-full",
      key_ingredients: ["Glycerin", "Panthenol"],
      full_ingredients: ["Water", "Glycerin", "Panthenol", "Fragrance"],
    },
    {
      id: "truly-clean",
      key_ingredients: ["Glycerin"],
      full_ingredients: ["Water", "Glycerin", "Butylene Glycol"],
    },
  ];
  const r = filterCandidatesBySafety(products, rec(["Fragrance"]));
  assert.equal(reasonOf(r, "fragrance-in-full"), "allergy_or_avoided");
  assert.deepEqual(r.safe.map((p) => p.id), ["truly-clean"]);
}

// 한글 표기 전성분·한글 입력도 같은 캐논컬로 걸린다
{
  const products = [
    { id: "ko", key_ingredients: ["글리세린"], full_ingredients: ["정제수", "글리세린", "향료"] },
  ];
  assert.equal(filterCandidatesBySafety(products, rec(["Fragrance"])).excludedCount, 1);
  assert.equal(filterCandidatesBySafety(products, rec(["향료"])).excludedCount, 1);
}

// 향료 유래 표시 알레르겐 — 사전에 없어 예전엔 절대 못 잡던 것
{
  const products = [
    {
      id: "limonene",
      key_ingredients: ["Glycerin"],
      full_ingredients: ["Water", "Glycerin", "Limonene", "Linalool"],
    },
  ];
  assert.equal(filterCandidatesBySafety(products, rec(["Limonene"])).excludedCount, 1);
  assert.equal(filterCandidatesBySafety(products, rec(["Linalool"])).excludedCount, 1);
}

// 국내 전성분은 한글 음역으로 적힌다. 영문으로 입력해도 이어져야 한다.
// 쌍은 전부 `ingredients` 테이블(식약처 원료성분정보)에서 확인한 것.
{
  const PAIRS: ReadonlyArray<[ko: string, en: string]> = [
    ["리모넨", "Limonene"],
    ["리날룰", "Linalool"],
    ["시트로넬올", "Citronellol"],
    ["제라니올", "Geraniol"],
    ["시트랄", "Citral"],
    ["유제놀", "Eugenol"],
    ["쿠마린", "Coumarin"],
    ["파네솔", "Farnesol"],
    ["신남알", "Cinnamal"],
    ["헥실신남알", "Hexyl Cinnamal"],
    ["신나밀알코올", "Cinnamyl Alcohol"],
    ["벤질알코올", "Benzyl Alcohol"],
    ["벤질벤조에이트", "Benzyl Benzoate"],
    ["벤질살리실레이트", "Benzyl Salicylate"],
    ["하이드록시시트로넬알", "Hydroxycitronellal"],
    ["부틸페닐메틸프로피오날", "Butylphenyl Methylpropional"],
    ["알파-아이소메틸아이오논", "Alpha-Isomethyl Ionone"],
  ];
  for (const [ko, en] of PAIRS) {
    const koProduct = [
      { id: "ko", key_ingredients: ["글리세린"], full_ingredients: ["정제수", ko] },
    ];
    assert.equal(
      filterCandidatesBySafety(koProduct, rec([en])).excludedCount,
      1,
      `영문 "${en}" 입력이 한글 전성분 "${ko}" 을 못 잡는다`
    );
    const enProduct = [
      { id: "en", key_ingredients: ["Glycerin"], full_ingredients: ["Water", en] },
    ];
    assert.equal(
      filterCandidatesBySafety(enProduct, rec([ko])).excludedCount,
      1,
      `한글 "${ko}" 입력이 영문 전성분 "${en}" 을 못 잡는다`
    );
  }
}

// 이름이 겹쳐 보이는 별개 알레르겐끼리 섞이면 안 된다.
{
  const cinnamal = [
    { id: "c", key_ingredients: ["Glycerin"], full_ingredients: ["Water", "Cinnamal"] },
  ];
  assert.equal(
    filterCandidatesBySafety(cinnamal, rec(["Hexyl Cinnamal"])).excludedCount,
    0,
    "Cinnamal 이 Hexyl Cinnamal 로 오탐됐다"
  );
  const citral = [
    { id: "c", key_ingredients: ["Glycerin"], full_ingredients: ["Water", "Citronellol"] },
  ];
  assert.equal(
    filterCandidatesBySafety(citral, rec(["Citral"])).excludedCount,
    0,
    "Citronellol 이 Citral 로 오탐됐다"
  );
  // 벤질알코올은 방부제이고, 사용자가 «변성알코올» 을 피한다고 걸리면 안 된다.
  const benzyl = [
    { id: "b", key_ingredients: ["Glycerin"], full_ingredients: ["Water", "Benzyl Alcohol"] },
  ];
  assert.equal(
    filterCandidatesBySafety(benzyl, rec(["Alcohol Denat"])).excludedCount,
    0,
    "벤질알코올이 변성알코올로 오탐됐다"
  );
}

// ── 3. 지방 알코올 오탐 방지 — 이번 확장이 새로 만들 뻔한 결함
{
  // 세테아릴/세틸/베헤닐 알코올은 유화제·에몰리언트다. 사용자가 피하려는
  // 변성알코올(에탄올)과 다른 물질이라 걸리면 안 된다.
  const fatty = [
    {
      id: "fatty-only",
      key_ingredients: ["Glycerin"],
      full_ingredients: [
        "Water",
        "Cetearyl Alcohol",
        "Cetyl Alcohol",
        "Behenyl Alcohol",
        "Stearyl Alcohol",
        "Glycerin",
      ],
    },
  ];
  const r = filterCandidatesBySafety(fatty, rec(["Alcohol Denat"]));
  assert.equal(r.excludedCount, 0, "지방 알코올이 변성알코올로 오탐됐다");
  assert.deepEqual(r.safe.map((p) => p.id), ["fatty-only"]);

  // 대문자 표기(실제 전성분에 흔함)도 동일하게 통과해야 한다
  const upper = [
    {
      id: "fatty-upper",
      key_ingredients: ["GLYCERIN"],
      full_ingredients: ["WATER", "CETEARYL ALCOHOL", "BEHENYL ALCOHOL"],
    },
  ];
  assert.equal(filterCandidatesBySafety(upper, rec(["Alcohol Denat"])).excludedCount, 0);
}

{
  // 반대로 진짜 에탄올은 걸려야 한다. INCI 에서 단독 `Alcohol` 은 에탄올이다.
  for (const token of ["Alcohol", "Alcohol Denat.", "Ethanol", "변성알코올"]) {
    const products = [
      { id: "real", key_ingredients: ["Glycerin"], full_ingredients: ["Water", token] },
    ];
    const r = filterCandidatesBySafety(products, rec(["Alcohol Denat"]));
    assert.equal(r.excludedCount, 1, `"${token}" 이 변성알코올로 안 걸린다`);
  }
}

// 유도체는 원료 계열로 본다 — 수식어가 뒤에 붙는 형태
{
  const products = [
    {
      id: "centella-ext",
      key_ingredients: ["Glycerin"],
      full_ingredients: ["Water", "Centella Asiatica Extract"],
    },
  ];
  assert.equal(filterCandidatesBySafety(products, rec(["Centella Asiatica"])).excludedCount, 1);
}

// ── 4. 추천 풀 자격은 넓히지 않는다 — 전성분만 있는 제품이 새로 들어오면 안 된다
{
  const products = [
    {
      id: "full-only",
      key_ingredients: [],
      full_ingredients: ["Water", "Glycerin", "Butylene Glycol"],
    },
  ];
  const r = filterCandidatesBySafety(products, rec([]));
  assert.equal(r.incompleteCount, 1, "전성분만 있는 제품이 추천 풀에 새로 들어왔다");
  assert.equal(reasonOf(r, "full-only"), "incomplete_info");
  assert.equal(r.safe.length, 0);
}

// ── 5. 알레르기 입력이 없으면 알레르겐 사유로 제외하지 않는다
{
  const products = [
    {
      id: "has-fragrance",
      key_ingredients: ["Glycerin"],
      full_ingredients: ["Water", "Fragrance", "Limonene"],
    },
  ];
  const r = filterCandidatesBySafety(products, base);
  assert.equal(r.excludedCount, 0);
  assert.deepEqual(r.safe.map((p) => p.id), ["has-fragrance"]);
}

// 회피 성분(allergy 아님)도 같은 경로로 동작한다
{
  const products = [
    { id: "p", key_ingredients: ["Glycerin"], full_ingredients: ["Water", "Fragrance"] },
  ];
  assert.equal(filterCandidatesBySafety(products, rec([], ["Fragrance"])).excludedCount, 1);
}

// ── 6. 제외는 단조 증가한다 — key 에서 걸리던 건 전성분을 봐도 계속 걸린다
{
  const products = [
    {
      id: "both",
      key_ingredients: ["Niacinamide"],
      full_ingredients: ["Water", "Niacinamide", "Glycerin"],
    },
    { id: "key-only", key_ingredients: ["Niacinamide"] },
  ];
  const r = filterCandidatesBySafety(products, rec(["Niacinamide"]));
  assert.equal(r.excludedCount, 2);
  assert.equal(r.safe.length, 0);
}

console.log("allergen-full-ingredients self-test: ok");
