/**
 * T07-05 — Admin dry-run + publishable gate contracts.
 * Orchestrates T07-02 → T07-03 → T07-04, then evaluates admin review eligibility.
 * Never publishes. Never writes Production/Staging DB.
 */

export const ADMIN_DRY_RUN_PUBLISHABLE_GATE_TASK_ID = "T07-05" as const;

export type AdminDryRunMode = "fixture" | "dry_run" | "live_blocked";

/** Pipeline stage contributing to the final gate record. */
export type DryRunStage =
  | "hira_ingestion"
  | "institution_enrichment"
  | "symptom_evidence_review"
  | "admin_publishable_gate";

/**
 * Why a record is blocked from public visibility / publishable transition.
 * Counts in audit summaries use these codes.
 */
export type PublishBlockReasonCode =
  | "fixture_cannot_publish"
  | "ingestion_failed"
  | "ingestion_filtered_out"
  | "ingestion_duplicate"
  | "ingestion_stale"
  | "ingestion_needs_refresh"
  | "enrichment_failed_retryable"
  | "enrichment_failed_terminal"
  | "enrichment_conflicting_source"
  | "enrichment_needs_manual_review"
  | "enrichment_insufficient_evidence"
  | "enrichment_partial"
  | "symptom_evidence_unverified"
  | "symptom_evidence_rejected"
  | "symptom_evidence_stale"
  | "symptom_evidence_insufficient"
  | "symptom_evidence_paid_lane"
  | "admin_approval_missing"
  | "official_evidence_missing"
  | "public_visibility_forbidden_in_dry_run";

export type GateRecordStatus =
  | "blocked"
  | "admin_review_eligible"
  | "structurally_publishable"
  | "public_forbidden";

export type CommercialRelationshipForGate =
  | "none"
  | "affiliate"
  | "sponsored"
  | "booking_fee"
  | "lead_fee";

/**
 * Unified clinic/institution row evaluated by the publishable gate.
 * Built from upstream dry-run stages + optional admin approval flags.
 */
export type AdminGateCandidateInput = {
  recordId: string;
  institutionId: string;
  name: string;
  /** From T07-02 status. */
  ingestionStatus:
    | "discovered"
    | "filtered_out"
    | "duplicate"
    | "stale"
    | "needs_refresh"
    | "candidate_ready"
    | "absent";
  /** From T07-03 status. */
  enrichmentStatus:
    | "pending"
    | "enriched"
    | "partial"
    | "failed_retryable"
    | "failed_terminal"
    | "skipped_cached"
    | "needs_manual_review"
    | "absent";
  enrichmentEvidenceStrength: "none" | "weak" | "moderate" | "strong" | "unknown";
  conflictingSource: boolean;
  dermatologyDeptOfficial: boolean | null;
  dermatologySpecialistCount: number | null;
  /** From T07-04 (linked symptom evidence, if any). */
  symptomEvidenceReviewerStatus:
    | "pending_review"
    | "approved"
    | "rejected"
    | "needs_more_evidence"
    | "stale"
    | "absent";
  symptomEvidencePublishEligible: boolean;
  commercialRelationship: CommercialRelationshipForGate;
  /** Explicit administrator approval for this dry-run row. */
  adminApproved: boolean;
  adminApprovedAt: string | null;
  adminApproverLabel: string | null;
  isFixture: boolean;
  /** Official registry / hospital page evidence present for this row. */
  hasRequiredOfficialEvidence: boolean;
};

export type AdminGateRecord = {
  recordId: string;
  institutionId: string;
  name: string;
  status: GateRecordStatus;
  blockReasons: PublishBlockReasonCode[];
  /** Structural readiness only — dry-run never sets publishAllowed/publicVisible. */
  structurallyPublishable: boolean;
  adminReviewEligible: boolean;
  publicVisible: false;
  publishAllowed: false;
  isFixture: boolean;
  commercialRelationship: CommercialRelationshipForGate;
  organicScore: number;
  clinicalFitScore: number;
  stages: DryRunStage[];
  evaluatedAt: string;
};

export type StatusReasonCount = {
  status: GateRecordStatus | string;
  reason: PublishBlockReasonCode | "none" | string;
  count: number;
};

export type AdminDryRunStageSummary = {
  stage: DryRunStage;
  taskId: string;
  ok: boolean;
  recordCount: number;
  notesKo: string[];
};

export type CommercialIndependenceProof = {
  organicOrderUnchanged: boolean;
  clinicalFitOrderUnchanged: boolean;
  organicOrderIds: string[];
  clinicalFitOrderIds: string[];
  paidNoiseOrderIds: string[];
  noteKo: string;
};

export type OneTimeHumanAction = {
  id: string;
  titleKo: string;
  stepsKo: string[];
  approvalRequired: boolean;
  stagingImport: boolean;
  productionForbidden: true;
};

export type AdminDryRunTotals = {
  inputRecords: number;
  blocked: number;
  adminReviewEligible: number;
  structurallyPublishable: number;
  publicVisible: 0;
  publishAllowed: 0;
  byStatus: Record<GateRecordStatus, number>;
  byBlockReason: Partial<Record<PublishBlockReasonCode, number>>;
  fixtureCount: number;
  failedCount: number;
  staleCount: number;
  conflictingCount: number;
  insufficientEvidenceCount: number;
};

export type AdminDryRunAuditArtifact = {
  taskId: typeof ADMIN_DRY_RUN_PUBLISHABLE_GATE_TASK_ID;
  generatedAt: string;
  mode: AdminDryRunMode;
  runId: string;
  ok: boolean;
  totals: AdminDryRunTotals;
  statusReasonCounts: StatusReasonCount[];
  stageSummaries: AdminDryRunStageSummary[];
  commercialIndependence: CommercialIndependenceProof;
  humanActions: OneTimeHumanAction[];
  sampleRecords: Array<{
    recordId: string;
    status: GateRecordStatus;
    blockReasons: PublishBlockReasonCode[];
    structurallyPublishable: boolean;
    adminReviewEligible: boolean;
    isFixture: boolean;
  }>;
  databaseTouched: false;
  writeAttempted: false;
  productionTouched: false;
  publishAllowed: false;
  publicVisibleCount: 0;
  secretsPresent: false;
  notesKo: string[];
};

export type AdminDryRunPublishableGateResult = {
  taskId: typeof ADMIN_DRY_RUN_PUBLISHABLE_GATE_TASK_ID;
  mode: AdminDryRunMode;
  runId: string;
  generatedAt: string;
  records: AdminGateRecord[];
  totals: AdminDryRunTotals;
  statusReasonCounts: StatusReasonCount[];
  stageSummaries: AdminDryRunStageSummary[];
  commercialIndependence: CommercialIndependenceProof;
  humanActions: OneTimeHumanAction[];
  audit: AdminDryRunAuditArtifact;
  csvSummary: string;
  databaseTouched: false;
  writeAttempted: false;
  productionTouched: false;
  publishAllowed: false;
};
