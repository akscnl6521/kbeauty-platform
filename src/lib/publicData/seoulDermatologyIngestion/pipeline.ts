/**
 * Resumable Seoul dermatology candidate ingestion pipeline (T07-02).
 * Uses official HIRA fields · pagination checkpoints · deterministic dedupe.
 * Never publishes · never writes Production/Staging DB.
 */

import { createHash } from "node:crypto";
import { SEOUL_SIDO_CD } from "../config";
import {
  createPublicDataApiClient,
  type PublicDataClientOptions,
} from "../client";
import { buildAuditArtifact } from "./audit";
import {
  createEmptyCheckpoint,
  markCheckpointFailed,
  markPageCompleted,
  resolveResumePageNo,
} from "./checkpoint";
import {
  DEFAULT_INGESTION_PAGE_SIZE,
  HIRA_DERMATOLOGY_DEPT_CODES,
} from "./constants";
import { dedupeCandidates } from "./dedupe";
import { evaluateCandidateFilters } from "./filter";
import { createFixturePageFetcher } from "./fixtures";
import { buildCandidateId, mapHiraItemToFields } from "./mapCandidate";
import { applyStalePolicy } from "./stalePolicy";
import type {
  PaginationCheckpoint,
  SeoulDermatologyCandidate,
  SeoulDermatologyIngestionMode,
  SeoulDermatologyIngestionResult,
  SeoulDermatologyIngestionTotals,
  SeoulDermatologyPageFetcher,
} from "./types";
import { SEOUL_DERMATOLOGY_INGESTION_TASK_ID } from "./types";

function newRunId(nowIso: string): string {
  const stamp = nowIso.replace(/[:.]/g, "-");
  const suffix = createHash("sha256")
    .update(`${stamp}:${Math.random()}`)
    .digest("hex")
    .slice(0, 8);
  return `t07-02-${stamp.slice(0, 19)}-${suffix}`;
}

function asRecord(
  item: Record<string, string | number | boolean | null>,
): Record<string, unknown> {
  return item as Record<string, unknown>;
}

export function createLivePageFetcher(
  opts?: PublicDataClientOptions,
): SeoulDermatologyPageFetcher {
  const client = createPublicDataApiClient(opts);
  return {
    async listPage(req) {
      const result = await client.listHospitals({
        sidoCd: req.sidoCd,
        dgsbjtCd: req.dgsbjtCd,
        pageNo: req.pageNo,
        numOfRows: req.numOfRows,
      });
      return {
        ok: result.ok && Boolean(result.data),
        items: result.data?.body.items ?? [],
        pageNo: result.data?.body.pageNo ?? req.pageNo,
        numOfRows: result.data?.body.numOfRows ?? req.numOfRows,
        totalCount: result.data?.body.totalCount ?? null,
        safeEndpoint: result.meta.safeEndpoint,
        usedFixture: result.meta.usedFixture,
        errorMessageKo: result.error?.messageKo ?? null,
      };
    },
    async departments(ykiho: string) {
      const result = await client.getDepartmentInfo(ykiho);
      return {
        ok: result.ok && Boolean(result.data),
        items: result.data?.body.items ?? [],
        safeEndpoint: result.meta.safeEndpoint,
        usedFixture: result.meta.usedFixture,
        errorMessageKo: result.error?.messageKo ?? null,
      };
    },
  };
}

export type RunSeoulDermatologyIngestionInput = {
  mode?: SeoulDermatologyIngestionMode;
  fetcher?: SeoulDermatologyPageFetcher;
  /** Resume from prior checkpoint (same runId preserved). */
  checkpoint?: PaginationCheckpoint;
  /** Max pages to fetch this invocation (default: all remaining). */
  maxPages?: number;
  numOfRows?: number;
  /**
   * Dermatology dept code for list filter.
   * Default: primary official code. Pass `null` to skip list-level dept filter
   * (still validates via department API / official fields).
   */
  dgsbjtCd?: string | null;
  sidoCd?: string;
  now?: Date;
  /** When true, skip department API and rely on list-embedded dept fields only. */
  skipDepartmentLookup?: boolean;
  /** Prior candidates to merge when resuming (deduped again at end). */
  priorCandidates?: SeoulDermatologyCandidate[];
  runId?: string;
  env?: NodeJS.ProcessEnv;
};

function emptyTotals(): SeoulDermatologyIngestionTotals {
  return {
    pagesFetched: 0,
    rawItems: 0,
    seoulPass: 0,
    dermatologyPass: 0,
    filteredOut: 0,
    duplicates: 0,
    uniqueCandidates: 0,
    stale: 0,
    needsRefresh: 0,
    candidateReady: 0,
  };
}

export async function runSeoulDermatologyIngestion(
  input: RunSeoulDermatologyIngestionInput = {},
): Promise<SeoulDermatologyIngestionResult> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const mode: SeoulDermatologyIngestionMode =
    input.mode ??
    (input.fetcher ? "dry_run" : "fixture");

  const fetcher: SeoulDermatologyPageFetcher =
    input.fetcher ??
    (mode === "live_blocked"
      ? createLivePageFetcher({
          env: input.env,
          allowFixtureFallback: false,
          config: { mode: "live" },
        })
      : createFixturePageFetcher());

  // live_blocked means: code path exists but this autopilot run must not claim live publish.
  // When mode is live_blocked without explicit fetcher and without key, fail honestly.
  if (mode === "live_blocked" && !input.fetcher) {
    // Still allow dry structure via fixture if caller only wants contract; prefer explicit.
  }

  const runId = input.checkpoint?.runId ?? input.runId ?? newRunId(nowIso);
  let checkpoint =
    input.checkpoint ??
    createEmptyCheckpoint({
      runId,
      mode,
      nowIso,
      numOfRows: input.numOfRows ?? DEFAULT_INGESTION_PAGE_SIZE,
    });

  const sidoCd = input.sidoCd ?? SEOUL_SIDO_CD;
  const dgsbjtCd =
    input.dgsbjtCd === null
      ? undefined
      : (input.dgsbjtCd ?? HIRA_DERMATOLOGY_DEPT_CODES[0]);
  const numOfRows = input.numOfRows ?? checkpoint.numOfRows;
  const maxPages = input.maxPages ?? Number.POSITIVE_INFINITY;

  const collected: SeoulDermatologyCandidate[] = [
    ...(input.priorCandidates ?? []),
  ];
  const filterRejects: Array<{ institutionId: string; reasons: string[] }> = [];
  const totals = emptyTotals();
  let pagesFetched = 0;
  let safeEndpoint: string | null = checkpoint.safeEndpoint;
  let fatalError: string | null = null;

  let pageNo = resolveResumePageNo(checkpoint);

  while (pagesFetched < maxPages) {
    const page = await fetcher.listPage({
      pageNo,
      numOfRows,
      sidoCd,
      ...(dgsbjtCd ? { dgsbjtCd } : {}),
    });
    safeEndpoint = page.safeEndpoint;
    pagesFetched += 1;
    totals.pagesFetched += 1;

    if (!page.ok) {
      fatalError = page.errorMessageKo ?? "list_page_failed";
      checkpoint = markCheckpointFailed(checkpoint, fatalError, nowIso);
      break;
    }

    totals.rawItems += page.items.length;
    const pageInstitutionIds: string[] = [];

    for (const raw of page.items) {
      const listItem = asRecord(raw);
      const ykiho =
        typeof listItem.ykiho === "string" ? listItem.ykiho.trim() : "";
      if (ykiho) pageInstitutionIds.push(ykiho);

      let departmentItems: Array<Record<string, unknown>> | undefined;
      if (!input.skipDepartmentLookup && fetcher.departments && ykiho) {
        const dept = await fetcher.departments(ykiho);
        if (dept.ok) {
          departmentItems = dept.items.map(asRecord);
        }
      }

      // Only echo list-filter code when department lookup is skipped
      if (
        input.skipDepartmentLookup &&
        !listItem.dgsbjtCd &&
        dgsbjtCd
      ) {
        listItem.dgsbjtCd = dgsbjtCd;
      }

      const filter = evaluateCandidateFilters({
        listItem,
        departmentItems,
      });

      if (filter.pass) {
        totals.seoulPass += 1;
        totals.dermatologyPass += 1;
      } else {
        totals.filteredOut += 1;
        filterRejects.push({
          institutionId: ykiho || "unknown",
          reasons: filter.reasons,
        });
        if (ykiho) {
          const { fields, provenance } = mapHiraItemToFields({
            listItem,
            departmentCode: filter.departmentCode,
            departmentName: filter.departmentName,
            collectedAt: nowIso,
            sourceVerifiedAt: nowIso,
          });
          collected.push({
            candidateId: buildCandidateId(ykiho),
            status: "filtered_out",
            fields,
            provenance,
            filterReasons: filter.reasons,
            duplicateOf: null,
            publishAllowed: false,
            fixtureOnly: page.usedFixture,
          });
        }
        continue;
      }

      if (!ykiho) {
        totals.filteredOut += 1;
        filterRejects.push({
          institutionId: "missing",
          reasons: ["missing_ykiho"],
        });
        continue;
      }

      const { fields, provenance } = mapHiraItemToFields({
        listItem,
        departmentCode: filter.departmentCode,
        departmentName: filter.departmentName,
        collectedAt: nowIso,
        sourceVerifiedAt: nowIso,
      });

      collected.push({
        candidateId: buildCandidateId(ykiho),
        status: "discovered",
        fields,
        provenance,
        filterReasons: [],
        duplicateOf: null,
        publishAllowed: false,
        fixtureOnly: page.usedFixture || mode === "fixture",
      });
    }

    const totalCount = page.totalCount;
    const fetchedSoFar = (pageNo - 1) * numOfRows + page.items.length;
    const hasMore =
      page.items.length > 0 &&
      (totalCount == null
        ? page.items.length >= numOfRows
        : fetchedSoFar < totalCount);

    checkpoint = markPageCompleted(checkpoint, {
      pageNo,
      totalCount,
      institutionIds: pageInstitutionIds,
      nowIso,
      safeEndpoint: page.safeEndpoint,
      hasMore,
    });

    if (!hasMore) break;
    pageNo += 1;
  }

  // If paused mid-run (maxPages hit while more remain)
  if (
    checkpoint.status === "running" &&
    checkpoint.nextPageNo != null &&
    fatalError == null
  ) {
    checkpoint = {
      ...checkpoint,
      status: "paused",
      updatedAt: nowIso,
    };
  }

  const passOnly = collected.filter((c) => c.status !== "filtered_out");
  const { unique, duplicates } = dedupeCandidates(passOnly);
  totals.duplicates = duplicates.length;
  totals.uniqueCandidates = unique.length;

  const withDupes = [...unique, ...duplicates];
  const { candidates: withStale, decisions } = applyStalePolicy(withDupes, now);

  // Re-attach filtered_out for audit completeness
  const filteredOut = collected.filter((c) => c.status === "filtered_out");
  const allCandidates = [...withStale, ...filteredOut];

  for (const c of withStale) {
    if (c.status === "candidate_ready") totals.candidateReady += 1;
    if (c.status === "stale") totals.stale += 1;
    if (c.status === "needs_refresh") totals.needsRefresh += 1;
  }

  const ok = fatalError == null && (mode === "fixture" || mode === "dry_run" || mode === "live_blocked");

  const audit = buildAuditArtifact({
    runId,
    mode,
    generatedAt: nowIso,
    checkpoint,
    totals,
    candidates: allCandidates,
    staleDecisions: decisions,
    filterRejects,
    safeEndpoint,
    ok: Boolean(ok && checkpoint.status !== "failed"),
    env: input.env,
    notesKo: [
      "서울(sidoCd=110000) + 피부과(dgsbjtCd/dgsbjtCdNm 공식 필드)만 후보",
      "마케팅 상호명만으로 피부과 판정 금지",
      "게시·Production 쓰기 금지",
      mode === "live_blocked"
        ? "live_blocked: 실호출 경로 준비 · 이번 실행은 게시/DB 쓰기 없음"
        : `mode=${mode}`,
    ],
  });

  return {
    taskId: SEOUL_DERMATOLOGY_INGESTION_TASK_ID,
    mode,
    runId,
    generatedAt: nowIso,
    candidates: allCandidates,
    checkpoint,
    staleDecisions: decisions,
    totals,
    audit,
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    publishAllowed: false,
  };
}

/** Convenience: full fixture dry-run in one shot. */
export async function runFixtureSeoulDermatologyIngestion(
  overrides?: Omit<RunSeoulDermatologyIngestionInput, "mode" | "fetcher">,
): Promise<SeoulDermatologyIngestionResult> {
  return runSeoulDermatologyIngestion({
    ...overrides,
    mode: "fixture",
    fetcher: createFixturePageFetcher(),
  });
}
