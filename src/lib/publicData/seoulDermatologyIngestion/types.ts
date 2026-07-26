/**
 * T07-02 — Seoul dermatology candidate ingestion contracts.
 * Dry-run / fixture only by default. Never publishes. Never writes Production.
 */

export const SEOUL_DERMATOLOGY_INGESTION_TASK_ID = "T07-02" as const;

export type SeoulDermatologyIngestionMode = "fixture" | "dry_run" | "live_blocked";

export type SeoulDermatologyCandidateStatus =
  | "discovered"
  | "filtered_out"
  | "duplicate"
  | "stale"
  | "needs_refresh"
  | "candidate_ready";

/** Minimum public fields collected from HIRA hospital info. */
export type SeoulDermatologyCandidateFields = {
  /** Encrypted institution id (ykiho). */
  institutionId: string;
  name: string;
  address: string | null;
  /** Longitude when provided (XPos). */
  longitude: number | null;
  /** Latitude when provided (YPos). */
  latitude: number | null;
  phone: string | null;
  /** Institution type code (clCd). */
  institutionTypeCode: string | null;
  /** Institution type name (clCdNm). */
  institutionTypeName: string | null;
  sidoCode: string | null;
  sidoName: string | null;
  sgguCode: string | null;
  sgguName: string | null;
  /** Official department code when known (dgsbjtCd). */
  departmentCode: string | null;
  /** Official department name when known (dgsbjtCdNm). */
  departmentName: string | null;
  /** Source timestamps — established date from registry when present. */
  establishedDate: string | null;
  /** When this row was collected by our pipeline. */
  collectedAt: string;
  /** Last official-source verification timestamp (ISO). */
  sourceVerifiedAt: string;
};

export type FieldProvenanceEntry = {
  fieldKey: keyof SeoulDermatologyCandidateFields | string;
  valuePreview: string | null;
  sourceField: string;
  /** Safe host+path only — never includes serviceKey. */
  sourceUrl: string;
  sourceService: "hira_hospital_info" | "hira_institution_detail";
  sourceOperation: string;
  status: "present" | "absent" | "filtered" | "derived";
  noteKo: string | null;
};

export type SeoulDermatologyCandidate = {
  candidateId: string;
  status: SeoulDermatologyCandidateStatus;
  fields: SeoulDermatologyCandidateFields;
  provenance: FieldProvenanceEntry[];
  filterReasons: string[];
  duplicateOf: string | null;
  publishAllowed: false;
  fixtureOnly: boolean;
};

export type PaginationCheckpoint = {
  runId: string;
  taskId: typeof SEOUL_DERMATOLOGY_INGESTION_TASK_ID;
  status: "running" | "paused" | "completed" | "failed";
  startedAt: string;
  updatedAt: string;
  mode: SeoulDermatologyIngestionMode;
  pageNo: number;
  numOfRows: number;
  totalCount: number | null;
  pagesCompleted: number[];
  nextPageNo: number | null;
  processedInstitutionIds: string[];
  pendingInstitutionIds: string[];
  failureReason: string | null;
  /** Safe endpoint only. */
  safeEndpoint: string | null;
};

export type StaleRefreshDecision = {
  candidateId: string;
  ageDays: number | null;
  maxAgeDays: number;
  action: "fresh" | "queue_refresh" | "mark_stale" | "block_publish";
  reasonKo: string;
};

export type SeoulDermatologyIngestionTotals = {
  pagesFetched: number;
  rawItems: number;
  seoulPass: number;
  dermatologyPass: number;
  filteredOut: number;
  duplicates: number;
  uniqueCandidates: number;
  stale: number;
  needsRefresh: number;
  candidateReady: number;
};

export type SeoulDermatologyAuditArtifact = {
  taskId: typeof SEOUL_DERMATOLOGY_INGESTION_TASK_ID;
  generatedAt: string;
  mode: SeoulDermatologyIngestionMode;
  runId: string;
  ok: boolean;
  checkpoint: PaginationCheckpoint;
  totals: SeoulDermatologyIngestionTotals;
  staleDecisions: StaleRefreshDecision[];
  candidateIds: string[];
  sampleCandidates: Array<{
    candidateId: string;
    institutionId: string;
    name: string;
    status: SeoulDermatologyCandidateStatus;
    departmentCode: string | null;
    departmentName: string | null;
  }>;
  filterRejectSample: Array<{ institutionId: string; reasons: string[] }>;
  safeEndpoint: string | null;
  databaseTouched: false;
  writeAttempted: false;
  productionTouched: false;
  publishAllowed: false;
  notesKo: string[];
};

export type SeoulDermatologyIngestionResult = {
  taskId: typeof SEOUL_DERMATOLOGY_INGESTION_TASK_ID;
  mode: SeoulDermatologyIngestionMode;
  runId: string;
  generatedAt: string;
  candidates: SeoulDermatologyCandidate[];
  checkpoint: PaginationCheckpoint;
  staleDecisions: StaleRefreshDecision[];
  totals: SeoulDermatologyIngestionTotals;
  audit: SeoulDermatologyAuditArtifact;
  databaseTouched: false;
  writeAttempted: false;
  productionTouched: false;
  publishAllowed: false;
};

export type HospListPageRequest = {
  pageNo: number;
  numOfRows: number;
  sidoCd: string;
  dgsbjtCd?: string;
};

export type HospListPageResponse = {
  ok: boolean;
  items: Array<Record<string, string | number | boolean | null>>;
  pageNo: number;
  numOfRows: number;
  totalCount: number | null;
  safeEndpoint: string;
  usedFixture: boolean;
  errorMessageKo: string | null;
};

export type DeptPageResponse = {
  ok: boolean;
  items: Array<Record<string, string | number | boolean | null>>;
  safeEndpoint: string;
  usedFixture: boolean;
  errorMessageKo: string | null;
};

export type SeoulDermatologyPageFetcher = {
  listPage(req: HospListPageRequest): Promise<HospListPageResponse>;
  /** Optional department confirmation; may be omitted in fixture-only list runs. */
  departments?(ykiho: string): Promise<DeptPageResponse>;
};
