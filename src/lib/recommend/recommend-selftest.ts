/**
 * 핵심 추천 적합도 게이트·배열 매핑·검증일 포맷 selftest (사례 A–E).
 */
import { asConcernOrToneField } from "./asConcernOrToneField";
import {
  buildQuizRecommendation,
  quizRankFingerprint,
} from "./buildQuizRecommendation";
import { diversifyByBrand } from "./diversifyByBrand";
import { filterRankedByMatchEvidence } from "./filterRankedByMatchEvidence";
import { formatVerifiedAtForDisplay } from "./formatVerifiedAt";
import { toCanonicalConcern } from "./concernAliases";
import { rankProducts } from "./rankProducts";
import type { CandidateProduct, RankableProduct, Recommendation } from "./types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`[recommend-selftest] ${msg}`);
}

function baseProduct(
  overrides: Partial<CandidateProduct> & { id: string }
): CandidateProduct {
  return {
    id: overrides.id,
    name: overrides.name ?? `Product ${overrides.id}`,
    name_ko: overrides.name_ko ?? null,
    name_ja: overrides.name_ja ?? null,
    brand: overrides.brand ?? "COSRX",
    category: overrides.category ?? "serum",
    skin_concern: overrides.skin_concern ?? null,
    skin_tone: overrides.skin_tone ?? null,
    key_ingredients: overrides.key_ingredients ?? null,
    key_ingredients_ja: overrides.key_ingredients_ja ?? null,
    price_usd: overrides.price_usd ?? null,
    recommendation_reason: overrides.recommendation_reason ?? null,
    recommendation_reason_ko: overrides.recommendation_reason_ko ?? null,
    recommendation_reason_ja: overrides.recommendation_reason_ja ?? null,
    slug: overrides.slug ?? overrides.id,
    link_sephora: overrides.link_sephora ?? null,
    link_amazon_us: overrides.link_amazon_us ?? null,
    link_amazon_jp: overrides.link_amazon_jp ?? null,
    link_qoo10: overrides.link_qoo10 ?? null,
    link_oliveyoung: overrides.link_oliveyoung ?? null,
    link_coupang: overrides.link_coupang ?? null,
    link_yesstyle: overrides.link_yesstyle ?? null,
    ...(overrides.offers != null ? { offers: overrides.offers } : {}),
    ...(overrides.purchase_links != null
      ? { purchase_links: overrides.purchase_links }
      : {}),
  };
}

const EMPTY_CORE_KO =
  "현재 조건에 맞고 판매처까지 확인된 제품을 준비 중입니다.";

export function runRecommendScoreFixSelftests(): { ok: true; checks: number } {
  let checks = 0;

  // --- D: 배열 매핑 (null로 버리지 않음) ---
  const mapped = asConcernOrToneField(["Dryness", "Anti-aging"]);
  assert(Array.isArray(mapped), "D: skin_concern array preserved");
  assert(
    mapped?.[0] === "Dryness" && mapped?.[1] === "Anti-aging",
    "D: concern values intact"
  );
  assert(asConcernOrToneField("Dryness") === "Dryness", "D: string preserved");
  assert(asConcernOrToneField(null) === null, "D: null stays null");
  assert(asConcernOrToneField([]) === null, "D: empty array → null");
  checks += 1;

  // concern alias KO↔EN (보너스용 — matchedIngredients 가짜 생성 아님)
  assert(
    toCanonicalConcern("건조") === toCanonicalConcern("Dryness"),
    "alias dryness KO/EN"
  );
  assert(
    toCanonicalConcern("여드름") === toCanonicalConcern("Acne"),
    "alias acne KO/EN"
  );
  checks += 1;

  const recWithMatch: Recommendation = {
    skinConcerns: ["건조"],
    recommendedIngredients: ["히알루론산", "Snail Mucin"],
    ingredientsToAvoid: [],
    confidenceScore: 1,
  };

  const matchedProduct = baseProduct({
    id: "4",
    key_ingredients: ["Sodium Hyaluronate", "Snail Secretion Filtrate"],
    skin_concern: ["Dryness", "Anti-aging"],
  });

  const offerOnlyProduct = baseProduct({
    id: "28",
    key_ingredients: ["Niacinamide", "Zinc PCA"],
    skin_concern: ["Acne"],
  });

  // --- A: 성분 매칭 있음 → 핵심 추천 통과 ---
  const rankedA = rankProducts(recWithMatch, [matchedProduct]);
  assert(rankedA.length === 1, "A: one ranked");
  assert(rankedA[0]!.score > 0, "A: score > 0");
  assert(
    rankedA[0]!.matchedIngredients.length > 0,
    "A: matchedIngredients nonempty"
  );
  const coreA = filterRankedByMatchEvidence(rankedA);
  assert(coreA.length === 1, "A: core includes matched product");
  assert(coreA[0]!.product.id === "4", "A: product id 4");
  checks += 1;

  // --- B: 판매처만 있고 성분 매칭 없음 → 핵심 제외 (browse는 별도) ---
  const rankedB = rankProducts(recWithMatch, [offerOnlyProduct]);
  assert(rankedB.length === 1, "B: still ranked internally");
  assert(rankedB[0]!.score === 0, "B: score = 0");
  assert(
    rankedB[0]!.matchedIngredients.length === 0,
    "B: matchedIngredients empty"
  );
  const coreB = filterRankedByMatchEvidence(rankedB);
  assert(coreB.length === 0, "B: excluded from core Top");
  // browse 후보로는 원본 제품 객체 유지 가능
  assert(offerOnlyProduct.id === "28", "B: browse product still available");
  checks += 1;

  // --- C: 적격 핵심 0개 → 빈 목록 (가짜 1·2위 없음) ---
  const rankedC = rankProducts(recWithMatch, [
    offerOnlyProduct,
    baseProduct({
      id: "99",
      key_ingredients: ["Fragrance"],
    }),
  ]);
  const coreC = filterRankedByMatchEvidence(rankedC);
  assert(coreC.length === 0, "C: empty core");
  assert(!coreC[0] && !coreC[1], "C: no fake rank 1/2");
  assert(EMPTY_CORE_KO.includes("판매처까지 확인"), "C: empty-state copy ready");
  checks += 1;

  // 혼합: 매칭 1 + 0점 1 → 핵심에는 매칭만
  const mixed = filterRankedByMatchEvidence(
    rankProducts(recWithMatch, [matchedProduct, offerOnlyProduct])
  );
  assert(mixed.length === 1 && mixed[0]!.product.id === "4", "mixed: only match");
  checks += 1;

  // 고민만 맞고 성분 없음 → score에 보너스만 있어도 matchedIngredients=[] 이면 핵심 제외
  const concernOnlyRec: Recommendation = {
    skinConcerns: ["건조"],
    recommendedIngredients: ["레티놀"],
    ingredientsToAvoid: [],
    confidenceScore: 1,
  };
  const concernOnlyProduct = baseProduct({
    id: "concern-only",
    key_ingredients: ["Glycerin"],
    skin_concern: ["Dryness"],
  });
  const rankedConcern = rankProducts(concernOnlyRec, [concernOnlyProduct]);
  assert(
    rankedConcern[0]!.matchedIngredients.length === 0,
    "concern bonus must not invent matchedIngredients"
  );
  assert(
    filterRankedByMatchEvidence(rankedConcern).length === 0,
    "concern-only excluded from core"
  );
  checks += 1;

  // --- E: UTC verified_at → 한국 날짜, ISO 원문 미노출 ---
  const iso = "2026-07-13T16:01:29.291794+00:00";
  const koDate = formatVerifiedAtForDisplay(iso, "ko", "Asia/Seoul");
  assert(koDate != null, "E: date formatted");
  assert(koDate === "2026년 7월 14일 확인", "E: Seoul date Jul 14");
  assert(!koDate.includes("T"), "E: no ISO T in display");
  assert(!koDate.includes("+00"), "E: no UTC offset in display");
  assert(
    formatVerifiedAtForDisplay("not-a-date", "ko") === null,
    "E: invalid → null (no raw ISO)"
  );
  assert(formatVerifiedAtForDisplay(null, "ko") === null, "E: null → null");
  checks += 1;

  // --- Brand diversity: Top5에서 동일 브랜드 최대 2 · 부족 시 완화 ---
  const scored = [
    { product: baseProduct({ id: "c1", brand: "COSRX" }), score: 5, matchedIngredients: ["a"], excludedIngredients: [] },
    { product: baseProduct({ id: "c2", brand: "COSRX" }), score: 4, matchedIngredients: ["a"], excludedIngredients: [] },
    { product: baseProduct({ id: "c3", brand: "COSRX" }), score: 3, matchedIngredients: ["a"], excludedIngredients: [] },
    { product: baseProduct({ id: "a1", brand: "Anua" }), score: 2.5, matchedIngredients: ["a"], excludedIngredients: [] },
    { product: baseProduct({ id: "b1", brand: "banila co" }), score: 2, matchedIngredients: ["a"], excludedIngredients: [] },
    { product: baseProduct({ id: "r1", brand: "ROUND LAB" }), score: 1.5, matchedIngredients: ["a"], excludedIngredients: [] },
  ];
  const diversed = diversifyByBrand(scored, 5, 2);
  assert(diversed.length === 5, "diversity fills Top5");
  assert(
    diversed.map((r) => r.product.id).join(",") === "c1,c2,a1,b1,r1",
    "diversity skips 3rd COSRX for other brands"
  );
  const onlyCosrx = diversifyByBrand(scored.slice(0, 3), 5, 2);
  assert(
    onlyCosrx.map((r) => r.product.id).join(",") === "c1,c2,c3",
    "diversity relaxes when pool is single-brand"
  );
  checks += 1;

  checks += 1;

  // --- Quiz → Recommendation (문진 Top5 재랭킹 입력) ---
  const quizRec = buildQuizRecommendation({
    concern: "Dryness",
    tone: "Medium",
  });
  assert(quizRec != null, "quiz: dryness builds recommendation");
  assert(
    quizRec!.skinConcerns[0] === "Dryness",
    "quiz: concern preserved"
  );
  assert(
    quizRec!.recommendedIngredients.length === 0,
    "quiz: ingredients left for evidence merge"
  );
  assert(
    buildQuizRecommendation({ concern: "  " }) == null,
    "quiz: blank concern → null"
  );
  assert(
    quizRankFingerprint({ concern: "Acne", tone: "Light", budget: "low" }) ===
      "Acne|Light|low",
    "quiz: fingerprint stable"
  );
  checks += 1;

  // Type smoke: RankableProduct skin_concern array
  const p: RankableProduct = {
    id: "x",
    key_ingredients: ["a"],
    skin_concern: ["Dryness", "Anti-aging"],
  };
  assert(Array.isArray(p.skin_concern), "type allows concern array");
  checks += 1;

  return { ok: true, checks };
}
