import { fetchCandidateProducts } from "./fetchCandidateProducts";
import { filterCandidatesBySafety } from "./filterCandidatesBySafety";
import { filterCandidatesByOfferAvailability } from "./productOffer";
import { writeRecommendationCacheVersion } from "./recommendationCache";
import { rankProducts } from "./rankProducts";
import type { CandidateProduct, RankedProduct, Recommendation } from "./types";
import {
  CORE_RECOMMEND_OFFER_COUNTRY,
  RANKED_PRODUCTS_STORAGE_KEY,
  RANKED_PRODUCTS_TOP_N,
  RECOMMENDATION_CACHE_VERSION_KEY,
  RECOMMENDATION_STORAGE_KEY,
} from "./types";

export type PersistTopRankedOptions = {
  /**
   * 참고용 배송 국가.
   * 핵심 추천 offer 필터는 항상 KR(CORE_RECOMMEND_OFFER_COUNTRY)을 사용한다.
   */
  shippingCountry?: string | null;
};

/**
 * Recommendation 과 Top N 랭킹 결과를 LocalStorage에 함께 저장한다.
 * 키: skinRecommendation, skinRankedProducts (+ recommendationCacheVersion)
 */
function writeRecommendationAndRanked(
  recommendation: Recommendation,
  rankedJson: string
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RECOMMENDATION_STORAGE_KEY,
      JSON.stringify(recommendation)
    );
    window.localStorage.setItem(RANKED_PRODUCTS_STORAGE_KEY, rankedJson);
    writeRecommendationCacheVersion();
  } catch {
    // ignore quota/serialization errors
  }
}

/**
 * Phase 3B — Recommendation → KR offer 적격 → 안전 필터 → 랭킹 → 저장.
 *
 * 1) filterCandidatesByOfferAvailability(..., "KR")
 * 2) 알레르기·회피 안전 필터
 * 3) 피부 적합도 점수 (기존 rankProducts)
 * 한국 verified offer가 없으면 Top 5는 빈 배열로 저장한다.
 *
 * @returns 저장된 Top N (실패·후보 0이면 빈 배열)
 */
export async function persistTopRankedProducts(
  recommendation: Recommendation,
  _options: PersistTopRankedOptions = {}
): Promise<RankedProduct<CandidateProduct>[]> {
  // 후보 조회 전에 Recommendation 을 먼저 저장 (조회 실패 시에도 키 존재 보장)
  writeRecommendationAndRanked(recommendation, "[]");

  try {
    const candidates = await fetchCandidateProducts({ includeOffers: true });

    // 핵심 추천: 항상 한국 verified offer 기준
    const { eligible: sellable, excludedCount: offerExcludedCount } =
      filterCandidatesByOfferAvailability(
        candidates,
        CORE_RECOMMEND_OFFER_COUNTRY
      );

    const { safe, excludedCount, incompleteCount } = filterCandidatesBySafety(
      sellable,
      recommendation
    );

    const withStats: Recommendation = {
      ...recommendation,
      safetyExcludedCount: excludedCount,
      safetyIncompleteCount: incompleteCount,
    };

    const ranked = rankProducts(withStats, safe);
    const top = ranked.slice(0, RANKED_PRODUCTS_TOP_N);

    if (process.env.NODE_ENV === "development") {
      console.log("[coreRecommend]", {
        candidateCount: candidates.length,
        krVerifiedOfferPass: sellable.length,
        offerExcluded: offerExcludedCount,
        allergyFilterPass: safe.length,
        finalRankedCount: ranked.length,
        topNSaved: top.length,
        offerCountry: CORE_RECOMMEND_OFFER_COUNTRY,
      });
    }

    writeRecommendationAndRanked(withStats, JSON.stringify(top));
    return top;
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[persistTopRankedProducts]", err.message);
    writeRecommendationAndRanked(recommendation, "[]");
    return [];
  }
}

/** 랭킹 결과 LocalStorage 삭제 (분석 결과 초기화 시 함께 호출) */
export function clearPersistedRankedProducts(): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(RANKED_PRODUCTS_STORAGE_KEY);
      window.localStorage.removeItem(RECOMMENDATION_CACHE_VERSION_KEY);
    }
  } catch {
    // ignore
  }
}
