import type { RankableProduct, RankedProduct } from "./types";

/**
 * 한 브랜드가 추천을 독차지하지 않게 막는다.
 *
 * §29 시나리오 정의는 `brandCapDefault: 2` 를 두고 있는데, 그 값이 파일럿 경로
 * (`pilotEnrichment`)에만 적용돼 있고 **핵심 추천 경로에는 없었다.**
 *
 * 2026-07-30 Production 실측에서 「건성+장벽」 Top 5 가 **전부 COSRX** 로 나왔다.
 * 카탈로그 17건 중 COSRX 가 10건이라 점수 순으로 자르면 그렇게 된다. 사용자에게는
 * 추천이 아니라 한 브랜드 광고로 보인다.
 *
 * **점수를 바꾸지 않는다.** 랭킹은 그대로 두고, 뽑을 때 브랜드별 상한만 건다.
 */
export const DEFAULT_BRAND_CAP = 2;

function brandKey(product: RankableProduct): string {
  return String(product.brand ?? "").trim().toLowerCase() || "(unknown)";
}

/**
 * 점수 순서를 지키면서 브랜드당 `cap` 개까지만 고른다.
 *
 * 상한 때문에 `minCount` 를 못 채우면, 넘친 것 중 점수가 높은 순으로 채운다 —
 * 다양성 때문에 추천이 2건으로 쪼그라드는 것보다 3건을 보여주는 편이 낫다
 * (§29 `finalRecommendationMin: 3`).
 *
 * @param ranked  점수 내림차순으로 정렬된 결과
 * @param limit   최종적으로 필요한 개수
 */
export function applyBrandDiversity<T extends RankableProduct>(
  ranked: RankedProduct<T>[],
  limit: number,
  options?: { cap?: number; minCount?: number }
): RankedProduct<T>[] {
  if (!Array.isArray(ranked) || ranked.length === 0) return [];
  const cap = options?.cap ?? DEFAULT_BRAND_CAP;
  const minCount = options?.minCount ?? 3;

  const picked: RankedProduct<T>[] = [];
  const overflow: RankedProduct<T>[] = [];
  const counts = new Map<string, number>();

  for (const item of ranked) {
    if (picked.length >= limit) break;
    const key = brandKey(item.product);
    const used = counts.get(key) ?? 0;
    if (used >= cap) {
      overflow.push(item);
      continue;
    }
    counts.set(key, used + 1);
    picked.push(item);
  }

  // 상한 때문에 최소 개수를 못 채웠으면 넘친 것으로 보충한다.
  if (picked.length < Math.min(minCount, ranked.length)) {
    for (const item of overflow) {
      if (picked.length >= Math.min(minCount, ranked.length)) break;
      picked.push(item);
    }
    // 보충분이 뒤에 붙었으므로 점수 순서를 다시 맞춘다.
    picked.sort((a, b) => b.score - a.score);
  }

  return picked.slice(0, limit);
}
