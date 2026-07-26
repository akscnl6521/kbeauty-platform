/**
 * Dry-run audit artifact builder (P3-T01).
 */

import type {
  OfficialKrProductAuditArtifact,
  OfficialKrProductCandidate,
  OfficialKrProductIngestionMode,
  OfficialKrProductIngestionTotals,
  ResumableManifestCheckpoint,
  StaleRefreshDecision,
} from "./types";
import { OFFICIAL_KR_PRODUCT_SOURCE_TASK_ID } from "./types";

export function buildAuditArtifact(input: {
  runId: string;
  mode: OfficialKrProductIngestionMode;
  generatedAt: string;
  checkpoint: ResumableManifestCheckpoint;
  totals: OfficialKrProductIngestionTotals;
  staleDecisions: StaleRefreshDecision[];
  candidates: OfficialKrProductCandidate[];
  safeEndpoint: string | null;
  notesKo?: string[];
}): OfficialKrProductAuditArtifact {
  const filterRejectSample = input.candidates
    .filter(
      (c) =>
        c.status === "filtered_out" ||
        c.status === "blocked_policy" ||
        c.status === "duplicate",
    )
    .slice(0, 8)
    .map((c) => ({
      candidateId: c.candidateId,
      reasons: c.filterReasons.length
        ? c.filterReasons
        : c.reviewReasons,
    }));

  const reviewReasonSample = input.candidates
    .filter((c) => c.reviewReasons.length > 0)
    .slice(0, 8)
    .map((c) => ({
      candidateId: c.candidateId,
      reasons: c.reviewReasons,
    }));

  const sampleCandidates = input.candidates
    .filter(
      (c) =>
        c.status === "candidate_ready" ||
        c.status === "needs_review" ||
        c.status === "needs_refresh" ||
        c.status === "stale",
    )
    .slice(0, 8)
    .map((c) => ({
      candidateId: c.candidateId,
      brandName: c.fields.brandName,
      productNameKo: c.fields.productNameKo,
      status: c.status,
      sourceKind: c.sourceKind,
      hasIngredients: Boolean(c.fields.fullIngredients),
    }));

  const fatal =
    input.checkpoint.status === "failed" ||
    input.candidates.some((c) => c.publishAllowed !== false) ||
    input.candidates.some((c) => c.publicVisible !== false);

  return {
    taskId: OFFICIAL_KR_PRODUCT_SOURCE_TASK_ID,
    generatedAt: input.generatedAt,
    mode: input.mode,
    runId: input.runId,
    ok: !fatal,
    checkpoint: input.checkpoint,
    totals: input.totals,
    staleDecisions: input.staleDecisions,
    candidateIds: input.candidates.map((c) => c.candidateId),
    sampleCandidates,
    reviewReasonSample,
    filterRejectSample,
    safeEndpoint: input.safeEndpoint,
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    publishAllowed: false,
    publicVisible: false,
    paidApiUsed: false,
    captchaBypassAttempted: false,
    authenticatedScrapeAttempted: false,
    notesKo: input.notesKo ?? [
      "공식 출처 우선 온보딩 dry-run — 미확인 필드는 unknown 유지.",
      "fixture·미검증 후보는 비공개 · Production 쓰기 없음.",
      "CAPTCHA·로그인·유료 API·약관 위험 자동화 금지.",
    ],
  };
}
