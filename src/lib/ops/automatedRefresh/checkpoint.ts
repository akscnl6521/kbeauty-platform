/**
 * Resume checkpoints for automated refresh runs (P3-T03).
 */

import { AUTOMATED_REFRESH_TASK_ID } from "./types";
import type {
  AutomatedRefreshMode,
  RefreshCheckpoint,
} from "./types";

export function createEmptyRefreshCheckpoint(input: {
  runId: string;
  mode: AutomatedRefreshMode;
  schedule: RefreshCheckpoint["schedule"];
  nowIso: string;
  pendingEntityIds: string[];
}): RefreshCheckpoint {
  return {
    runId: input.runId,
    taskId: AUTOMATED_REFRESH_TASK_ID,
    mode: input.mode,
    schedule: input.schedule,
    status: "running",
    startedAt: input.nowIso,
    updatedAt: input.nowIso,
    processedEntityIds: [],
    pendingEntityIds: [...input.pendingEntityIds],
    failedRetryableIds: [],
    failedTerminalIds: [],
    failureReason: null,
  };
}

export function markEntityProcessed(
  checkpoint: RefreshCheckpoint,
  input: {
    entityId: string;
    nowIso: string;
    outcome: "ok" | "retryable" | "terminal";
  },
): RefreshCheckpoint {
  const processedEntityIds = Array.from(
    new Set([...checkpoint.processedEntityIds, input.entityId]),
  ).sort();
  const pendingEntityIds = checkpoint.pendingEntityIds.filter(
    (id) => id !== input.entityId,
  );
  const failedRetryableIds =
    input.outcome === "retryable"
      ? Array.from(
          new Set([...checkpoint.failedRetryableIds, input.entityId]),
        ).sort()
      : checkpoint.failedRetryableIds.filter((id) => id !== input.entityId);
  const failedTerminalIds =
    input.outcome === "terminal"
      ? Array.from(
          new Set([...checkpoint.failedTerminalIds, input.entityId]),
        ).sort()
      : checkpoint.failedTerminalIds.filter((id) => id !== input.entityId);

  return {
    ...checkpoint,
    updatedAt: input.nowIso,
    processedEntityIds,
    pendingEntityIds,
    failedRetryableIds,
    failedTerminalIds,
    status: pendingEntityIds.length === 0 ? "completed" : "running",
    failureReason: null,
  };
}

export function markCheckpointPaused(
  checkpoint: RefreshCheckpoint,
  nowIso: string,
): RefreshCheckpoint {
  return { ...checkpoint, updatedAt: nowIso, status: "paused" };
}

export function markCheckpointFailed(
  checkpoint: RefreshCheckpoint,
  reason: string,
  nowIso: string,
): RefreshCheckpoint {
  return {
    ...checkpoint,
    updatedAt: nowIso,
    status: "failed",
    failureReason: reason,
  };
}

/** Resume: only entities not yet processed. */
export function resolvePendingEntityIds(
  allIds: string[],
  checkpoint: RefreshCheckpoint | null,
): string[] {
  if (!checkpoint) return [...allIds];
  const done = new Set(checkpoint.processedEntityIds);
  return allIds.filter((id) => !done.has(id));
}

/**
 * Advance a dry-run checkpoint over pending ids without DB writes.
 * failureOutcomeMap keys that fail as retryable/terminal.
 */
export function advanceCheckpointDryRun(input: {
  checkpoint: RefreshCheckpoint;
  nowIso: string;
  failureOutcomeMap?: Record<string, "retryable" | "terminal">;
}): RefreshCheckpoint {
  let next = { ...input.checkpoint };
  const pending = [...next.pendingEntityIds];
  for (const entityId of pending) {
    const outcome = input.failureOutcomeMap?.[entityId] ?? "ok";
    next = markEntityProcessed(next, {
      entityId,
      nowIso: input.nowIso,
      outcome,
    });
  }
  return next;
}
