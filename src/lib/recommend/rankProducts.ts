import {
  coerceIngredientList,
  findMatchingIngredient,
} from "./normalizeIngredient";
import type { RankableProduct, RankedProduct, Recommendation } from "./types";

/** 추천 성분 1개 매칭 시 가산점 */
const MATCH_WEIGHT = 1;

/** 회피 성분 1개 적중 시 감점 */
const AVOID_PENALTY = 1.25;

/** 회피 성분이 있을 때 추가 배수 감점 (비율) */
const AVOID_RATIO_PENALTY = 0.35;

/**
 * 제품에서 비교에 쓸 성분 목록을 모은다.
 * key_ingredients + key_ingredients_ja (있을 경우).
 */
function collectProductIngredients(product: RankableProduct): string[] {
  const primary = coerceIngredientList(product.key_ingredients);
  const ja = coerceIngredientList(product.key_ingredients_ja);
  // 중복 원문 제거 (표기 그대로 유지하되 동일 문자열만 제거)
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...primary, ...ja]) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
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

  // 기본 점수: 추천 성분 대비 매칭 비율 (추천 목록이 비면 0)
  const matchRatio =
    recommendedCount > 0 ? matchCount / recommendedCount : 0;

  let score = matchCount * MATCH_WEIGHT + matchRatio;

  // 피부 고민 태그가 recommendation.skinConcerns 와 겹치면 소폭 가산
  if (recommendation.skinConcerns.length > 0 && product.skin_concern) {
    const concernHaystack = coerceIngredientList(product.skin_concern);
    if (concernHaystack.length === 0) {
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

  // 회피 성분 감점
  if (avoidCount > 0) {
    score -= avoidCount * AVOID_PENALTY;
    score -= avoidCount * AVOID_RATIO_PENALTY;
  }

  // 분석 confidence 를 약한 가중치로 반영 (0.85 ~ 1.0 구간)
  const confidenceFactor = 0.85 + 0.15 * recommendation.confidenceScore;
  score *= confidenceFactor;

  // 부동 오차 정리
  score = Math.round(score * 1000) / 1000;

  return {
    product,
    score,
    matchedIngredients,
    excludedIngredients,
  };
}

/**
 * Phase 2 — 제품 랭킹 엔진.
 *
 * Recommendation(Phase 1)과 제품 목록을 받아
 * 추천 성분 매칭·회피 성분 감점 후 점수 내림차순으로 정렬한다.
 *
 * - Supabase 호출 없음 (호출측에서 products 를 넘김)
 * - UI / AI 프롬프트와 무관
 *
 * @param recommendation Phase 1 구조화 추천 객체
 * @param products 랭킹 대상 제품 배열
 * @returns score 내림차순 RankedProduct[]
 */
export function rankProducts<T extends RankableProduct>(
  recommendation: Recommendation,
  products: T[]
): RankedProduct<T>[] {
  if (!Array.isArray(products) || products.length === 0) {
    return [];
  }

  const ranked = products.map((product) =>
    scoreOneProduct(recommendation, product)
  );

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // 동점 시 매칭 성분 수 → id 로 안정 정렬
    if (b.matchedIngredients.length !== a.matchedIngredients.length) {
      return b.matchedIngredients.length - a.matchedIngredients.length;
    }
    return String(a.product.id).localeCompare(String(b.product.id));
  });

  return ranked;
}
