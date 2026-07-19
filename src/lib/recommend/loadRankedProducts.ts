import type { CandidateProduct, RankedProduct } from "./types";
import { RANKED_PRODUCTS_STORAGE_KEY, RANKED_PRODUCTS_TOP_N } from "./types";
import { filterRankedByMatchEvidence } from "./filterRankedByMatchEvidence";
import {
  discardStaleRankedProductsCache,
  filterRankedProductsByKrVerifiedOffer,
  isRecommendationCacheVersionCurrent,
} from "./recommendationCache";
import { syncVerifiedUsageGuidesFromRankedProducts } from "./syncUsageGuides";

/**
 * LocalStorage(skinRankedProducts)에서 랭킹 결과를 읽는다.
 * - 캐시 버전 불일치 시 Top 5 폐기 후 빈 배열
 * - 로드 후에도 한국 verified offer 기준으로 재필터
 * - 점수 0·매칭 성분 없는 항목은 핵심 추천에서 제외
 * - 제품에 검증된 usageGuide가 있을 때만 루틴용 저장소로 동기화
 */
export function loadRankedProductsFromStorage(): RankedProduct<CandidateProduct>[] {
  if (typeof window === "undefined") return [];

  try {
    if (!isRecommendationCacheVersionCurrent()) {
      discardStaleRankedProductsCache();
      window.localStorage.removeItem("skinProductUsageGuides");
      return [];
    }

    const raw = window.localStorage.getItem(RANKED_PRODUCTS_STORAGE_KEY);
    if (!raw) {
      window.localStorage.removeItem("skinProductUsageGuides");
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem("skinProductUsageGuides");
      return [];
    }

    syncVerifiedUsageGuidesFromRankedProducts(parsed);

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
          ? row.matchedIngredients.filter(
              (x): x is string => typeof x === "string"
            )
          : [],
        excludedIngredients: Array.isArray(row.excludedIngredients)
          ? row.excludedIngredients.filter(
              (x): x is string => typeof x === "string"
            )
          : [],
      });

      if (items.length >= RANKED_PRODUCTS_TOP_N) break;
    }

    const offerOk = filterRankedProductsByKrVerifiedOffer(items);
    return filterRankedByMatchEvidence(offerOk);
  } catch {
    window.localStorage.removeItem("skinProductUsageGuides");
    return [];
  }
}
