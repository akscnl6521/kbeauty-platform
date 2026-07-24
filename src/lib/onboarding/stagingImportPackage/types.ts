/**
 * P3-T05 — Integrated Staging import package contracts.
 * Bundles product/clinic candidates + provenance/review/duplicates/rejections/
 * refresh/commercial separation/publishable gates into one human review package.
 * Never writes Staging/Production DB. Never claims import executed.
 */

export const STAGING_IMPORT_PACKAGE_TASK_ID = "P3-T05" as const;

export type StagingImportMode = "fixture" | "dry_run" | "live_blocked";

export type StagingImportLane = "product" | "clinic";

export type StagingImportReviewState =
  | "discovered"
  | "needs_review"
  | "admin_reviewed"
  | "rejected"
  | "duplicate"
  | "staging_import_eligible"
  | "structurally_publishable"
  | "blocked";

export type StagingRefreshStatus =
  | "fresh"
  | "due"
  | "stale"
  | "needs_refresh"
  | "unknown";

export type StagingCommercialLane =
  | "organic"
  | "affiliate"
  | "sponsored"
  | "none";

export type StagingPublishableGateStatus =
  | "blocked"
  | "eligible_for_staging_review"
  | "structurally_publishable"
  | "public_forbidden";

export type StagingRejectionCode =
  | "fixture_cannot_import"
  | "provenance_incomplete"
  | "admin_approval_missing"
  | "duplicate_unresolved"
  | "rejected_upstream"
  | "refresh_stale"
  | "refresh_due"
  | "commercial_organic_contamination"
  | "publishable_gate_blocked"
  | "official_evidence_missing"
  | "production_write_forbidden"
  | "live_import_blocked";

export type StagingImportBundleSectionId =
  | "product_candidates"
  | "clinic_candidates"
  | "provenance"
  | "review_states"
  | "duplicates"
  | "rejection_reasons"
  | "refresh_status"
  | "commercial_separation"
  | "publishable_gates"
  | "human_review_package";

export type StagingImportRow = {
  importId: string;
  lane: StagingImportLane;
  sourceTaskId: string;
  sourceRecordId: string;
  displayName: string;
  reviewState: StagingImportReviewState;
  provenanceComplete: boolean;
  provenanceNotesKo: string[];
  isDuplicate: boolean;
  duplicateOf: string | null;
  rejectionReasons: StagingRejectionCode[];
  refreshStatus: StagingRefreshStatus;
  commercialLane: StagingCommercialLane;
  publishableGate: StagingPublishableGateStatus;
  /** Structural readiness only — package never executes import. */
  structurallyStagingImportEligible: boolean;
  isFixture: boolean;
  publicVisible: false;
  stagingImportExecuted: false;
};

export type StagingImportBundleSection = {
  id: StagingImportBundleSectionId;
  titleKo: string;
  purposeKo: string;
  itemCount: number;
  notesKo: string[];
};

export type StagingCommercialIndependenceProof = {
  organicOrderUnchanged: boolean;
  organicOrderIds: string[];
  paidNoiseOrderIds: string[];
  stagingEligibilityIgnoresPaidLane: boolean;
  noteKo: string;
};

export type StagingHumanReviewStep = {
  id: string;
  onceOnly: true;
  titleKo: string;
  whereKo: string;
  checkKo: string;
  passCriteriaKo: string;
  failActionKo: string;
  stagingImport: boolean;
  productionForbidden: true;
  relatedExternalIds: readonly string[];
};

export type StagingImportAutomatedCommand = {
  id: string;
  npmScript: string;
  titleKo: string;
  requiredForGate: boolean;
  kind: "focused" | "integration" | "security" | "build";
  nodeArgs: readonly string[];
};

export type StagingImportCommandRunResult = {
  commandId: string;
  npmScript: string;
  status: "pass" | "fail" | "skipped";
  exitCode: number | null;
  notesKo: string;
};

export type StagingImportTotals = {
  productRows: number;
  clinicRows: number;
  provenanceComplete: number;
  provenanceIncomplete: number;
  needsReview: number;
  adminReviewed: number;
  duplicates: number;
  rejected: number;
  refreshFresh: number;
  refreshDue: number;
  refreshStale: number;
  commercialOrganic: number;
  commercialPaid: number;
  gateBlocked: number;
  gateEligibleForStagingReview: number;
  gateStructurallyPublishable: number;
  structurallyStagingImportEligible: number;
  fixtureCount: number;
  publicVisible: 0;
  stagingImportExecuted: 0;
};

export type StagingImportAuditArtifact = {
  taskId: typeof STAGING_IMPORT_PACKAGE_TASK_ID;
  generatedAt: string;
  mode: StagingImportMode;
  runId: string;
  ok: boolean;
  totals: StagingImportTotals;
  sections: StagingImportBundleSection[];
  commercialIndependence: StagingCommercialIndependenceProof;
  sampleRows: Array<{
    importId: string;
    lane: StagingImportLane;
    reviewState: StagingImportReviewState;
    publishableGate: StagingPublishableGateStatus;
    rejectionReasons: StagingRejectionCode[];
    structurallyStagingImportEligible: boolean;
    isFixture: boolean;
  }>;
  databaseTouched: false;
  writeAttempted: false;
  productionTouched: false;
  stagingImportExecuted: false;
  publishAllowed: false;
  publicVisible: false;
  secretsPresent: false;
  notesKo: string[];
};

export type StagingImportPackageResult = {
  taskId: typeof STAGING_IMPORT_PACKAGE_TASK_ID;
  mode: StagingImportMode;
  runId: string;
  generatedAt: string;
  rows: StagingImportRow[];
  totals: StagingImportTotals;
  sections: StagingImportBundleSection[];
  commercialIndependence: StagingCommercialIndependenceProof;
  humanReviewSteps: StagingHumanReviewStep[];
  upstreamTaskIds: string[];
  audit: StagingImportAuditArtifact;
  csvSummary: string;
  databaseTouched: false;
  writeAttempted: false;
  productionTouched: false;
  stagingImportExecuted: false;
  publishAllowed: false;
  publicVisible: false;
};

export type StagingImportHumanReviewPackage = {
  taskId: typeof STAGING_IMPORT_PACKAGE_TASK_ID;
  generatedAt: string;
  branchExpected: "feature/recommendation-usage-guide-display-20260720";
  writeAttempted: false;
  stagingImportExecuted: false;
  stagingImportApprovalClaimed: false;
  mainMergeAttempted: false;
  productionDeployAttempted: false;
  publishAllowed: false;
  publicVisible: false;
  sections: StagingImportBundleSection[];
  humanReviewSteps: StagingHumanReviewStep[];
  automatedCommands: readonly StagingImportAutomatedCommand[];
  commandResults: readonly StagingImportCommandRunResult[];
  packageResult: StagingImportPackageResult | null;
  summary: {
    automatedRequired: number;
    automatedPassed: number;
    automatedFailed: number;
    automatedSkipped: number;
    productRows: number;
    clinicRows: number;
    structurallyStagingImportEligible: number;
    humanStepCount: number;
  };
  honestyNotesKo: readonly string[];
};
