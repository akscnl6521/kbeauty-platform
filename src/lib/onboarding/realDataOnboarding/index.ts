/**
 * P2-T04 — Real data onboarding readiness (public barrel).
 */

export * from "./types";
export * from "./sourceManifest";
export * from "./fieldProvenance";
export * from "./staleRefreshRules";
export * from "./reviewChecklists";
export * from "./importTemplates";
export * from "./rejectionReasons";
export * from "./dryRunValidation";
export * from "./eligibility";
export * from "./fixtures";
export {
  REAL_DATA_ONBOARDING_TASK_ID,
  assertRealDataOnboardingContractIntegrity,
  formatRealDataOnboardingMarkdown,
  runRealDataOnboardingHarness,
} from "./realDataOnboarding";
