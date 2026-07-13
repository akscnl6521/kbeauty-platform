import type { RankableProduct, RankedProduct } from "./types";

/**
 * 핵심 추천 적합도 게이트.
 * 판매처(offer) 적격과 분리: 실제 성분 교집합·점수가 있는 제품만 통과.
 * 가짜 점수·padding 없음.
 */
export function hasCoreRecommendMatchEvidence<T extends RankableProduct>(
  ranked: RankedProduct<T>
): boolean {
  return (
    Number.isFinite(ranked.score) &&
    ranked.score > 0 &&
    Array.isArray(ranked.matchedIngredients) &&
    ranked.matchedIngredients.length > 0
  );
}

export function filterRankedByMatchEvidence<T extends RankableProduct>(
  ranked: RankedProduct<T>[]
): RankedProduct<T>[] {
  if (!Array.isArray(ranked) || ranked.length === 0) return [];
  return ranked.filter(hasCoreRecommendMatchEvidence);
}
