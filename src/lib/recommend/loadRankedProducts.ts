import type { CandidateProduct, RankedProduct } from "./types";
import { RANKED_PRODUCTS_STORAGE_KEY, RANKED_PRODUCTS_TOP_N } from "./types";

/**
 * LocalStorage(skinRankedProducts)에서 랭킹 결과를 읽는다.
 * 파싱 실패·빈 값이면 빈 배열. 최대 TOP_N 개만 반환.
 */
export function loadRankedProductsFromStorage(): RankedProduct<CandidateProduct>[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(RANKED_PRODUCTS_STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const items: RankedProduct<CandidateProduct>[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Partial<RankedProduct<CandidateProduct>>;
      if (!row.product || typeof row.product !== "object") continue;
      if (typeof row.product.id !== "string" || !row.product.id) continue;
      if (typeof row.score !== "number" || !Number.isFinite(row.score)) continue;

      items.push({
        product: row.product as CandidateProduct,
        score: row.score,
        matchedIngredients: Array.isArray(row.matchedIngredients)
          ? row.matchedIngredients.filter((x): x is string => typeof x === "string")
          : [],
        excludedIngredients: Array.isArray(row.excludedIngredients)
          ? row.excludedIngredients.filter((x): x is string => typeof x === "string")
          : [],
      });

      if (items.length >= RANKED_PRODUCTS_TOP_N) break;
    }

    return items;
  } catch {
    return [];
  }
}
