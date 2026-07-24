/**
 * Resumable official Korean product source onboarding pipeline (P3-T01).
 * Official-source-first · deterministic dedupe · stale/refresh · dry-run audit.
 * Never publishes · never writes Production/Staging DB · never invents unknowns.
 */

import { createHash } from "node:crypto";
import { buildAuditArtifact } from "./audit";
import {
  createEmptyCheckpoint,
  DEFAULT_MANIFEST_SLICE_SIZE,
  markCheckpointFailed,
  markCheckpointPaused,
  markSliceCompleted,
  resolveResumeIndex,
} from "./checkpoint";
import { SAFE_ENDPOINT_NOTE } from "./constants";
import { dedupeCandidates } from "./dedupe";
import { createFixturePageFetcher } from "./fixtures";
import { mapRawToCandidate, tallyUnknownFields } from "./mapCandidate";
import { assertSourceManifestIntegrity } from "./sourceManifest";
import { applyStalePolicy } from "./stalePolicy";
import type {
  OfficialKrProductCandidate,
  OfficialKrProductIngestionMode,
  OfficialKrProductIngestionResult,
  OfficialKrProductIngestionTotals,
  OfficialKrProductPageFetcher,
  ResumableManifestCheckpoint,
} from "./types";
import { OFFICIAL_KR_PRODUCT_SOURCE_TASK_ID } from "./types";

function newRunId(nowIso: string): string {
  const stamp = nowIso.replace(/[:.]/g, "-");
  const suffix = createHash("sha256")
    .update(`${stamp}:${Math.random()}`)
    .digest("hex")
    .slice(0, 8);
  return `p3-t01-${stamp.slice(0, 19)}-${suffix}`;
}

function emptyTotals(): OfficialKrProductIngestionTotals {
  return {
    sourcesSeen: 0,
    rawItems: 0,
    officialPass: 0,
    filteredOut: 0,
    duplicates: 0,
    uniqueCandidates: 0,
    stale: 0,
    needsRefresh: 0,
    needsReview: 0,
    blockedPolicy: 0,
    candidateReady: 0,
    withIngredients: 0,
    withImages: 0,
    withVariants: 0,
    withOffers: 0,
    withUsageGuidance: 0,
    unknownFieldsPreserved: 0,
  };
}

function recomputeTotals(
  candidates: OfficialKrProductCandidate[],
  base: OfficialKrProductIngestionTotals,
): OfficialKrProductIngestionTotals {
  const totals = { ...base };
  totals.uniqueCandidates = candidates.filter(
    (c) => c.status !== "duplicate",
  ).length;
  totals.duplicates = candidates.filter((c) => c.status === "duplicate").length;
  totals.filteredOut = candidates.filter(
    (c) => c.status === "filtered_out",
  ).length;
  totals.blockedPolicy = candidates.filter(
    (c) => c.status === "blocked_policy",
  ).length;
  totals.stale = candidates.filter((c) => c.status === "stale").length;
  totals.needsRefresh = candidates.filter(
    (c) => c.status === "needs_refresh",
  ).length;
  totals.needsReview = candidates.filter(
    (c) => c.status === "needs_review",
  ).length;
  totals.candidateReady = candidates.filter(
    (c) => c.status === "candidate_ready",
  ).length;
  totals.officialPass = candidates.filter(
    (c) =>
      c.status === "candidate_ready" ||
      c.status === "needs_review" ||
      c.status === "needs_refresh" ||
      c.status === "stale",
  ).length;
  totals.withIngredients = candidates.filter((c) =>
    Boolean(c.fields.fullIngredients),
  ).length;
  totals.withImages = candidates.filter((c) => c.images.length > 0).length;
  totals.withVariants = candidates.filter((c) => c.variants.length > 0).length;
  totals.withOffers = candidates.filter((c) => c.offers.length > 0).length;
  totals.withUsageGuidance = candidates.filter(
    (c) => c.usageGuidance != null,
  ).length;
  totals.unknownFieldsPreserved = tallyUnknownFields(candidates);
  return totals;
}

export type RunOfficialKrProductIngestionInput = {
  mode?: OfficialKrProductIngestionMode;
  fetcher?: OfficialKrProductPageFetcher;
  checkpoint?: ResumableManifestCheckpoint;
  /** Max manifest slices this invocation. */
  maxSlices?: number;
  sliceSize?: number;
  now?: Date;
  priorCandidates?: OfficialKrProductCandidate[];
  runId?: string;
};

export async function runOfficialKrProductIngestion(
  input: RunOfficialKrProductIngestionInput = {},
): Promise<OfficialKrProductIngestionResult> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const mode: OfficialKrProductIngestionMode =
    input.mode ?? (input.fetcher ? "dry_run" : "fixture");

  const fetcher: OfficialKrProductPageFetcher =
    input.fetcher ?? createFixturePageFetcher();

  const runId = input.checkpoint?.runId ?? input.runId ?? newRunId(nowIso);
  let checkpoint =
    input.checkpoint ??
    createEmptyCheckpoint({
      runId,
      mode,
      nowIso,
      safeEndpoint: SAFE_ENDPOINT_NOTE,
    });

  const sliceSize = input.sliceSize ?? DEFAULT_MANIFEST_SLICE_SIZE;
  const maxSlices = input.maxSlices ?? Number.POSITIVE_INFINITY;

  const collected: OfficialKrProductCandidate[] = [
    ...(input.priorCandidates ?? []),
  ];
  const totals = emptyTotals();
  let slicesFetched = 0;
  let safeEndpoint: string | null = checkpoint.safeEndpoint;
  let fatalError: string | null = null;

  const manifestErrors = assertSourceManifestIntegrity();
  if (manifestErrors.length > 0) {
    fatalError = `manifest_integrity:${manifestErrors.join(",")}`;
    checkpoint = markCheckpointFailed(checkpoint, fatalError, nowIso);
  }

  let startIndex = resolveResumeIndex(checkpoint);

  while (!fatalError && slicesFetched < maxSlices) {
    const page = await fetcher.listManifestSlice({
      startIndex,
      limit: sliceSize,
    });
    safeEndpoint = page.safeEndpoint;
    slicesFetched += 1;
    totals.sourcesSeen += 1;
    totals.rawItems += page.items.length;

    if (!page.ok) {
      fatalError = page.errorMessageKo ?? "manifest_slice_failed";
      checkpoint = markCheckpointFailed(checkpoint, fatalError, nowIso);
      break;
    }

    const sourceIds: string[] = [];
    const candidateIds: string[] = [];

    for (const raw of page.items) {
      sourceIds.push(raw.sourceId);
      const candidate = mapRawToCandidate(raw, nowIso);
      collected.push(candidate);
      candidateIds.push(candidate.candidateId);
    }

    const completedThroughIndex = startIndex + page.items.length - 1;
    const nextIndex = startIndex + page.items.length;
    const hasMore = nextIndex < page.totalCount && page.items.length > 0;

    checkpoint = markSliceCompleted(checkpoint, {
      completedThroughIndex:
        page.items.length === 0 ? checkpoint.lastCompletedIndex : completedThroughIndex,
      sourceIds,
      candidateIds,
      nowIso,
      safeEndpoint,
      hasMore,
      remainingSourceIds: [],
    });

    if (!hasMore || page.items.length === 0) {
      checkpoint = {
        ...checkpoint,
        status: "completed",
        updatedAt: nowIso,
        pendingSourceIds: [],
      };
      break;
    }

    startIndex = nextIndex;

    if (slicesFetched >= maxSlices && hasMore) {
      checkpoint = markCheckpointPaused(checkpoint, nowIso);
      break;
    }
  }

  const { unique, duplicates } = dedupeCandidates(collected);
  const merged = [...unique, ...duplicates];
  const { candidates: afterStale, decisions } = applyStalePolicy(merged, now);
  const finalTotals = recomputeTotals(afterStale, totals);

  const audit = buildAuditArtifact({
    runId,
    mode,
    generatedAt: nowIso,
    checkpoint,
    totals: finalTotals,
    staleDecisions: decisions,
    candidates: afterStale,
    safeEndpoint,
    notesKo: fatalError
      ? [`실행 실패: ${fatalError}`]
      : undefined,
  });

  return {
    taskId: OFFICIAL_KR_PRODUCT_SOURCE_TASK_ID,
    mode,
    runId,
    generatedAt: nowIso,
    candidates: afterStale,
    checkpoint,
    staleDecisions: decisions,
    totals: finalTotals,
    audit,
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    publishAllowed: false,
    publicVisible: false,
  };
}

export async function runFixtureOfficialKrProductIngestion(
  input: Omit<RunOfficialKrProductIngestionInput, "mode" | "fetcher"> = {},
): Promise<OfficialKrProductIngestionResult> {
  return runOfficialKrProductIngestion({
    ...input,
    mode: "fixture",
    fetcher: createFixturePageFetcher(),
  });
}
