/**
 * Unified automated refresh + exception operations pipeline (P3-T03).
 * Fixture / dry-run only — never auto-publishes · never destructive updates.
 */

import { createHash } from "node:crypto";
import { buildAdminReviewManifest } from "./adminReviewManifest";
import { buildAutomatedRefreshAudit } from "./audit";
import {
  advanceCheckpointDryRun,
  createEmptyRefreshCheckpoint,
  resolvePendingEntityIds,
} from "./checkpoint";
import { buildDueQueue } from "./dueQueue";
import { prioritizeExceptions } from "./exceptionPriority";
import { createAutomatedRefreshFixtures } from "./fixtures";
import { buildRetryBackoffPlan } from "./retryBackoff";
import {
  assertSchedulerCommandsSafe,
  listSchedulerReadyCommands,
} from "./schedulerCommands";
import { buildSourceChangeDiffs } from "./sourceChangeDiff";
import { applyStaleStatus } from "./staleDetection";
import type {
  AutomatedRefreshMode,
  AutomatedRefreshRunResult,
  RefreshCheckpoint,
  RefreshEntityKind,
  RefreshEntityRecord,
} from "./types";
import { AUTOMATED_REFRESH_TASK_ID } from "./types";

function newRunId(nowIso: string, schedule: string): string {
  const stamp = nowIso.replace(/[:.]/g, "-");
  const suffix = createHash("sha256")
    .update(`${stamp}:p3-t03:${schedule}:${Math.random()}`)
    .digest("hex")
    .slice(0, 8);
  return `p3-t03-${stamp.slice(0, 19)}-${suffix}`;
}

function scheduleFor(
  filter: RefreshEntityKind | "unified",
): RefreshCheckpoint["schedule"] {
  if (filter === "product") return "product_daily";
  if (filter === "clinic") return "clinic_twice_weekly";
  return "unified";
}

function scheduleHintFor(filter: RefreshEntityKind | "unified"): string {
  if (filter === "product") {
    return "product_daily_artifact_only";
  }
  if (filter === "clinic") {
    return "clinic_twice_weekly_artifact_only";
  }
  return "unified_artifact_only_no_production_schedule";
}

export type RunAutomatedRefreshOpsInput = {
  mode: AutomatedRefreshMode;
  entities?: RefreshEntityRecord[];
  now?: Date;
  entityKind?: RefreshEntityKind | "unified";
  priorCheckpoint?: RefreshCheckpoint | null;
  /** Map entityId → failure outcome for dry-run checkpoint advancement. */
  failureOutcomeMap?: Record<string, "retryable" | "terminal">;
  runId?: string;
};

/**
 * Run unified refresh ops. Never writes DB · never publishes · never creates
 * Production schedules or paid infra.
 */
export function runAutomatedRefreshOps(
  input: RunAutomatedRefreshOpsInput,
): AutomatedRefreshRunResult {
  if (input.mode === "live_blocked") {
    throw new Error(
      "live_blocked: 실 운영 갱신은 사람/스케줄러 승인 후. 이 파이프라인은 fixture/dry_run만 허용.",
    );
  }

  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const entityFilter = input.entityKind ?? "unified";
  const rawEntities =
    input.entities ?? createAutomatedRefreshFixtures();
  const scoped =
    entityFilter === "unified"
      ? rawEntities
      : rawEntities.filter((e) => e.entityKind === entityFilter);

  const entities = scoped.map((e) => ({
    ...applyStaleStatus(e, now),
    isFixture: input.mode === "fixture" ? true : e.isFixture,
    isDryRunRecord: true,
    allowPublicSurface: false,
  }));

  const allIds = entities.map((e) => e.entityId);
  const pendingIds = resolvePendingEntityIds(
    allIds,
    input.priorCheckpoint ?? null,
  );
  const runId =
    input.runId ??
    input.priorCheckpoint?.runId ??
    newRunId(nowIso, scheduleFor(entityFilter));

  let checkpoint =
    input.priorCheckpoint ??
    createEmptyRefreshCheckpoint({
      runId,
      mode: input.mode,
      schedule: scheduleFor(entityFilter),
      nowIso,
      pendingEntityIds: pendingIds,
    });

  // Only process still-pending ids in this dry-run step
  checkpoint = {
    ...checkpoint,
    pendingEntityIds: pendingIds,
    updatedAt: nowIso,
  };

  const failureOutcomeMap: Record<string, "retryable" | "terminal"> = {
    ...(input.failureOutcomeMap ?? {}),
  };
  for (const e of entities) {
    if (
      e.refreshStatus === "refresh_failed" &&
      e.failureCount > 0 &&
      e.failureCount < 5 &&
      !(e.entityId in failureOutcomeMap)
    ) {
      failureOutcomeMap[e.entityId] = "retryable";
    }
    if (
      (e.refreshStatus === "source_unavailable" || e.failureCount >= 5) &&
      !(e.entityId in failureOutcomeMap)
    ) {
      failureOutcomeMap[e.entityId] = "terminal";
    }
  }

  checkpoint = advanceCheckpointDryRun({
    checkpoint,
    nowIso,
    failureOutcomeMap,
  });

  const dueQueue = buildDueQueue(entities, {
    now,
    entityKind: entityFilter,
    scheduleHint: scheduleHintFor(entityFilter),
  });

  const diffs = buildSourceChangeDiffs(entities);
  const exceptions = prioritizeExceptions({ entities, diffs });
  const adminManifest = buildAdminReviewManifest({
    runId,
    dueItems: dueQueue.items,
    exceptions,
    now,
  });

  let retryScheduled = 0;
  let retryExhausted = 0;
  for (const e of entities) {
    if (e.failureCount <= 0) continue;
    const plan = buildRetryBackoffPlan({
      failureCount: e.failureCount,
      now,
      retryable: e.refreshStatus !== "blocked",
    });
    if (plan.exhausted) retryExhausted += 1;
    else if (plan.retryable) retryScheduled += 1;
  }

  const schedulerCommands = listSchedulerReadyCommands();
  assertSchedulerCommandsSafe(schedulerCommands);

  const audit = buildAutomatedRefreshAudit({
    mode: input.mode,
    runId,
    generatedAt: nowIso,
    entities,
    due: dueQueue,
    exceptions,
    checkpoint,
    retryScheduled,
    retryExhausted,
  });

  return {
    taskId: AUTOMATED_REFRESH_TASK_ID,
    mode: input.mode,
    runId,
    generatedAt: nowIso,
    entities,
    dueQueue,
    exceptions,
    diffs,
    checkpoint,
    adminManifest,
    audit,
    schedulerCommands,
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    publishAllowed: false,
    publicVisible: false,
    destructiveUpdateAllowed: false,
    autoPublishAttempted: false,
  };
}

export function runFixtureAutomatedRefreshOps(input?: {
  now?: Date;
  entityKind?: RefreshEntityKind | "unified";
  priorCheckpoint?: RefreshCheckpoint | null;
}): AutomatedRefreshRunResult {
  return runAutomatedRefreshOps({
    mode: "fixture",
    entities: createAutomatedRefreshFixtures(),
    now: input?.now,
    entityKind: input?.entityKind,
    priorCheckpoint: input?.priorCheckpoint ?? null,
  });
}

/** Safety proof helper used by selftests. */
export function assertNoAutoPublishOrDestructiveUpdate(
  result: AutomatedRefreshRunResult,
): void {
  if (result.publishAllowed !== false) {
    throw new Error("publishAllowed must be false");
  }
  if (result.autoPublishAttempted !== false) {
    throw new Error("autoPublishAttempted must be false");
  }
  if (result.destructiveUpdateAllowed !== false) {
    throw new Error("destructiveUpdateAllowed must be false");
  }
  if (result.databaseTouched !== false) {
    throw new Error("databaseTouched must be false");
  }
  if (result.writeAttempted !== false) {
    throw new Error("writeAttempted must be false");
  }
  if (result.productionTouched !== false) {
    throw new Error("productionTouched must be false");
  }
  if (result.adminManifest.publishAllowed !== false) {
    throw new Error("adminManifest.publishAllowed must be false");
  }
  if (result.adminManifest.destructiveUpdateAllowed !== false) {
    throw new Error("adminManifest.destructiveUpdateAllowed must be false");
  }
  if (result.audit.autoPublishAttempted !== false) {
    throw new Error("audit.autoPublishAttempted must be false");
  }
  if (result.audit.externalScheduleCreated !== false) {
    throw new Error("audit.externalScheduleCreated must be false");
  }
  for (const cmd of result.schedulerCommands) {
    if (cmd.publishAllowed !== false || cmd.destructiveUpdateAllowed !== false) {
      throw new Error(`scheduler ${cmd.id} must block publish/destructive`);
    }
    if (cmd.productionScheduleCreated !== false || cmd.externalPaidInfra !== false) {
      throw new Error(`scheduler ${cmd.id} must not create paid/prod schedules`);
    }
  }
  for (const e of result.entities) {
    if (e.allowPublicSurface !== false) {
      throw new Error(`${e.entityId}: allowPublicSurface must be false`);
    }
  }
}
