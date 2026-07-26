/**
 * Resumable institution detail enrichment pipeline (T07-03).
 * Official HIRA MadmDtlInfoService · bounded concurrency · cache/checkpoint.
 * Never publishes · never writes Production/Staging DB.
 */

import { createHash } from "node:crypto";
import {
  createPublicDataApiClient,
  type PublicDataClientOptions,
} from "../client";
import {
  accumulateTotals,
  buildEnrichmentAuditArtifact,
  emptyEnrichmentTotals,
} from "./audit";
import {
  createDetailCache,
  getFreshCacheEntry,
  putCacheEntry,
  snapshotCache,
  type DetailCacheStore,
} from "./cache";
import {
  createEmptyEnrichmentCheckpoint,
  markEnrichmentPaused,
  markInstitutionProcessed,
  resolvePendingIds,
} from "./checkpoint";
import { mapWithConcurrency } from "./concurrency";
import {
  DEFAULT_ENRICHMENT_CONCURRENCY,
  HIRA_DEPT_INFO_SAFE_URL,
  MAX_ENRICHMENT_CONCURRENCY,
  SYMPTOM_EXPERTISE_SEPARATION_NOTE_KO,
} from "./constants";
import {
  buildDermatologistEvidence,
  emptySymptomExpertiseClaim,
} from "./evidence";
import {
  createFixtureDetailFetcher,
  getFixtureEnrichmentCandidates,
} from "./fixtures";
import type {
  DetailCacheEntry,
  DetailFetchResponse,
  EnrichmentCheckpoint,
  EnrichmentRowStatus,
  InstitutionDetailEnrichmentMode,
  InstitutionDetailEnrichmentResult,
  InstitutionDetailFetcher,
  InstitutionEnrichedCandidate,
  InstitutionEnrichmentInputCandidate,
  ManualReviewReasonCode,
} from "./types";
import { INSTITUTION_DETAIL_ENRICHMENT_TASK_ID } from "./types";

function newRunId(nowIso: string): string {
  const stamp = nowIso.replace(/[:.]/g, "-");
  const suffix = createHash("sha256")
    .update(`${stamp}:${Math.random()}`)
    .digest("hex")
    .slice(0, 8);
  return `t07-03-${stamp.slice(0, 19)}-${suffix}`;
}

function clampConcurrency(n: number | undefined): number {
  const raw = n ?? DEFAULT_ENRICHMENT_CONCURRENCY;
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_ENRICHMENT_CONCURRENCY;
  return Math.min(MAX_ENRICHMENT_CONCURRENCY, Math.floor(raw));
}

export function createLiveDetailFetcher(
  opts?: PublicDataClientOptions,
): InstitutionDetailFetcher {
  const client = createPublicDataApiClient(opts);
  return {
    async departments(ykiho: string): Promise<DetailFetchResponse> {
      const result = await client.getDepartmentInfo(ykiho);
      return {
        ok: result.ok && Boolean(result.data),
        items: result.data?.body.items ?? [],
        safeEndpoint: result.meta.safeEndpoint,
        usedFixture: result.meta.usedFixture,
        retryable: result.error?.retryable ?? false,
        errorCode: result.error?.code ?? null,
        errorMessageKo: result.error?.messageKo ?? null,
      };
    },
    async facility(ykiho: string): Promise<DetailFetchResponse> {
      const result = await client.getFacilityInfo(ykiho);
      return {
        ok: result.ok && Boolean(result.data),
        items: result.data?.body.items ?? [],
        safeEndpoint: result.meta.safeEndpoint,
        usedFixture: result.meta.usedFixture,
        retryable: result.error?.retryable ?? false,
        errorCode: result.error?.code ?? null,
        errorMessageKo: result.error?.messageKo ?? null,
      };
    },
  };
}

function resolveStatus(input: {
  failure: InstitutionEnrichedCandidate["failure"];
  manualReviewReasons: ManualReviewReasonCode[];
  evidenceStrength: string;
  dermatologyDeptOfficial: boolean | null;
}): EnrichmentRowStatus {
  if (input.failure?.retryable) return "failed_retryable";
  if (input.failure && !input.failure.retryable) return "failed_terminal";
  if (
    input.manualReviewReasons.includes("conflicting_department_sources") ||
    input.manualReviewReasons.includes("dermatology_name_without_official_dept")
  ) {
    return "needs_manual_review";
  }
  if (
    input.manualReviewReasons.includes("department_payload_empty") ||
    input.manualReviewReasons.includes("specialist_count_absent") ||
    input.manualReviewReasons.includes("partial_enrichment")
  ) {
    return "partial";
  }
  if (input.dermatologyDeptOfficial != null) return "enriched";
  return "partial";
}

async function enrichOne(input: {
  candidate: InstitutionEnrichmentInputCandidate;
  fetcher: InstitutionDetailFetcher;
  cache: DetailCacheStore;
  nowIso: string;
  now: Date;
  fetchFacility: boolean;
}): Promise<{
  row: InstitutionEnrichedCandidate;
  outcome: "ok" | "retryable" | "terminal" | "cache";
  safeEndpoint: string | null;
}> {
  const { candidate, fetcher, cache, nowIso, now } = input;
  const cached = getFreshCacheEntry(cache, candidate.institutionId, now);

  let departmentItems: Array<
    Record<string, string | number | boolean | null>
  > = [];
  let facilityItems: Array<
    Record<string, string | number | boolean | null>
  > = [];
  let usedFixture = Boolean(candidate.fixtureOnly);
  let safeEndpoint: string | null = HIRA_DEPT_INFO_SAFE_URL;
  let cacheHit = false;
  let failure: InstitutionEnrichedCandidate["failure"] = null;
  let outcome: "ok" | "retryable" | "terminal" | "cache" = "ok";

  if (cached) {
    departmentItems = cached.departmentItems;
    facilityItems = cached.facilityItems;
    usedFixture = cached.usedFixture;
    safeEndpoint = cached.safeEndpoint;
    cacheHit = true;
    outcome = "cache";
  } else {
    const dept = await fetcher.departments(candidate.institutionId);
    safeEndpoint = dept.safeEndpoint;
    usedFixture = dept.usedFixture || usedFixture;

    if (!dept.ok) {
      failure = dept.retryable
        ? {
            retryable: true,
            code: dept.errorCode ?? "upstream_error",
            messageKo: dept.errorMessageKo ?? "기관상세 조회 실패(재시도 가능)",
            attempt: 1,
            nextRetryEligible: true,
          }
        : {
            retryable: false,
            code: dept.errorCode ?? "upstream_error",
            messageKo: dept.errorMessageKo ?? "기관상세 조회 실패(종료)",
            attempt: 1,
            nextRetryEligible: false,
          };
      outcome = dept.retryable ? "retryable" : "terminal";

      const emptyEvidence = buildDermatologistEvidence({
        name: candidate.name,
        departmentItems: [],
        priorDepartmentCode: candidate.priorDepartmentCode,
        priorDepartmentName: candidate.priorDepartmentName,
        verifiedAt: nowIso,
        sourceUrl: safeEndpoint ?? HIRA_DEPT_INFO_SAFE_URL,
      });
      const manualReviewReasons = [...emptyEvidence.manualReviewReasons];
      if (!dept.retryable && dept.errorCode === "auth_failed") {
        manualReviewReasons.push("upstream_auth_failed");
      }
      if (!dept.retryable && dept.errorCode === "parse_failed") {
        manualReviewReasons.push("upstream_parse_failed");
      }

      const status = resolveStatus({
        failure,
        manualReviewReasons,
        evidenceStrength: emptyEvidence.evidence.evidenceStrength,
        dermatologyDeptOfficial:
          emptyEvidence.evidence.dermatologyDeptOfficial,
      });

      return {
        row: {
          candidateId: candidate.candidateId,
          institutionId: candidate.institutionId,
          name: candidate.name,
          status,
          dermatologistEvidence: emptyEvidence.evidence,
          symptomExpertise: emptySymptomExpertiseClaim(),
          failure,
          manualReviewReasons,
          cacheHit: false,
          publishAllowed: false,
          fixtureOnly: usedFixture,
          enrichedAt: nowIso,
        },
        outcome,
        safeEndpoint,
      };
    }

    departmentItems = dept.items;
    if (input.fetchFacility && fetcher.facility) {
      const fac = await fetcher.facility(candidate.institutionId);
      if (fac.ok) facilityItems = fac.items;
    }

    const entry: DetailCacheEntry = {
      institutionId: candidate.institutionId,
      fetchedAt: nowIso,
      departmentItems,
      facilityItems,
      usedFixture,
      safeEndpoint: safeEndpoint ?? HIRA_DEPT_INFO_SAFE_URL,
    };
    putCacheEntry(cache, entry);
  }

  const { evidence, manualReviewReasons: baseReasons } =
    buildDermatologistEvidence({
      name: candidate.name,
      departmentItems,
      priorDepartmentCode: candidate.priorDepartmentCode,
      priorDepartmentName: candidate.priorDepartmentName,
      verifiedAt: nowIso,
      sourceUrl: safeEndpoint ?? HIRA_DEPT_INFO_SAFE_URL,
    });

  const manualReviewReasons = [...baseReasons];
  if (
    evidence.dermatologyDeptOfficial === true &&
    evidence.dermatologySpecialistCount == null &&
    !manualReviewReasons.includes("specialist_count_absent")
  ) {
    manualReviewReasons.push("specialist_count_absent");
  }

  // facility fetch is optional metadata only — does not invent specialist status
  void facilityItems;

  const status = resolveStatus({
    failure: null,
    manualReviewReasons,
    evidenceStrength: evidence.evidenceStrength,
    dermatologyDeptOfficial: evidence.dermatologyDeptOfficial,
  });

  // Cache hits that succeed still report skipped_cached when only cache used?
  // Spec: skipped_cached for pure cache — keep enriched/partial primary; flag via cacheHit.
  const finalStatus: EnrichmentRowStatus =
    cacheHit && status === "enriched" ? "skipped_cached" : status;

  return {
    row: {
      candidateId: candidate.candidateId,
      institutionId: candidate.institutionId,
      name: candidate.name,
      status: finalStatus,
      dermatologistEvidence: evidence,
      symptomExpertise: emptySymptomExpertiseClaim(),
      failure: null,
      manualReviewReasons,
      cacheHit,
      publishAllowed: false,
      fixtureOnly: usedFixture,
      enrichedAt: nowIso,
    },
    outcome: cacheHit ? "cache" : "ok",
    safeEndpoint,
  };
}

export type RunInstitutionDetailEnrichmentInput = {
  mode?: InstitutionDetailEnrichmentMode;
  candidates?: InstitutionEnrichmentInputCandidate[];
  fetcher?: InstitutionDetailFetcher;
  checkpoint?: EnrichmentCheckpoint;
  /** Prior cache entries for resume. */
  cacheSeed?: DetailCacheEntry[];
  concurrency?: number;
  /** Max institutions to process this invocation (resume remainder). */
  maxInstitutions?: number;
  /** Also call facility info (optional; does not affect specialist evidence). */
  fetchFacility?: boolean;
  now?: Date;
  runId?: string;
  env?: NodeJS.ProcessEnv;
};

export async function runInstitutionDetailEnrichment(
  input: RunInstitutionDetailEnrichmentInput = {},
): Promise<InstitutionDetailEnrichmentResult> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const mode: InstitutionDetailEnrichmentMode =
    input.mode ?? (input.fetcher ? "dry_run" : "fixture");

  const candidates: InstitutionEnrichmentInputCandidate[] =
    input.candidates ??
    (mode === "fixture" ? getFixtureEnrichmentCandidates() : []);

  const fetcher: InstitutionDetailFetcher =
    input.fetcher ??
    (mode === "live_blocked"
      ? createLiveDetailFetcher({
          env: input.env,
          allowFixtureFallback: false,
          config: { mode: "live" },
        })
      : createFixtureDetailFetcher());

  const concurrency = clampConcurrency(input.concurrency);
  const allIds = candidates.map((c) => c.institutionId);
  const pendingIds = resolvePendingIds(allIds, input.checkpoint ?? null);

  const runId = input.checkpoint?.runId ?? input.runId ?? newRunId(nowIso);
  let checkpoint =
    input.checkpoint ??
    createEmptyEnrichmentCheckpoint({
      runId,
      mode,
      nowIso,
      pendingInstitutionIds: pendingIds,
      concurrency,
    });

  // Sync pending from resume resolution
  checkpoint = {
    ...checkpoint,
    pendingInstitutionIds: pendingIds,
    concurrency,
    updatedAt: nowIso,
  };

  const cache = createDetailCache(input.cacheSeed);
  const byId = new Map(candidates.map((c) => [c.institutionId, c]));
  const maxN = input.maxInstitutions ?? Number.POSITIVE_INFINITY;
  const batchIds = pendingIds.slice(0, maxN);
  const deferredIds = pendingIds.slice(batchIds.length);

  const batchCandidates = batchIds
    .map((id) => byId.get(id))
    .filter((c): c is InstitutionEnrichmentInputCandidate => Boolean(c));

  const batchResults = await mapWithConcurrency(
    batchCandidates,
    concurrency,
    async (candidate) =>
      enrichOne({
        candidate,
        fetcher,
        cache,
        nowIso,
        now,
        fetchFacility: input.fetchFacility ?? false,
      }),
  );

  const enrichedRows: InstitutionEnrichedCandidate[] = [];
  let safeEndpoint: string | null = checkpoint.safeEndpoint;

  for (const result of batchResults) {
    enrichedRows.push(result.row);
    safeEndpoint = result.safeEndpoint ?? safeEndpoint;
    checkpoint = markInstitutionProcessed(checkpoint, {
      institutionId: result.row.institutionId,
      nowIso,
      outcome: result.outcome,
      safeEndpoint: result.safeEndpoint,
    });
  }

  // Re-queue deferred as pending if maxInstitutions truncated
  if (deferredIds.length > 0) {
    checkpoint = {
      ...markEnrichmentPaused(checkpoint, nowIso),
      pendingInstitutionIds: deferredIds,
    };
  } else if (
    checkpoint.status === "running" &&
    checkpoint.pendingInstitutionIds.length === 0
  ) {
    checkpoint = { ...checkpoint, status: "completed", updatedAt: nowIso };
  }

  const totals = emptyEnrichmentTotals();
  totals.inputCandidates = candidates.length;
  for (const row of enrichedRows) {
    accumulateTotals(totals, row);
  }

  const ok =
    checkpoint.status !== "failed" &&
    (mode === "fixture" || mode === "dry_run" || mode === "live_blocked");

  const audit = buildEnrichmentAuditArtifact({
    runId,
    mode,
    generatedAt: nowIso,
    checkpoint,
    totals,
    candidates: enrichedRows,
    safeEndpoint,
    ok,
    notesKo: [
      "기관상세(getDgsbjtInfo)로 진료과목·전문의 수만 공식 필드에서 수집",
      "상호명만으로 피부과/전문의 판정 금지 · 미확인 값은 null 유지",
      SYMPTOM_EXPERTISE_SEPARATION_NOTE_KO,
      "게시·Production 쓰기 금지",
      `concurrency=${concurrency}`,
      mode === "live_blocked"
        ? "live_blocked: 실호출 경로 준비 · 이번 실행은 게시/DB 쓰기 없음"
        : `mode=${mode}`,
    ],
  });

  return {
    taskId: INSTITUTION_DETAIL_ENRICHMENT_TASK_ID,
    mode,
    runId,
    generatedAt: nowIso,
    candidates: enrichedRows,
    checkpoint,
    totals,
    audit,
    cacheSnapshot: snapshotCache(cache),
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    publishAllowed: false,
  };
}

/** Convenience: full fixture dry-run. */
export async function runFixtureInstitutionDetailEnrichment(
  overrides?: Omit<
    RunInstitutionDetailEnrichmentInput,
    "mode" | "fetcher" | "candidates"
  > & { candidates?: InstitutionEnrichmentInputCandidate[] },
): Promise<InstitutionDetailEnrichmentResult> {
  return runInstitutionDetailEnrichment({
    ...overrides,
    mode: "fixture",
    fetcher: createFixtureDetailFetcher(),
    candidates: overrides?.candidates ?? getFixtureEnrichmentCandidates(),
  });
}
