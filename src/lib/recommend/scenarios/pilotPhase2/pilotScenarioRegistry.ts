import { getScenarioById } from "../krCoreScenarios";
import type { RecommendationScenario } from "../types";
import { DEFAULT_REQUIRED_EVIDENCE } from "../types";

/**
 * Pilot B — dryness/barrier serum pool (offline enrichment).
 * coreScenarioRef: kr-dryness-barrier-essence (essence in core; serum in pilot pool).
 */
export const PILOT_B_DRYNESS_BARRIER_SERUM: RecommendationScenario = {
  scenarioId: "pilot-dryness-barrier-serum",
  displayNameKo: "건조·장벽 · 세럼 (파일럿)",
  primaryConcern: "dryness",
  secondaryConcerns: ["barrier"],
  productCategory: "serum",
  bodyArea: "face",
  sensitivityLevel: "moderate",
  requiredProductEvidence: DEFAULT_REQUIRED_EVIDENCE,
  prohibitedOrCautionIngredients: ["Alcohol Denat", "Menthol"],
  expectedBenefitScope: "barrier support and hydration via serum step",
  cosmeticLimitations: "severe barrier damage needs professional care",
  dermatologistEscalationConditions: [
    "persistent stinging",
    "oozing or bleeding",
    "worsening redness",
  ],
  candidatePoolSize: 10,
  finalRecommendationMin: 3,
  finalRecommendationMax: 5,
  brandCapDefault: 2,
  brandCapMaxWithEvidence: 3,
  priorityArea: "dry_barrier",
  marketPriority: "KR",
  status: "active",
};

function requireScenario(scenarioId: string): RecommendationScenario {
  const scenario = getScenarioById(scenarioId);
  if (!scenario) {
    throw new Error(`[pilotScenarioRegistry] missing scenario: ${scenarioId}`);
  }
  return scenario;
}

/** Five pilot pools — A/B/C runtime, D/E insufficient. */
export function listPilotPhase2Scenarios(): RecommendationScenario[] {
  return [
    requireScenario("kr-redness-sensitive-cream"),
    PILOT_B_DRYNESS_BARRIER_SERUM,
    requireScenario("kr-acne-pores-toner"),
    requireScenario("kr-uv-sunscreen-sensitive"),
    requireScenario("kr-aging-eye-cream"),
  ];
}

export function getPilotPhase2ScenarioById(
  scenarioId: string
): RecommendationScenario | undefined {
  if (scenarioId === PILOT_B_DRYNESS_BARRIER_SERUM.scenarioId) {
    return PILOT_B_DRYNESS_BARRIER_SERUM;
  }
  return getScenarioById(scenarioId);
}
