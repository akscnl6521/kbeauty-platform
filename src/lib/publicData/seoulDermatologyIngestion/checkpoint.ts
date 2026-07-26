/**
 * Pagination checkpoint helpers for resumable Seoul dermatology ingestion.
 */

import { SEOUL_DERMATOLOGY_INGESTION_TASK_ID } from "./types";
import type {
  PaginationCheckpoint,
  SeoulDermatologyIngestionMode,
} from "./types";
import { DEFAULT_INGESTION_PAGE_SIZE } from "./constants";

export function createEmptyCheckpoint(input: {
  runId: string;
  mode: SeoulDermatologyIngestionMode;
  nowIso: string;
  numOfRows?: number;
  safeEndpoint?: string | null;
}): PaginationCheckpoint {
  return {
    runId: input.runId,
    taskId: SEOUL_DERMATOLOGY_INGESTION_TASK_ID,
    status: "running",
    startedAt: input.nowIso,
    updatedAt: input.nowIso,
    mode: input.mode,
    pageNo: 1,
    numOfRows: input.numOfRows ?? DEFAULT_INGESTION_PAGE_SIZE,
    totalCount: null,
    pagesCompleted: [],
    nextPageNo: 1,
    processedInstitutionIds: [],
    pendingInstitutionIds: [],
    failureReason: null,
    safeEndpoint: input.safeEndpoint ?? null,
  };
}

export function markPageCompleted(
  checkpoint: PaginationCheckpoint,
  input: {
    pageNo: number;
    totalCount: number | null;
    institutionIds: string[];
    nowIso: string;
    safeEndpoint?: string | null;
    hasMore: boolean;
  },
): PaginationCheckpoint {
  const pagesCompleted = Array.from(
    new Set([...checkpoint.pagesCompleted, input.pageNo]),
  ).sort((a, b) => a - b);
  const processedInstitutionIds = Array.from(
    new Set([...checkpoint.processedInstitutionIds, ...input.institutionIds]),
  ).sort();
  const nextPageNo = input.hasMore ? input.pageNo + 1 : null;
  return {
    ...checkpoint,
    updatedAt: input.nowIso,
    pageNo: input.pageNo,
    totalCount: input.totalCount ?? checkpoint.totalCount,
    pagesCompleted,
    nextPageNo,
    processedInstitutionIds,
    pendingInstitutionIds: [],
    status: input.hasMore ? "running" : "completed",
    failureReason: null,
    safeEndpoint: input.safeEndpoint ?? checkpoint.safeEndpoint,
  };
}

export function markCheckpointFailed(
  checkpoint: PaginationCheckpoint,
  reason: string,
  nowIso: string,
): PaginationCheckpoint {
  return {
    ...checkpoint,
    updatedAt: nowIso,
    status: "failed",
    failureReason: reason,
    nextPageNo: checkpoint.nextPageNo,
  };
}

export function markCheckpointPaused(
  checkpoint: PaginationCheckpoint,
  nowIso: string,
): PaginationCheckpoint {
  return {
    ...checkpoint,
    updatedAt: nowIso,
    status: "paused",
  };
}

/** Resume page: prefer nextPageNo, else last completed + 1, else 1. */
export function resolveResumePageNo(checkpoint: PaginationCheckpoint): number {
  if (checkpoint.nextPageNo != null && checkpoint.nextPageNo > 0) {
    return checkpoint.nextPageNo;
  }
  if (checkpoint.pagesCompleted.length > 0) {
    return Math.max(...checkpoint.pagesCompleted) + 1;
  }
  return 1;
}
