import {
  coerceIngredientListUnknown,
  findMatchByCanonical,
  indexIngredients,
  toCanonical,
} from "./normalizeIngredient";
import type { RankableProduct, Recommendation } from "./types";

export type SafetyExclusionReason = "allergy_or_avoided" | "incomplete_info";

export type SafetyExcludedProduct<T extends RankableProduct> = {
  product: T;
  reason: SafetyExclusionReason;
};

export type SafetyFilterResult<T extends RankableProduct> = {
  safe: T[];
  /** 알레르기·회피 매칭으로 제외 */
  excludedCount: number;
  /** 성분 데이터 없음/불완전으로 핵심 추천에서 제외 */
  incompleteCount: number;
  /**
   * 제외된 제품과 사유 (표시용). 필터 결정 로직은 바꾸지 않음 — 이미
   * 계산되던 결과를 그대로 노출만 함.
   */
  excludedProducts: SafetyExcludedProduct<T>[];
};

function collectProductIngredientLabels(product: RankableProduct): string[] {
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

function forbiddenCanonicals(recommendation: Recommendation): string[] {
  const labels = [
    ...(recommendation.allergyIngredients ?? []),
    ...(recommendation.avoidedIngredients ?? []),
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const label of labels) {
    const c = toCanonical(label);
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

/**
 * 랭킹 전 안전 필터.
 * - 알레르기/회피 성분이 캐논컬 매칭되면 제외
 * - 성분 정보가 없으면 안전하다고 보지 않고 핵심 추천에서 제외
 * 기존 점수 배점은 변경하지 않는다.
 */
export function filterCandidatesBySafety<T extends RankableProduct>(
  products: T[],
  recommendation: Recommendation
): SafetyFilterResult<T> {
  const banned = forbiddenCanonicals(recommendation);
  const safe: T[] = [];
  const excludedProducts: SafetyExcludedProduct<T>[] = [];
  let excludedCount = 0;
  let incompleteCount = 0;

  for (const product of products) {
    const labels = collectProductIngredientLabels(product);
    if (labels.length === 0) {
      incompleteCount += 1;
      excludedProducts.push({ product, reason: "incomplete_info" });
      continue;
    }

    if (banned.length > 0) {
      const index = indexIngredients(labels);
      let hit = false;
      for (const canonical of banned) {
        if (findMatchByCanonical(canonical, index)) {
          hit = true;
          break;
        }
      }
      if (hit) {
        excludedCount += 1;
        excludedProducts.push({ product, reason: "allergy_or_avoided" });
        continue;
      }
    }

    safe.push(product);
  }

  return { safe, excludedCount, incompleteCount, excludedProducts };
}
