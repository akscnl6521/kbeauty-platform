import { clampTopNWithoutPadding } from "@/lib/recommend/clampTopN";
import { filterCandidatesBySafety } from "@/lib/recommend/filterCandidatesBySafety";
import { filterRankedByMatchEvidence } from "@/lib/recommend/filterRankedByMatchEvidence";
import { filterOutStimulatingActives } from "@/lib/recommend/publicCatalogFilter";
import { filterCandidatesByOfferAvailability } from "@/lib/recommend/productOffer";
import { rankProducts } from "@/lib/recommend/rankProducts";
import type { CandidateProduct, RankedProduct, Recommendation } from "@/lib/recommend/types";
import {
  CORE_RECOMMEND_OFFER_COUNTRY,
  RANKED_PRODUCTS_TOP_N,
} from "@/lib/recommend/types";
import { applyBrandCap, resolveBrandCap } from "../poolRules";
import {
  PILOT_FINAL_RECOMMENDATION_MIN,
  PILOT_INSUFFICIENT_USER_MESSAGE_KO,
  PILOT_SCENARIO_VERSION,
} from "./constants";
import { matchPilotScenario } from "./matchPilotScenario";
import {
  getPilotReadyCountFromReport,
  getPoolArtifactVersions,
  getReadySlugsForScenario,
  isPilotInsufficientScenario,
  isPilotRuntimeAbcScenario,
  isRegionalSkuExcludedForKr,
} from "./pilotPoolArtifacts";
import { applyPilotPersonalReranking } from "./personalReranking";
import { recommendationToScenarioMatchInput } from "./recommendationToMatchInput";
import type {
  ScenarioPilotPhase2Result,
  ScenarioPilotRecommendationDetails,
  ScenarioPilotSnapshot,
} from "./types";

function isRiskLevel(recommendation: Recommendation): boolean {
  const level = recommendation.managementLevel;
  return level === "expert_first" || level === "urgent_check";
}

function buildDetails(
  recommendation: Recommendation,
  ranked: RankedProduct<CandidateProduct>[],
  scenario: import("../types").RecommendationScenario
): ScenarioPilotRecommendationDetails {
  const matchedIngredients = [
    ...new Set(ranked.flatMap((r) => r.matchedIngredients)),
  ];
  const cautionIngredients = [
    ...new Set(scenario.prohibitedOrCautionIngredients ?? []),
  ];

  const morning = recommendation.suggestedMorningOrder ?? [];
  const evening = recommendation.suggestedEveningOrder ?? [];
  const usageOrder =
    morning.length > 0 ? morning : evening.length > 0 ? evening : [];

  return {
    recommendationReasons: ranked.map(
      (r) =>
        r.product.recommendation_reason_ko ??
        r.product.recommendation_reason ??
        `${r.product.brand ?? ""} ${r.product.name_ko ?? r.product.name ?? ""}`.trim()
    ),
    matchedIngredients,
    cautionIngredients,
    usageBodyArea: scenario.bodyArea,
    usageOrder,
    usageAmountFrequency:
      "제품 라벨·피부 반응에 맞춰 소량부터 사용하고, 자극 시 중단하세요.",
    expectedCosmeticScope: scenario.expectedBenefitScope,
    limitations: scenario.cosmeticLimitations,
    dermatologistFirstConditions: scenario.dermatologistEscalationConditions,
  };
}

function buildSnapshot(
  partial: Partial<ScenarioPilotSnapshot> &
    Pick<ScenarioPilotSnapshot, "status">
): ScenarioPilotSnapshot {
  const versions = getPoolArtifactVersions();
  return {
    scenarioId: partial.scenarioId ?? null,
    scenarioVersion: PILOT_SCENARIO_VERSION,
    candidatePoolVersion: versions.candidatePoolVersion,
    productEvidenceVersion: versions.productEvidenceVersion,
    matchConfidence: partial.matchConfidence ?? null,
    matchReason: partial.matchReason ?? null,
    status: partial.status,
    verifiedCount: partial.verifiedCount,
    shortageReason: partial.shortageReason,
    userMessageKo: partial.userMessageKo,
    poolCandidateCount: partial.poolCandidateCount,
    readySlotCount: partial.readySlotCount,
  };
}

function insufficientResult(
  recommendation: Recommendation,
  match: ReturnType<typeof matchPilotScenario>,
  scenarioId: string,
  verifiedCount: number,
  shortageReason: string
): ScenarioPilotPhase2Result {
  const snapshot = buildSnapshot({
    status: "insufficient_verified_candidates",
    scenarioId,
    matchConfidence: match?.confidence ?? null,
    matchReason: match?.reason ?? null,
    verifiedCount,
    shortageReason,
    userMessageKo: PILOT_INSUFFICIENT_USER_MESSAGE_KO,
    readySlotCount: verifiedCount,
  });

  return {
    status: "insufficient_verified_candidates",
    ranked: [],
    recommendation: {
      ...recommendation,
      scenarioPilot: snapshot,
      notRecommendedReasons: [
        ...(recommendation.notRecommendedReasons ?? []),
        shortageReason,
        PILOT_INSUFFICIENT_USER_MESSAGE_KO,
      ],
    },
    match,
    snapshot,
    details: match?.scenario
      ? buildDetails(recommendation, [], match.scenario)
      : null,
    usedScenarioPoolOnly: true,
  };
}

export type RunScenarioPilotPhase2Input = {
  recommendation: Recommendation;
  fetchCandidatesBySlugs: (slugs: string[]) => Promise<CandidateProduct[]>;
  shippingCountry?: string | null;
};

/**
 * Phase 2 pilot recommendation pipeline.
 * Bypasses full-catalog scan; uses scenario pool recommendation_ready only.
 */
export async function runScenarioPilotPhase2(
  input: RunScenarioPilotPhase2Input
): Promise<ScenarioPilotPhase2Result> {
  const { recommendation, fetchCandidatesBySlugs, shippingCountry } = input;

  if (recommendation.managementLevel === "urgent_check") {
    const snapshot = buildSnapshot({ status: "blocked" });
    return {
      status: "blocked",
      ranked: [],
      recommendation: { ...recommendation, scenarioPilot: snapshot },
      match: null,
      snapshot,
      details: null,
      usedScenarioPoolOnly: true,
    };
  }

  const matchInput = recommendationToScenarioMatchInput(recommendation);
  const match = matchPilotScenario(matchInput);

  if (!match) {
    const snapshot = buildSnapshot({
      status: "no_match",
      matchReason: "no_pilot_scenario_match",
    });
    return {
      status: "no_match",
      ranked: [],
      recommendation: {
        ...recommendation,
        scenarioPilot: snapshot,
        notRecommendedReasons: [
          ...(recommendation.notRecommendedReasons ?? []),
          "검증된 시나리오 풀에 매칭되지 않아 제품 추천을 제공하지 않습니다.",
        ],
      },
      match: null,
      snapshot,
      details: null,
      usedScenarioPoolOnly: true,
    };
  }

  const scenarioId = match.scenario.scenarioId;

  if (isPilotInsufficientScenario(scenarioId)) {
    const verifiedCount = getPilotReadyCountFromReport(scenarioId);
    const shortageReason = `${scenarioId}: recommendation_ready=${verifiedCount} (<${PILOT_FINAL_RECOMMENDATION_MIN}); pilot phase 2 does not wire D/E runtime.`;
    return insufficientResult(
      recommendation,
      match,
      scenarioId,
      verifiedCount,
      shortageReason
    );
  }

  if (!isPilotRuntimeAbcScenario(scenarioId)) {
    const snapshot = buildSnapshot({
      status: "no_match",
      scenarioId,
      matchConfidence: match.confidence,
      matchReason: match.reason,
    });
    return {
      status: "no_match",
      ranked: [],
      recommendation: { ...recommendation, scenarioPilot: snapshot },
      match,
      snapshot,
      details: null,
      usedScenarioPoolOnly: true,
    };
  }

  const readySlugs = getReadySlugsForScenario(scenarioId).filter(
    (slug) => !isRegionalSkuExcludedForKr(slug)
  );

  if (readySlugs.length < PILOT_FINAL_RECOMMENDATION_MIN) {
    return insufficientResult(
      recommendation,
      match,
      scenarioId,
      readySlugs.length,
      `${scenarioId}: recommendation_ready slots=${readySlugs.length} (<${PILOT_FINAL_RECOMMENDATION_MIN}) after regional filter.`
    );
  }

  const slugSet = new Set(readySlugs);
  const fetched = await fetchCandidatesBySlugs(readySlugs);
  const poolCandidates = fetched.filter((p) => {
    const slug = (p.slug ?? "").trim().toLowerCase();
    return slug && slugSet.has(slug) && !isRegionalSkuExcludedForKr(slug);
  });

  const { eligible: sellable } = filterCandidatesByOfferAvailability(
    poolCandidates,
    CORE_RECOMMEND_OFFER_COUNTRY
  );

  let offerPool = sellable;
  if (isRiskLevel(recommendation)) {
    offerPool = filterOutStimulatingActives(offerPool);
  }

  const { safe, excludedCount, incompleteCount } = filterCandidatesBySafety(
    offerPool,
    recommendation
  );

  const withStats: Recommendation = {
    ...recommendation,
    safetyExcludedCount: excludedCount,
    safetyIncompleteCount: incompleteCount,
  };

  if (safe.length < PILOT_FINAL_RECOMMENDATION_MIN) {
    return insufficientResult(
      withStats,
      match,
      scenarioId,
      safe.length,
      `${scenarioId}: verified offer + safety pass=${safe.length} (<${PILOT_FINAL_RECOMMENDATION_MIN}); no padding.`
    );
  }

  let ranked = rankProducts(withStats, safe);
  ranked = applyPilotPersonalReranking(withStats, ranked, {
    country: shippingCountry ?? CORE_RECOMMEND_OFFER_COUNTRY,
  });

  const brandCap = resolveBrandCap(match.scenario, false);
  const brandCapped = applyBrandCap(
    ranked.map((r) => ({
      ...r,
      brand: r.product.brand ?? "",
    })),
    brandCap
  );
  ranked = brandCapped.map((row) => ({
    product: row.product,
    score: row.score,
    matchedIngredients: row.matchedIngredients,
    excludedIngredients: row.excludedIngredients,
  }));

  const withMatchEvidence = filterRankedByMatchEvidence(ranked);
  const top = clampTopNWithoutPadding(
    withMatchEvidence,
    RANKED_PRODUCTS_TOP_N
  );

  if (top.length < PILOT_FINAL_RECOMMENDATION_MIN) {
    return insufficientResult(
      withStats,
      match,
      scenarioId,
      top.length,
      `${scenarioId}: match-evidence pass=${top.length} (<${PILOT_FINAL_RECOMMENDATION_MIN}); no padding.`
    );
  }

  const snapshot = buildSnapshot({
    status: "ok",
    scenarioId,
    matchConfidence: match.confidence,
    matchReason: match.reason,
    verifiedCount: top.length,
    poolCandidateCount: poolCandidates.length,
    readySlotCount: readySlugs.length,
  });

  const details = buildDetails(withStats, top, match.scenario);

  return {
    status: "ok",
    ranked: top,
    recommendation: {
      ...withStats,
      scenarioPilot: snapshot,
      scenarioPilotDetails: details,
    },
    match,
    snapshot,
    details,
    usedScenarioPoolOnly: true,
  };
}
