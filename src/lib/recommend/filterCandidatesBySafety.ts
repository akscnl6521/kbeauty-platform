import {
  coerceIngredientListUnknown,
  indexIngredients,
  toCanonical,
} from "./normalizeIngredient";
import { matchAllergenByCanonical } from "./allergenMatch";
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

function dedupe(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const key = name.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/**
 * 이 제품에 «성분 정보가 있는가» 판정용 목록.
 *
 * 핵심 추천 자격의 기준이라 일부러 `key_ingredients` 계열만 본다. 전성분까지
 * 세면 성분 사전에 하나도 안 잡히는 제품(현재 19건)이 추천 풀에 새로 들어오는데,
 * 그건 안전 필터가 결정할 일이 아니다.
 */
function collectProductIngredientLabels(product: RankableProduct): string[] {
  return dedupe([
    ...coerceIngredientListUnknown(product.key_ingredients),
    ...coerceIngredientListUnknown(product.key_ingredients_ja),
  ]);
}

/**
 * 알레르기·회피 성분을 훑을 목록 — **전성분까지 본다.**
 *
 * `key_ingredients` 는 기능성 성분 사전으로 골라낸 부분집합이라 향료·리모넨·
 * 리날룰 같은 대표 알레르겐이 구조적으로 들어가지 않는다. 그 결과 «향료 알레르기»
 * 를 입력해도 Staging 실측 기준 향료 함유 40건 중 3건만 걸러졌다. 알레르겐 판정은
 * 제품이 선언한 전성분 전체를 근거로 해야 한다.
 */
function collectAllergenScanLabels(product: RankableProduct): string[] {
  return dedupe([
    ...coerceIngredientListUnknown(product.key_ingredients),
    ...coerceIngredientListUnknown(product.key_ingredients_ja),
    ...coerceIngredientListUnknown(product.full_ingredients),
  ]);
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
      const index = indexIngredients(collectAllergenScanLabels(product));
      let hit = false;
      for (const canonical of banned) {
        if (matchAllergenByCanonical(canonical, index)) {
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
