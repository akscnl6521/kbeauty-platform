/**
 * P3-T03 — Automated refresh and exception operations contracts.
 * Unified product + clinic refresh ops layer.
 * Artifact / dry-run only — never auto-publishes · never destructive DB updates.
 */

export const AUTOMATED_REFRESH_TASK_ID = "P3-T03" as const;

export type AutomatedRefreshMode = "fixture" | "dry_run" | "live_blocked";

export type RefreshEntityKind = "product" | "clinic";

/** Master-prompt §19 refresh statuses. */
export type RefreshStatus =
  | "current"
  | "refresh_due"
  | "refreshing"
  | "refresh_failed"
  | "source_unavailable"
  | "verification_required"
  | "stale_but_usable"
  | "blocked"
  | "discontinued";

export type RefreshPriority = "critical" | "high" | "medium" | "low";

export type ExceptionKind =
  | "source_changed"
  | "source_unavailable"
  | "refresh_failed"
  | "stale_evidence"
  | "missing_required_field"
  | "conflict"
  | "discontinued_suspect"
  | "manual_review_required";

export type SourceSnapshot = {
  name: string | null;
  officialUrl: string | null;
  priceAmount: number | null;
  currency: string | null;
  inStock: boolean | null;
  ingredientsFingerprint: string | null;
  imageUrl: string | null;
  operatingStatus: string | null;
  specialtyCount: number | null;
  evidenceFingerprint: string | null;
};

export type SourceFieldChange = {
  field: keyof SourceSnapshot;
  before: string | number | boolean | null;
  after: string | number | boolean | null;
};

export type RefreshEntityRecord = {
  entityId: string;
  entityKind: RefreshEntityKind;
  displayName: string;
  collectedAt: string | null;
  verifiedAt: string | null;
  refreshDueAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  failureCount: number;
  refreshStatus: RefreshStatus;
  sourceChanged: boolean;
  manualReviewRequired: boolean;
  previousSource: SourceSnapshot | null;
  currentSource: SourceSnapshot | null;
  isFixture: boolean;
  isDryRunRecord: boolean;
  /** Soft hold — never implies public publish. */
  allowPublicSurface: boolean;
  discontinued: boolean;
};

export type DueQueueItem = {
  entityId: string;
  entityKind: RefreshEntityKind;
  displayName: string;
  priority: RefreshPriority;
  refreshStatus: RefreshStatus;
  dueAt: string;
  reasons: string[];
  checks: string[];
  failureCount: number;
  nextRetryAt: string | null;
  sourceChanged: boolean;
  manualReviewRequired: boolean;
};

export type DueQueueArtifact = {
  entityKind: RefreshEntityKind | "unified";
  generatedAt: string;
  cutoffAt: string;
  scheduleHint: string;
  items: DueQueueItem[];
  totals: {
    due: number;
    byPriority: Record<RefreshPriority, number>;
    byKind: Record<RefreshEntityKind, number>;
  };
};

export type RetryBackoffPlan = {
  attempt: number;
  failureCount: number;
  delayMs: number;
  nextRetryAt: string;
  retryable: boolean;
  exhausted: boolean;
  reason: string;
};

export type RefreshCheckpoint = {
  runId: string;
  taskId: typeof AUTOMATED_REFRESH_TASK_ID;
  mode: AutomatedRefreshMode;
  schedule: "product_daily" | "clinic_twice_weekly" | "unified";
  status: "running" | "paused" | "completed" | "failed";
  startedAt: string;
  updatedAt: string;
  processedEntityIds: string[];
  pendingEntityIds: string[];
  failedRetryableIds: string[];
  failedTerminalIds: string[];
  failureReason: string | null;
};

export type SourceChangeDiff = {
  entityId: string;
  entityKind: RefreshEntityKind;
  changed: boolean;
  changes: SourceFieldChange[];
  requiresManualReview: boolean;
  reviewReasons: string[];
};

export type ExceptionQueueItem = {
  exceptionId: string;
  entityId: string;
  entityKind: RefreshEntityKind;
  displayName: string;
  kind: ExceptionKind;
  priority: RefreshPriority;
  score: number;
  reasons: string[];
  sourceChanged: boolean;
  failureCount: number;
  dueAt: string | null;
  reviewGroup: "source" | "content" | "commerce" | "identity" | "clinic";
};

export type AdminReviewManifestItem = {
  id: string;
  source: "product_refresh" | "clinic_refresh" | "exception";
  entityKind: RefreshEntityKind;
  priority: RefreshPriority;
  title: string;
  reasons: string[];
  dueAt: string | null;
  payload: {
    entityId: string;
    displayName: string;
    refreshStatus: RefreshStatus | null;
    exceptionKind: ExceptionKind | null;
    sourceChanged: boolean;
    checks: string[];
  };
};

export type AdminReviewManifest = {
  taskId: typeof AUTOMATED_REFRESH_TASK_ID;
  generatedAt: string;
  runId: string;
  items: AdminReviewManifestItem[];
  totals: {
    total: number;
    byPriority: Record<RefreshPriority, number>;
    bySource: Record<AdminReviewManifestItem["source"], number>;
  };
  publishAllowed: false;
  destructiveUpdateAllowed: false;
  databaseTouched: false;
  writeAttempted: false;
  productionTouched: false;
};

export type SchedulerCommandSpec = {
  id: "product_daily" | "clinic_twice_weekly";
  titleKo: string;
  cadence: string;
  cronUtc: string;
  cronNoteKo: string;
  npmScript: string;
  runnerScript: string;
  entityKind: RefreshEntityKind;
  producesArtifacts: string[];
  externalPaidInfra: false;
  productionScheduleCreated: false;
  publishAllowed: false;
  destructiveUpdateAllowed: false;
};

export type AutomatedRefreshAuditTotals = {
  entitiesSeen: number;
  productsSeen: number;
  clinicsSeen: number;
  due: number;
  stale: number;
  current: number;
  refreshFailed: number;
  sourceChanged: number;
  exceptions: number;
  manualReview: number;
  retryScheduled: number;
  retryExhausted: number;
  checkpointPending: number;
  fixtureNonPublic: number;
  dryRunNonPublic: number;
};

export type AutomatedRefreshAuditArtifact = {
  taskId: typeof AUTOMATED_REFRESH_TASK_ID;
  generatedAt: string;
  mode: AutomatedRefreshMode;
  runId: string;
  ok: boolean;
  totals: AutomatedRefreshAuditTotals;
  dueQueueSummary: DueQueueArtifact["totals"];
  exceptionSample: Array<{ exceptionId: string; kind: ExceptionKind; priority: RefreshPriority }>;
  checkpointStatus: RefreshCheckpoint["status"];
  schedulerCommands: SchedulerCommandSpec[];
  databaseTouched: false;
  writeAttempted: false;
  productionTouched: false;
  publishAllowed: false;
  publicVisible: false;
  destructiveUpdateAllowed: false;
  autoPublishAttempted: false;
  paidApiUsed: false;
  externalScheduleCreated: false;
  notesKo: string[];
};

export type AutomatedRefreshRunResult = {
  taskId: typeof AUTOMATED_REFRESH_TASK_ID;
  mode: AutomatedRefreshMode;
  runId: string;
  generatedAt: string;
  entities: RefreshEntityRecord[];
  dueQueue: DueQueueArtifact;
  exceptions: ExceptionQueueItem[];
  diffs: SourceChangeDiff[];
  checkpoint: RefreshCheckpoint;
  adminManifest: AdminReviewManifest;
  audit: AutomatedRefreshAuditArtifact;
  schedulerCommands: SchedulerCommandSpec[];
  databaseTouched: false;
  writeAttempted: false;
  productionTouched: false;
  publishAllowed: false;
  publicVisible: false;
  destructiveUpdateAllowed: false;
  autoPublishAttempted: false;
};
