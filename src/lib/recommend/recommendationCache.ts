import type { CandidateProduct, RankedProduct } from "./types";
import {
  CORE_RECOMMEND_OFFER_COUNTRY,
  RANKED_PRODUCTS_STORAGE_KEY,
  RANKED_PRODUCTS_TOP_N,
  RECOMMENDATION_CACHE_VERSION,
  RECOMMENDATION_CACHE_VERSION_KEY,
} from "./types";
import { QUIZ_RANK_FINGERPRINT_KEY } from "./buildQuizRecommendation";
import {
  isOfferEligibleForCoreRecommendation,
  resolveProductOffers,
} from "./productOffer";

/** 캐시 버전이 현재와 일치하는지 */
export function isRecommendationCacheVersionCurrent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem(RECOMMENDATION_CACHE_VERSION_KEY);
    return v === RECOMMENDATION_CACHE_VERSION;
  } catch {
    return false;
  }
}

/** 현재 캐시 버전 기록 */
export function writeRecommendationCacheVersion(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RECOMMENDATION_CACHE_VERSION_KEY,
      RECOMMENDATION_CACHE_VERSION
    );
  } catch {
    // ignore
  }
}

/**
 * 구버전·불일치 캐시의 Top 5 폐기.
 * recommendationCacheVersion 이 없거나 다르면 rankedProducts 를 삭제한다.
 */
export function discardStaleRankedProductsCache(): boolean {
  if (typeof window === "undefined") return false;
  if (isRecommendationCacheVersionCurrent()) return false;
  try {
    window.localStorage.removeItem(RANKED_PRODUCTS_STORAGE_KEY);
    window.localStorage.removeItem(RECOMMENDATION_CACHE_VERSION_KEY);
    try {
      window.localStorage.removeItem(QUIZ_RANK_FINGERPRINT_KEY);
    } catch {
      // ignore
    }
    if (process.env.NODE_ENV === "development") {
      console.log("[recommendationCache]", {
        action: "discardStaleTop5",
        expected: RECOMMENDATION_CACHE_VERSION,
      });
    }
    return true;
  } catch {
    return false;
  }
}

/** 제품이 한국 핵심 추천 offer 조건을 충족하는지 */
export function productHasKrVerifiedCoreOffer(
  product: CandidateProduct
): boolean {
  const offers = resolveProductOffers(product);
  return offers.some((o) =>
    isOfferEligibleForCoreRecommendation(o, CORE_RECOMMEND_OFFER_COUNTRY)
  );
}

/**
 * 저장된 Top N을 한국 verified offer 기준으로 재검증.
 * 통과분만 남기고, 변경 시 storage 를 갱신한다.
 */
export function filterRankedProductsByKrVerifiedOffer(
  ranked: RankedProduct<CandidateProduct>[]
): RankedProduct<CandidateProduct>[] {
  const filtered = ranked.filter((row) =>
    productHasKrVerifiedCoreOffer(row.product)
  );

  if (
    typeof window !== "undefined" &&
    filtered.length !== ranked.length
  ) {
    try {
      window.localStorage.setItem(
        RANKED_PRODUCTS_STORAGE_KEY,
        JSON.stringify(filtered.slice(0, RANKED_PRODUCTS_TOP_N))
      );
      writeRecommendationCacheVersion();
    } catch {
      // ignore
    }
  }

  return filtered.slice(0, RANKED_PRODUCTS_TOP_N);
}
