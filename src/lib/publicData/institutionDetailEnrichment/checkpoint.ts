/**
 * Enrichment checkpoint helpers for resumable detail lookups (T07-03).
 */

import { DEFAULT_ENRICHMENT_CONCURRENCY } from "./constants";
import {
  INSTITUTION_DETAIL_ENRICHMENT_TASK_ID,
  type EnrichmentCheckpoint,
  type InstitutionDetailEnrichmentMode,
} from "./types";

export function createEmptyEnrichmentCheckpoint(input: {
  runId: string;
  mode: InstitutionDetailEnrichmentMode;
  nowIso: string;
  pendingInstitutionIds: string[];
  concurrency?: number;
  safeEndpoint?: string | null;
}): EnrichmentCheckpoint {
  return {
    runId: input.runId,
    taskId: INSTITUTION_DETAIL_ENRICHMENT_TASK_ID,
    status: "running",
    startedAt: input.nowIso,
    updatedAt: input.nowIso,
    mode: input.mode,
    concurrency: input.concurrency ?? DEFAULT_ENRICHMENT_CONCURRENCY,
    processedInstitutionIds: [],
    pendingInstitutionIds: [...input.pendingInstitutionIds],
    failedRetryableIds: [],
    failedTerminalIds: [],
    cacheHits: 0,
    failureReason: null,
    safeEndpoint: input.safeEndpoint ?? null,
  };
}

export function markInstitutionProcessed(
  checkpoint: EnrichmentCheckpoint,
  input: {
    institutionId: string;
    nowIso: string;
    outcome: "ok" | "retryable" | "terminal" | "cache";
    safeEndpoint?: string | null;
  },
): EnrichmentCheckpoint {
  const processedInstitutionIds = Array.from(
    new Set([...checkpoint.processedInstitutionIds, input.institutionId]),
  ).sort();
  const pendingInstitutionIds = checkpoint.pendingInstitutionIds.filter(
    (id) => id !== input.institutionId,
  );
  const failedRetryableIds =
    input.outcome === "retryable"
      ? Array.from(
          new Set([...checkpoint.failedRetryableIds, input.institutionId]),
        ).sort()
      : checkpoint.failedRetryableIds.filter((id) => id !== input.institutionId);
  const failedTerminalIds =
    input.outcome === "terminal"
      ? Array.from(
          new Set([...checkpoint.failedTerminalIds, input.institutionId]),
        ).sort()
      : checkpoint.failedTerminalIds.filter((id) => id !== input.institutionId);

  return {
    ...checkpoint,
    updatedAt: input.nowIso,
    processedInstitutionIds,
    pendingInstitutionIds,
    failedRetryableIds,
    failedTerminalIds,
    cacheHits:
      input.outcome === "cache"
        ? checkpoint.cacheHits + 1
        : checkpoint.cacheHits,
    safeEndpoint: input.safeEndpoint ?? checkpoint.safeEndpoint,
    status: pendingInstitutionIds.length === 0 ? "completed" : "running",
    failureReason: null,
  };
}

export function markEnrichmentPaused(
  checkpoint: EnrichmentCheckpoint,
  nowIso: string,
): EnrichmentCheckpoint {
  return {
    ...checkpoint,
    updatedAt: nowIso,
    status: "paused",
  };
}

export function markEnrichmentFailed(
  checkpoint: EnrichmentCheckpoint,
  reason: string,
  nowIso: string,
): EnrichmentCheckpoint {
  return {
    ...checkpoint,
    updatedAt: nowIso,
    status: "failed",
    failureReason: reason,
  };
}

/** Pending ids still to process (respect prior checkpoint). */
export function resolvePendingIds(
  allIds: string[],
  checkpoint: EnrichmentCheckpoint | null,
): string[] {
  if (!checkpoint) return [...allIds];
  const done = new Set(checkpoint.processedInstitutionIds);
  return allIds.filter((id) => !done.has(id));
}
