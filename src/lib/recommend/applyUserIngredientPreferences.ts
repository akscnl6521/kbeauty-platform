import { toCanonical } from "./normalizeIngredient";
import type { Recommendation } from "./types";

function mergeUniqueLabels(...lists: (string[] | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    if (!list) continue;
    for (const label of list) {
      const trimmed = label.trim();
      if (!trimmed) continue;
      const key = toCanonical(trimmed) || trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
    }
  }
  return out;
}

function excludeByCanonical(
  labels: string[],
  forbidden: string[]
): string[] {
  const banned = new Set(
    forbidden.map((x) => toCanonical(x)).filter(Boolean)
  );
  if (banned.size === 0) return [...labels];
  return labels.filter((label) => {
    const c = toCanonical(label);
    return !c || !banned.has(c);
  });
}

/**
 * 사용자 알레르기·회피 성분을 Recommendation에 반영.
 * - recommendedIngredients 에서 제외
 * - ingredientsToAvoid 에 병합
 * - allergyIngredients / avoidedIngredients 필드 저장
 */
export function applyUserIngredientPreferences(
  recommendation: Recommendation,
  allergyIngredients: string[] = [],
  avoidedIngredients: string[] = []
): Recommendation {
  const allergy = mergeUniqueLabels(allergyIngredients);
  const avoided = mergeUniqueLabels(avoidedIngredients);
  const forbidden = mergeUniqueLabels(allergy, avoided);

  const recommendedIngredients = excludeByCanonical(
    recommendation.recommendedIngredients,
    forbidden
  );
  const ingredientsToAvoid = mergeUniqueLabels(
    recommendation.ingredientsToAvoid,
    allergy,
    avoided
  );

  return {
    ...recommendation,
    recommendedIngredients,
    ingredientsToAvoid,
    allergyIngredients: allergy,
    avoidedIngredients: avoided,
  };
}
