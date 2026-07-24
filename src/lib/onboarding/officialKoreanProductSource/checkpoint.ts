/**
 * Resumable manifest checkpoint helpers (P3-T01).
 */

import { DEFAULT_MANIFEST_SLICE_SIZE } from "./constants";
import { OFFICIAL_KR_PRODUCT_SOURCE_TASK_ID } from "./types";
import type {
  OfficialKrProductIngestionMode,
  ResumableManifestCheckpoint,
} from "./types";

export function createEmptyCheckpoint(input: {
  runId: string;
  mode: OfficialKrProductIngestionMode;
  nowIso: string;
  pendingSourceIds?: string[];
  safeEndpoint?: string | null;
}): ResumableManifestCheckpoint {
  return {
    runId: input.runId,
    taskId: OFFICIAL_KR_PRODUCT_SOURCE_TASK_ID,
    status: "running",
    startedAt: input.nowIso,
    updatedAt: input.nowIso,
    mode: input.mode,
    lastCompletedIndex: -1,
    processedSourceIds: [],
    pendingSourceIds: input.pendingSourceIds ?? [],
    processedCandidateIds: [],
    failureReason: null,
    safeEndpoint: input.safeEndpoint ?? null,
  };
}

export function markSliceCompleted(
  checkpoint: ResumableManifestCheckpoint,
  input: {
    completedThroughIndex: number;
    sourceIds: string[];
    candidateIds: string[];
    nowIso: string;
    safeEndpoint?: string | null;
    hasMore: boolean;
    remainingSourceIds: string[];
  },
): ResumableManifestCheckpoint {
  const processedSourceIds = Array.from(
    new Set([...checkpoint.processedSourceIds, ...input.sourceIds]),
  ).sort();
  const processedCandidateIds = Array.from(
    new Set([...checkpoint.processedCandidateIds, ...input.candidateIds]),
  ).sort();
  return {
    ...checkpoint,
    updatedAt: input.nowIso,
    lastCompletedIndex: input.completedThroughIndex,
    processedSourceIds,
    processedCandidateIds,
    pendingSourceIds: input.remainingSourceIds,
    status: input.hasMore ? "running" : "completed",
    failureReason: null,
    safeEndpoint: input.safeEndpoint ?? checkpoint.safeEndpoint,
  };
}

export function markCheckpointFailed(
  checkpoint: ResumableManifestCheckpoint,
  reason: string,
  nowIso: string,
): ResumableManifestCheckpoint {
  return {
    ...checkpoint,
    updatedAt: nowIso,
    status: "failed",
    failureReason: reason,
  };
}

export function markCheckpointPaused(
  checkpoint: ResumableManifestCheckpoint,
  nowIso: string,
): ResumableManifestCheckpoint {
  return {
    ...checkpoint,
    updatedAt: nowIso,
    status: "paused",
  };
}

/** Resume start index: lastCompletedIndex + 1 (or 0). */
export function resolveResumeIndex(
  checkpoint: ResumableManifestCheckpoint,
): number {
  if (checkpoint.lastCompletedIndex < 0) return 0;
  return checkpoint.lastCompletedIndex + 1;
}

export { DEFAULT_MANIFEST_SLICE_SIZE };
