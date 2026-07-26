/** Phase 2 pilot — runtime-wired scenarios (A/B/C only). */
export const PILOT_RUNTIME_ABC_SCENARIO_IDS = [
  "kr-redness-sensitive-cream",
  "pilot-dryness-barrier-serum",
  "kr-acne-pores-toner",
] as const;

export type PilotRuntimeAbcScenarioId =
  (typeof PILOT_RUNTIME_ABC_SCENARIO_IDS)[number];

/** Matched but not runtime-wired (insufficient recommendation_ready). */
export const PILOT_INSUFFICIENT_SCENARIO_IDS = [
  "kr-uv-sunscreen-sensitive",
  "kr-aging-eye-cream",
] as const;

export type PilotInsufficientScenarioId =
  (typeof PILOT_INSUFFICIENT_SCENARIO_IDS)[number];

export const PILOT_PHASE2_ALL_SCENARIO_IDS = [
  ...PILOT_RUNTIME_ABC_SCENARIO_IDS,
  ...PILOT_INSUFFICIENT_SCENARIO_IDS,
] as const;

export const PILOT_POOL_ARTIFACT_DATE = "2026-07-22" as const;

export const PILOT_SCENARIO_VERSION = "pilot-phase2-2026-07-22-v1";

export const PILOT_CANDIDATE_POOL_VERSION = `scenario-pilot-enrichment-de/${PILOT_POOL_ARTIFACT_DATE}`;

export const PILOT_PRODUCT_EVIDENCE_VERSION = `merged-evidence-pack/${PILOT_POOL_ARTIFACT_DATE}`;

/** Scenario finalRecommendationMin — no padding below this. */
export const PILOT_FINAL_RECOMMENDATION_MIN = 3;

export const PILOT_FINAL_RECOMMENDATION_MAX = 5;

export const PILOT_INSUFFICIENT_USER_MESSAGE_KO =
  "검증 제품 보강 중입니다. 현재 이 고민·카테고리에 대해 충분히 검증된 제품이 준비되지 않았습니다.";
