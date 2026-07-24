/**
 * T07-03 — Institution detail enrichment + specialist evidence contracts.
 * Dry-run / fixture by default. Never publishes. Never writes Production.
 */

export const INSTITUTION_DETAIL_ENRICHMENT_TASK_ID = "T07-03" as const;

export type InstitutionDetailEnrichmentMode =
  | "fixture"
  | "dry_run"
  | "live_blocked";

/** How strongly official HIRA detail supports a specialist claim. */
export type SpecialistEvidenceStrength =
  | "none"
  | "weak"
  | "moderate"
  | "strong";

export type ConflictingSourceState =
  | "none"
  | "conflict"
  | "unresolved";

export type EnrichmentRowStatus =
  | "pending"
  | "enriched"
  | "partial"
  | "failed_retryable"
  | "failed_terminal"
  | "skipped_cached"
  | "needs_manual_review";

/** One official department row from getDgsbjtInfo. */
export type OfficialDepartmentRow = {
  departmentCode: string | null;
  departmentName: string | null;
  /**
   * Official specialist (전문의) count when present (`dgsbjtPrSftCnt`).
   * null = unknown — never invent.
   */
  specialistCount: number | null;
  specialistCountKnown: boolean;
};

/**
 * Dermatologist / board-specialty evidence from official HIRA fields only.
 * Never derived from clinic marketing names.
 */
export type DermatologistSpecialistEvidence = {
  /** True only when official dgsbjtCd/dgsbjtCdNm confirms 피부과. */
  dermatologyDeptOfficial: boolean | null;
  dermatologyDepartmentCode: string | null;
  dermatologyDepartmentName: string | null;
  /** Official 피부과 전문의 수 when known; null = unknown. */
  dermatologySpecialistCount: number | null;
  allDepartments: OfficialDepartmentRow[];
  evidenceStrength: SpecialistEvidenceStrength;
  lastVerifiedAt: string | null;
  conflictingSourceState: ConflictingSourceState;
  conflictNotesKo: string[];
  sourceService: "hira_institution_detail";
  sourceOperation: string;
  /** Safe host+path only. */
  sourceUrl: string;
};

/**
 * Symptom expertise claims are intentionally separate and not filled from
 * institution detail alone (HIRA does not encode "acne specialist" etc.).
 */
export type SymptomExpertiseClaimState = {
  /** Always false for this pipeline — symptom claims require other evidence. */
  claimedFromInstitutionDetail: false;
  claims: [];
  noteKo: string;
};

export type RetryableFailureRecord = {
  retryable: true;
  code: string;
  messageKo: string;
  attempt: number;
  nextRetryEligible: true;
};

export type TerminalFailureRecord = {
  retryable: false;
  code: string;
  messageKo: string;
  attempt: number;
  nextRetryEligible: false;
};

export type EnrichmentFailure =
  | RetryableFailureRecord
  | TerminalFailureRecord
  | null;

export type ManualReviewReasonCode =
  | "conflicting_department_sources"
  | "dermatology_name_without_official_dept"
  | "specialist_count_absent"
  | "department_payload_empty"
  | "partial_enrichment"
  | "upstream_auth_failed"
  | "upstream_parse_failed";

export type InstitutionEnrichmentInputCandidate = {
  candidateId: string;
  institutionId: string;
  name: string;
  /** Prior list-level dept (may conflict with detail). */
  priorDepartmentCode?: string | null;
  priorDepartmentName?: string | null;
  fixtureOnly?: boolean;
};

export type InstitutionEnrichedCandidate = {
  candidateId: string;
  institutionId: string;
  name: string;
  status: EnrichmentRowStatus;
  dermatologistEvidence: DermatologistSpecialistEvidence;
  symptomExpertise: SymptomExpertiseClaimState;
  failure: EnrichmentFailure;
  manualReviewReasons: ManualReviewReasonCode[];
  cacheHit: boolean;
  publishAllowed: false;
  fixtureOnly: boolean;
  enrichedAt: string;
};

export type EnrichmentCheckpoint = {
  runId: string;
  taskId: typeof INSTITUTION_DETAIL_ENRICHMENT_TASK_ID;
  status: "running" | "paused" | "completed" | "failed";
  startedAt: string;
  updatedAt: string;
  mode: InstitutionDetailEnrichmentMode;
  concurrency: number;
  processedInstitutionIds: string[];
  pendingInstitutionIds: string[];
  failedRetryableIds: string[];
  failedTerminalIds: string[];
  cacheHits: number;
  failureReason: string | null;
  safeEndpoint: string | null;
};

export type DetailCacheEntry = {
  institutionId: string;
  fetchedAt: string;
  departmentItems: Array<Record<string, string | number | boolean | null>>;
  facilityItems: Array<Record<string, string | number | boolean | null>>;
  usedFixture: boolean;
  safeEndpoint: string;
};

export type InstitutionDetailEnrichmentTotals = {
  inputCandidates: number;
  processed: number;
  enriched: number;
  partial: number;
  failedRetryable: number;
  failedTerminal: number;
  needsManualReview: number;
  cacheHits: number;
  dermatologyOfficialTrue: number;
  dermatologyOfficialFalse: number;
  dermatologyOfficialUnknown: number;
  specialistCountKnown: number;
  specialistCountUnknown: number;
  conflicts: number;
};

export type InstitutionDetailAuditArtifact = {
  taskId: typeof INSTITUTION_DETAIL_ENRICHMENT_TASK_ID;
  generatedAt: string;
  mode: InstitutionDetailEnrichmentMode;
  runId: string;
  ok: boolean;
  checkpoint: EnrichmentCheckpoint;
  totals: InstitutionDetailEnrichmentTotals;
  sampleEnriched: Array<{
    candidateId: string;
    institutionId: string;
    status: EnrichmentRowStatus;
    evidenceStrength: SpecialistEvidenceStrength;
    dermatologyDeptOfficial: boolean | null;
    dermatologySpecialistCount: number | null;
    conflictingSourceState: ConflictingSourceState;
    manualReviewReasons: ManualReviewReasonCode[];
  }>;
  safeEndpoint: string | null;
  databaseTouched: false;
  writeAttempted: false;
  productionTouched: false;
  publishAllowed: false;
  notesKo: string[];
};

export type InstitutionDetailEnrichmentResult = {
  taskId: typeof INSTITUTION_DETAIL_ENRICHMENT_TASK_ID;
  mode: InstitutionDetailEnrichmentMode;
  runId: string;
  generatedAt: string;
  candidates: InstitutionEnrichedCandidate[];
  checkpoint: EnrichmentCheckpoint;
  totals: InstitutionDetailEnrichmentTotals;
  audit: InstitutionDetailAuditArtifact;
  cacheSnapshot: DetailCacheEntry[];
  databaseTouched: false;
  writeAttempted: false;
  productionTouched: false;
  publishAllowed: false;
};

export type DetailFetchResponse = {
  ok: boolean;
  items: Array<Record<string, string | number | boolean | null>>;
  safeEndpoint: string;
  usedFixture: boolean;
  retryable: boolean;
  errorCode: string | null;
  errorMessageKo: string | null;
};

export type InstitutionDetailFetcher = {
  departments(ykiho: string): Promise<DetailFetchResponse>;
  facility?(ykiho: string): Promise<DetailFetchResponse>;
};
