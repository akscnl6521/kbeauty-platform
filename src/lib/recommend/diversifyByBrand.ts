import type { RankedProduct } from "./types";

function brandKey(brand: string | null | undefined): string {
  const t = (brand ?? "").trim().toLowerCase();
  return t || "__unknown__";
}

/**
 * 점수 순 랭킹을 유지하면서 Top N에서 동일 브랜드를 최대 maxPerBrand개로 제한한다.
 * 후보가 부족하면 제한을 완화해 슬롯을 채운다(가짜 제품 패딩 없음).
 */
export function diversifyByBrand<T extends { brand?: string | null }>(
  ranked: RankedProduct<T>[],
  topN: number,
  maxPerBrand = 2
): RankedProduct<T>[] {
  if (topN < 1 || ranked.length === 0) return [];
  if (maxPerBrand < 1) {
    return ranked.slice(0, Math.min(topN, ranked.length));
  }

  const selected: RankedProduct<T>[] = [];
  const counts = new Map<string, number>();
  const deferred: RankedProduct<T>[] = [];

  for (const row of ranked) {
    if (selected.length >= topN) break;
    const key = brandKey(row.product.brand);
    const n = counts.get(key) ?? 0;
    if (n < maxPerBrand) {
      selected.push(row);
      counts.set(key, n + 1);
    } else {
      deferred.push(row);
    }
  }

  for (const row of deferred) {
    if (selected.length >= topN) break;
    selected.push(row);
  }

  return selected;
}
