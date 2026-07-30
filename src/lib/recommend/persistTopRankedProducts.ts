import { applyEvidenceToRecommendation } from "@/lib/evidence";
import { resolveApprovedEvidenceForConcerns } from "@/lib/evidence/loadApprovedEvidence";
import { autoSaveCompletedAnalysisToCare } from "@/lib/care/auto-save";
import { clampTopNWithoutPadding } from "@/lib/recommend/clampTopN";
import { applyBrandDiversity } from "@/lib/recommend/applyBrandDiversity";
import {
  fetchCandidateProducts,
  fetchCandidateProductsBySlugs,
} from "./fetchCandidateProducts";
import { filterCandidatesBySafety } from "./filterCandidatesBySafety";
import { filterRankedByMatchEvidence } from "./filterRankedByMatchEvidence";
import {
  filterOutStimulatingActives,
  filterPublicCatalogProducts,
} from "./publicCatalogFilter";
import { filterCandidatesByOfferAvailability } from "./productOffer";
import { writeRecommendationCacheVersion } from "./recommendationCache";
import { rankProducts } from "./rankProducts";
import {
  isScenarioPilotPhase2Enabled,
  runScenarioPilotPhase2,
} from "./scenarios/pilotPhase2";
import type { CandidateProduct, RankedProduct, Recommendation } from "./types";
import { normalizeShippingCountry } from "./selectPurchaseLink";
import {
  CORE_RECOMMEND_OFFER_COUNTRY,
  RANKED_PRODUCTS_STORAGE_KEY,
  RANKED_PRODUCTS_TOP_N,
  RECOMMENDATION_CACHE_VERSION_KEY,
  RECOMMENDATION_STORAGE_KEY,
} from "./types";

export type PersistTopRankedOptions = {
  /**
   * 사용자의 배송 국가. offer 필터가 **이 국가 기준**으로 동작한다.
   *
   * 예전에는 이 값을 받아 두고도 offer 필터에는 항상 KR 을 썼다. 그러면 미국
   * 사용자는 US 판매처가 있는 제품도 «구매처 없음» 으로 보게 된다 — 국가별
   * 구매처를 제공한다는 설계와 어긋난다.
   *
   * 값이 없거나 인식할 수 없으면 KR 로 떨어진다. 기존 동작(한국 사용자)은
   * 그대로다.
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

function isRiskLevel(recommendation: Recommendation): boolean {
  const level = recommendation.managementLevel;
  return level === "expert_first" || level === "urgent_check";
}

function finishCareTracking(
  recommendation: Recommendation,
  ranked: RankedProduct<CandidateProduct>[],
  country?: string | null
): void {
  try {
    autoSaveCompletedAnalysisToCare({
      recommendation,
      rankedProductIds: ranked.map((item) => item.product.id),
      country: country ?? CORE_RECOMMEND_OFFER_COUNTRY,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[autoSaveCompletedAnalysisToCare]",
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

/**
 * Phase 3B / Phase 4 — verified catalog → KR offer → allergy hard filter → rank.
 * Never pads Top N with fake products when fewer than 5 qualify.
 * expert_first: 자극 활성 성분 제외 후 보조 관리용 제품만 저장.
 * urgent_check: 제품 후보를 만들지 않고 체크인 추적만 시작.
 *
 * @returns 저장된 Top N (실패·후보 0이면 []; 1~4개도 그대로 저장)
 */
export async function persistTopRankedProducts(
  recommendation: Recommendation,
  options: PersistTopRankedOptions = {}
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

  if (withEvidence.managementLevel === "urgent_check") {
    finishCareTracking(withEvidence, [], options.shippingCountry);
    return [];
  }

  if (isScenarioPilotPhase2Enabled()) {
    try {
      const pilot = await runScenarioPilotPhase2({
        recommendation: withEvidence,
        fetchCandidatesBySlugs: (slugs) =>
          fetchCandidateProductsBySlugs(slugs, { includeOffers: true }),
        shippingCountry: options.shippingCountry,
      });

      if (process.env.NODE_ENV === "development") {
        console.log("[scenarioPilotPhase2]", {
          status: pilot.status,
          scenarioId: pilot.snapshot.scenarioId,
          matchConfidence: pilot.snapshot.matchConfidence,
          readySlotCount: pilot.snapshot.readySlotCount,
          topNSaved: pilot.ranked.length,
          usedScenarioPoolOnly: pilot.usedScenarioPoolOnly,
        });
      }

      writeRecommendationAndRanked(
        pilot.recommendation,
        JSON.stringify(pilot.ranked)
      );
      finishCareTracking(
        pilot.recommendation,
        pilot.ranked,
        options.shippingCountry
      );
      return pilot.ranked;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error("[persistTopRankedProducts/pilotPhase2]", err.message);
      writeRecommendationAndRanked(withEvidence, "[]");
      finishCareTracking(withEvidence, [], options.shippingCountry);
      return [];
    }
  }

  try {
    const rawCandidates = await fetchCandidateProducts({ includeOffers: true });
    const candidates = filterPublicCatalogProducts(rawCandidates);

    // 사용자 국가로 판매처를 고른다. 인식 못 하면 KR (기존 동작).
    const offerCountry =
      normalizeShippingCountry(options.shippingCountry) ??
      CORE_RECOMMEND_OFFER_COUNTRY;

    const { eligible: sellable, excludedCount: offerExcludedCount } =
      filterCandidatesByOfferAvailability(candidates, offerCountry);

    let pool = sellable;
    if (isRiskLevel(withEvidence)) {
      pool = filterOutStimulatingActives(pool);
    }

    const { safe, excludedCount, incompleteCount, excludedProducts } =
      filterCandidatesBySafety(pool, withEvidence);

    const withStats: Recommendation = {
      ...withEvidence,
      safetyExcludedCount: excludedCount,
      safetyIncompleteCount: incompleteCount,
      safetyExcludedItems: excludedProducts.slice(0, 20).map(({ product, reason }) => ({
        productId: product.id,
        productName: product.name || product.brand || product.id,
        reason,
      })),
    };

    const ranked = rankProducts(withStats, safe);
    const withMatchEvidence = filterRankedByMatchEvidence(ranked);
    // 한 브랜드가 추천을 독차지하지 않게 상한을 건다(§29 brandCapDefault).
    // 점수는 건드리지 않고 뽑는 단계에서만 제한한다 — 2026-07-30 Production
    // 실측에서 「건성+장벽」 Top 5 가 전부 COSRX 로 나왔다.
    const diversified = applyBrandDiversity(withMatchEvidence, RANKED_PRODUCTS_TOP_N);
    const top = clampTopNWithoutPadding(
      diversified,
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
        riskSoftMode: isRiskLevel(withEvidence),
        padded: false,
        offerCountry,
      });
    }

    writeRecommendationAndRanked(withStats, JSON.stringify(top));
    finishCareTracking(withStats, top, options.shippingCountry);
    return top;
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[persistTopRankedProducts]", err.message);
    writeRecommendationAndRanked(withEvidence, "[]");
    finishCareTracking(withEvidence, [], options.shippingCountry);
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
