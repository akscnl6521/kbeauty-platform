import {
  coerceIngredientList,
  coerceIngredientListUnknown,
  debugNormalizeIngredients,
  findMatchingIngredient,
  normalizeIngredientKey,
} from "./normalizeIngredient";
import type { RankableProduct, RankedProduct, Recommendation } from "./types";

/** 추천 성분 1개 매칭 시 가산점 */
const MATCH_WEIGHT = 1;

/** 회피 성분 1개 적중 시 감점 */
const AVOID_PENALTY = 1.25;

/** 회피 성분이 있을 때 추가 배수 감점 (비율) */
const AVOID_RATIO_PENALTY = 0.35;

/** 개발 로그 출력 상한 (제품당 스팸 방지) */
const DEV_LOG_LIMIT = 5;
let devLogCount = 0;

/**
 * 제품에서 비교에 쓸 성분 목록을 모은다.
 * key_ingredients + key_ingredients_ja (있을 경우).
 */
function collectProductIngredients(product: RankableProduct): string[] {
  const primary = coerceIngredientListUnknown(product.key_ingredients);
  const ja = coerceIngredientListUnknown(product.key_ingredients_ja);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...primary, ...ja]) {
    const key = name.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/**
 * 단일 제품에 대한 매칭·점수 계산.
 */
function scoreOneProduct<T extends RankableProduct>(
  recommendation: Recommendation,
  product: T
): RankedProduct<T> {
  const productIngredients = collectProductIngredients(product);

  const matchedIngredients: string[] = [];
  for (const recommended of recommendation.recommendedIngredients) {
    const hit = findMatchingIngredient(recommended, productIngredients);
    if (hit && !matchedIngredients.includes(hit)) {
      matchedIngredients.push(hit);
    }
  }

  const excludedIngredients: string[] = [];
  for (const avoid of recommendation.ingredientsToAvoid) {
    const hit = findMatchingIngredient(avoid, productIngredients);
    if (hit && !excludedIngredients.includes(hit)) {
      excludedIngredients.push(hit);
    }
  }

  const recommendedCount = recommendation.recommendedIngredients.length;
  const matchCount = matchedIngredients.length;
  const avoidCount = excludedIngredients.length;

  const matchRatio =
    recommendedCount > 0 ? matchCount / recommendedCount : 0;

  let score = matchCount * MATCH_WEIGHT + matchRatio;

  // 피부 고민 태그 소폭 가산 (성분과 동일 매칭 유틸 재사용)
  if (recommendation.skinConcerns.length > 0 && product.skin_concern) {
    const concernHaystack = coerceIngredientList(product.skin_concern);
    if (concernHaystack.length === 0 && product.skin_concern) {
      concernHaystack.push(product.skin_concern);
    }
    let concernHits = 0;
    for (const c of recommendation.skinConcerns) {
      if (findMatchingIngredient(c, concernHaystack)) concernHits += 1;
    }
    if (concernHits > 0) {
      score += 0.15 * (concernHits / recommendation.skinConcerns.length);
    }
  }

  // 회피 성분 감점 유지
  if (avoidCount > 0) {
    score -= avoidCount * AVOID_PENALTY;
    score -= avoidCount * AVOID_RATIO_PENALTY;
  }

  const confidenceFactor = 0.85 + 0.15 * recommendation.confidenceScore;
  score *= confidenceFactor;
  score = Math.round(score * 1000) / 1000;

  // 개발 전용 매칭 디버그 (프로덕션 미출력)
  if (
    process.env.NODE_ENV === "development" &&
    typeof console !== "undefined" &&
    devLogCount < DEV_LOG_LIMIT
  ) {
    devLogCount += 1;
    console.log("[rankProducts:match]", {
      productId: product.id,
      productName: product.name ?? null,
      recommendedIngredients: recommendation.recommendedIngredients,
      normalizedProductIngredients: debugNormalizeIngredients(productIngredients),
      matchedIngredients,
      excludedIngredients,
      score,
      rawKeyIngredients: product.key_ingredients ?? null,
    });
  }

  return {
    product,
    score,
    matchedIngredients,
    excludedIngredients,
  };
}

/**
 * Phase 2 / Sprint 3 Phase 2A — 제품 랭킹 엔진.
 * 시그니처 유지: rankProducts(recommendation, products)
 */
export function rankProducts<T extends RankableProduct>(
  recommendation: Recommendation,
  products: T[]
): RankedProduct<T>[] {
  if (!Array.isArray(products) || products.length === 0) {
    return [];
  }

  // 호출마다 개발 로그 카운터 리셋 (한 번의 랭킹 런에서 상위 N개만)
  devLogCount = 0;

  if (process.env.NODE_ENV === "development") {
    console.log("[rankProducts] start", {
      recommendedIngredients: recommendation.recommendedIngredients,
      ingredientsToAvoid: recommendation.ingredientsToAvoid,
      productCount: products.length,
      sampleNormalize: recommendation.recommendedIngredients.map(
        (r) => `${r} → ${normalizeIngredientKey(r)}`
      ),
    });
  }

  const ranked = products.map((product) =>
    scoreOneProduct(recommendation, product)
  );

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.matchedIngredients.length !== a.matchedIngredients.length) {
      return b.matchedIngredients.length - a.matchedIngredients.length;
    }
    return String(a.product.id).localeCompare(String(b.product.id));
  });

  return ranked;
}
