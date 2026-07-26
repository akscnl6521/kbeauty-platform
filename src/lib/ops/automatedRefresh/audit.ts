/**
 * Machine-readable audit for P3-T03 automated refresh ops.
 */

import { listSchedulerReadyCommands } from "./schedulerCommands";
import type {
  AutomatedRefreshAuditArtifact,
  AutomatedRefreshAuditTotals,
  AutomatedRefreshMode,
  DueQueueArtifact,
  ExceptionQueueItem,
  RefreshCheckpoint,
  RefreshEntityRecord,
} from "./types";
import { AUTOMATED_REFRESH_TASK_ID } from "./types";

export function emptyTotals(): AutomatedRefreshAuditTotals {
  return {
    entitiesSeen: 0,
    productsSeen: 0,
    clinicsSeen: 0,
    due: 0,
    stale: 0,
    current: 0,
    refreshFailed: 0,
    sourceChanged: 0,
    exceptions: 0,
    manualReview: 0,
    retryScheduled: 0,
    retryExhausted: 0,
    checkpointPending: 0,
    fixtureNonPublic: 0,
    dryRunNonPublic: 0,
  };
}

export function recomputeTotals(input: {
  entities: RefreshEntityRecord[];
  due: DueQueueArtifact;
  exceptions: ExceptionQueueItem[];
  checkpoint: RefreshCheckpoint;
  retryScheduled: number;
  retryExhausted: number;
}): AutomatedRefreshAuditTotals {
  const totals = emptyTotals();
  totals.entitiesSeen = input.entities.length;
  totals.due = input.due.totals.due;
  totals.exceptions = input.exceptions.length;
  totals.checkpointPending = input.checkpoint.pendingEntityIds.length;
  totals.retryScheduled = input.retryScheduled;
  totals.retryExhausted = input.retryExhausted;

  for (const e of input.entities) {
    if (e.entityKind === "product") totals.productsSeen += 1;
    else totals.clinicsSeen += 1;
    if (e.refreshStatus === "current") totals.current += 1;
    if (
      e.refreshStatus === "stale_but_usable" ||
      e.refreshStatus === "verification_required"
    ) {
      totals.stale += 1;
    }
    if (e.refreshStatus === "refresh_failed") totals.refreshFailed += 1;
    if (e.sourceChanged) totals.sourceChanged += 1;
    if (e.manualReviewRequired) totals.manualReview += 1;
    if (e.isFixture) totals.fixtureNonPublic += 1;
    if (e.isDryRunRecord) totals.dryRunNonPublic += 1;
  }
  return totals;
}

export function buildAutomatedRefreshAudit(input: {
  mode: AutomatedRefreshMode;
  runId: string;
  generatedAt: string;
  entities: RefreshEntityRecord[];
  due: DueQueueArtifact;
  exceptions: ExceptionQueueItem[];
  checkpoint: RefreshCheckpoint;
  retryScheduled: number;
  retryExhausted: number;
}): AutomatedRefreshAuditArtifact {
  const totals = recomputeTotals(input);
  const notesKo = [
    "제품·병원 통합 갱신·예외 운영 레이어(P3-T03) dry-run/fixture만 실행",
    "자동 게시·파괴적 DB 갱신·유료 인프라·Production 스케줄 생성 없음",
    "스케줄러 준비 명령은 아티팩트 전용(npm refresh:product-daily / refresh:clinic-twice-weekly)",
  ];

  return {
    taskId: AUTOMATED_REFRESH_TASK_ID,
    generatedAt: input.generatedAt,
    mode: input.mode,
    runId: input.runId,
    ok: true,
    totals,
    dueQueueSummary: input.due.totals,
    exceptionSample: input.exceptions.slice(0, 8).map((e) => ({
      exceptionId: e.exceptionId,
      kind: e.kind,
      priority: e.priority,
    })),
    checkpointStatus: input.checkpoint.status,
    schedulerCommands: listSchedulerReadyCommands(),
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    publishAllowed: false,
    publicVisible: false,
    destructiveUpdateAllowed: false,
    autoPublishAttempted: false,
    paidApiUsed: false,
    externalScheduleCreated: false,
    notesKo,
  };
}
