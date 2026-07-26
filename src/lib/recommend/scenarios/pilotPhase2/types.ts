import type { RankedProduct, Recommendation } from "@/lib/recommend/types";
import type { CandidateProduct } from "@/lib/recommend/types";
import type { RecommendationScenario } from "../types";

export type ScenarioPilotMatchConfidence = "high" | "medium" | "low";

export type PilotScenarioMatch = {
  scenario: RecommendationScenario;
  confidence: ScenarioPilotMatchConfidence;
  reason: string;
};

export type ScenarioPilotSnapshot = {
  scenarioId: string | null;
  scenarioVersion: string;
  candidatePoolVersion: string;
  productEvidenceVersion: string;
  matchConfidence: ScenarioPilotMatchConfidence | null;
  matchReason: string | null;
  status:
    | "ok"
    | "insufficient_verified_candidates"
    | "no_match"
    | "blocked";
  verifiedCount?: number;
  shortageReason?: string;
  userMessageKo?: string;
  poolCandidateCount?: number;
  readySlotCount?: number;
};

export type ScenarioPilotRecommendationDetails = {
  recommendationReasons: string[];
  matchedIngredients: string[];
  cautionIngredients: string[];
  usageBodyArea: string;
  usageOrder: string[];
  usageAmountFrequency: string;
  expectedCosmeticScope: string;
  limitations: string;
  dermatologistFirstConditions: string[];
};

export type ScenarioPilotPhase2Status =
  | "ok"
  | "insufficient_verified_candidates"
  | "no_match"
  | "blocked";

export type ScenarioPilotPhase2Result = {
  status: ScenarioPilotPhase2Status;
  ranked: RankedProduct<CandidateProduct>[];
  recommendation: Recommendation;
  match: PilotScenarioMatch | null;
  snapshot: ScenarioPilotSnapshot;
  details: ScenarioPilotRecommendationDetails | null;
  /** True when full-catalog scan was bypassed. */
  usedScenarioPoolOnly: boolean;
};

export type PilotPoolSlot = {
  productId: string;
  readiness: string;
  rejectionReason: string | null;
  roleTags: string[];
};

export type PilotScenarioPool = {
  scenarioId: string;
  brandCapDefault: number;
  affiliateOrAdInScore: boolean;
  slots: PilotPoolSlot[];
};
