import { applyEvidenceToRecommendation } from "@/lib/evidence";
import { resolveApprovedEvidenceForConcerns } from "@/lib/evidence/loadApprovedEvidence";
import { clampTopNWithoutPadding } from "@/lib/recommend/clampTopN";
import { fetchCandidateProducts } from "./fetchCandidateProducts";
import { filterCandidatesBySafety } from "./filterCandidatesBySafety";
import { filterRankedByMatchEvidence } from "./filterRankedByMatchEvidence";
import {
  filterOutStimulatingActives,
  filterPublicCatalogProducts,
} from "./publicCatalogFilter";
import { filterCandidatesByOfferAvailability } from "./productOffer";
import { getResultExposurePolicy } from "./resultExposurePolicy";
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

function isExpertSoftCareLevel(recommendation: Recommendation): boolean {
  return recommendation.managementLevel === "expert_first";
}

/**
 * Phase 3B / Phase 4 — verified catalog → KR offer → allergy hard filter → rank.
 * Never pads Top N with fake products when fewer than 5 qualify.
 *
 * Exposure policy:
 * - urgent_check: 제품 카드·구매 노출을 모두 차단하고 빈 랭킹을 저장한다.
 * - expert_first: 자극 활성 성분을 제외한 보조 관리 참고만 저장한다.
 * - 그 외: 일반 핵심 추천 흐름을 사용한다.
 *
 * @returns 저장된 Top N (실패·후보 0이면 []; 1~4개도 그대로 저장)
 */
export async function persistTopRankedProducts(
  recommendation: Recommendation,
  _options: PersistTopRankedOptions = {}
): Promise<RankedProduct<CandidateProduct>[]> {
  // Evidence Layer: DB approved ∪ static catalog
  const evidenceLinks = await resolveApprovedEvidenceForConcerns(
    recommendation.skinConcerns ?? []
  );
  const withEvidence = applyEvidenceToRecommendation(
    recommendation,
    evidenceLinks
  );
  writeRecommendationAndRanked(withEvidence, "[]");

  const exposure = getResultExposurePolicy(withEvidence.managementLevel);
  if (!exposure.allowProductCards) {
    if (process.env.NODE_ENV === "development") {
      console.log("[coreRecommend]", {
        managementLevel: withEvidence.managementLevel,
        productExposureBlocked: true,
        topNSaved: 0,
      });
    }
    return [];
  }

  try {
    const rawCandidates = await fetchCandidateProducts({ includeOffers: true });
    const candidates = filterPublicCatalogProducts(rawCandidates);

    const { eligible: sellable, excludedCount: offerExcludedCount } =
      filterCandidatesByOfferAvailability(
        candidates,
        CORE_RECOMMEND_OFFER_COUNTRY
      );

    let pool = sellable;
    if (isExpertSoftCareLevel(withEvidence)) {
      pool = filterOutStimulatingActives(pool);
    }

    const { safe, excludedCount, incompleteCount } = filterCandidatesBySafety(
      pool,
      withEvidence
    );

    const withStats: Recommendation = {
      ...withEvidence,
      safetyExcludedCount: excludedCount,
      safetyIncompleteCount: incompleteCount,
    };

    const ranked = rankProducts(withStats, safe);
    const withMatchEvidence = filterRankedByMatchEvidence(ranked);
    const top = clampTopNWithoutPadding(
      withMatchEvidence,
      RANKED_PRODUCTS_TOP_N
    );

    if (process.env.NODE_ENV === "development") {
      console.log("[coreRecommend]", {
        candidateCount: candidates.length,
        krVerifiedOfferPass: sellable.length,
        offerExcluded: offerExcludedCount,
        allergyFilterPass: safe.length,
        finalRankedCount: ranked.length,
        matchEvidencePass: withMatchEvidence.length,
        evidenceLinks: withEvidence.evidenceLinks?.length ?? 0,
        topNSaved: top.length,
        expertSoftCareMode: isExpertSoftCareLevel(withEvidence),
        padded: false,
        offerCountry: CORE_RECOMMEND_OFFER_COUNTRY,
      });
    }

    writeRecommendationAndRanked(withStats, JSON.stringify(top));
    return top;
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[persistTopRankedProducts]", err.message);
    writeRecommendationAndRanked(withEvidence, "[]");
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
