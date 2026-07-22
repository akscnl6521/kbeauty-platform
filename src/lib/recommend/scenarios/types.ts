/**
 * Recommendation scenario model (Phase 0/1).
 * Scenarios define candidate pools; user modifiers only re-rank within the pool.
 * Not a Cartesian product of all axes.
 */

export const SCENARIO_SENSITIVITY_LEVELS = [
  "low",
  "moderate",
  "high",
] as const;
export type ScenarioSensitivityLevel =
  (typeof SCENARIO_SENSITIVITY_LEVELS)[number];

export const SCENARIO_BODY_AREAS = [
  "face",
  "eye_area",
  "neck",
  "lips",
  "scalp",
  "body",
] as const;
export type ScenarioBodyArea = (typeof SCENARIO_BODY_AREAS)[number];

/** Canonical concern keys aligned with evidence / concernAliases. */
export const SCENARIO_PRIMARY_CONCERNS = [
  "redness",
  "dryness",
  "sensitivity",
  "acne",
  "pigmentation",
  "antiaging",
  "pores",
  "uv",
  "barrier",
] as const;
export type ScenarioPrimaryConcern =
  (typeof SCENARIO_PRIMARY_CONCERNS)[number];

export const SCENARIO_PRODUCT_CATEGORIES = [
  "cleanser",
  "toner",
  "toner_pad",
  "essence",
  "serum",
  "ampoule",
  "emulsion",
  "cream",
  "moisturizer",
  "sunscreen",
  "eye_cream",
  "mist",
  "mask",
  "spot_treatment",
] as const;
export type ScenarioProductCategory =
  (typeof SCENARIO_PRODUCT_CATEGORIES)[number];

export const CANDIDATE_ROLES = [
  "popular",
  "safety",
  "rising",
  "value",
  "emerging",
] as const;
export type CandidateRole = (typeof CANDIDATE_ROLES)[number];

export const PRODUCT_READINESS_STATES = [
  "trend_candidate",
  "catalog_ready",
  "ingredient_candidate",
  "recommendation_ready",
  "review_required",
  "unavailable",
] as const;
export type ProductReadinessState =
  (typeof PRODUCT_READINESS_STATES)[number];

export type RequiredProductEvidence = {
  identityConfirmed: boolean;
  ingredientsOrTrustedEvidence: boolean;
  imageRequired: boolean;
  minOffers: number;
  safetyFilterApplicable: boolean;
  noCriticalSourceConflict: boolean;
};

export type RecommendationScenario = {
  scenarioId: string;
  displayNameKo: string;
  primaryConcern: ScenarioPrimaryConcern;
  secondaryConcerns: ScenarioPrimaryConcern[];
  productCategory: ScenarioProductCategory;
  bodyArea: ScenarioBodyArea;
  sensitivityLevel: ScenarioSensitivityLevel;
  requiredProductEvidence: RequiredProductEvidence;
  prohibitedOrCautionIngredients: string[];
  expectedBenefitScope: string;
  cosmeticLimitations: string;
  dermatologistEscalationConditions: string[];
  candidatePoolSize: 10;
  finalRecommendationMin: 3;
  finalRecommendationMax: 5;
  brandCapDefault: 2;
  brandCapMaxWithEvidence: 3;
  priorityArea:
    | "redness_sensitive"
    | "dry_barrier"
    | "acne_sebum"
    | "uv_suncare"
    | "aging_firmness"
    | "eye_neck";
  marketPriority: "KR";
  status: "active" | "draft";
};

/** User axes that do NOT create new pools ? only re-rank within a pool. */
export type ScenarioRankingModifiers = {
  ageGroup?: string | null;
  climate?: string | null;
  country?: string | null;
  budgetRange?: string | null;
  currentRoutine?: string[] | null;
  avoidIngredients?: string[] | null;
  allergies?: string[] | null;
  purchaseAvailability?: "in_stock_preferred" | "any" | null;
};

export type ScenarioMatchInput = {
  primaryConcern: string;
  secondaryConcerns?: string[];
  productCategory?: string | null;
  bodyArea?: string | null;
  sensitivityLevel?: ScenarioSensitivityLevel | string | null;
  managementLevel?: string | null;
};

export const DEFAULT_REQUIRED_EVIDENCE: RequiredProductEvidence = {
  identityConfirmed: true,
  ingredientsOrTrustedEvidence: true,
  imageRequired: true,
  minOffers: 1,
  safetyFilterApplicable: true,
  noCriticalSourceConflict: true,
};
