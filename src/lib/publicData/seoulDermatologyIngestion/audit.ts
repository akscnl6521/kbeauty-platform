/**
 * Build machine-readable audit artifact for T07-02 (no secrets, no DB writes).
 */

import { assertNoSecretLeak, readDataGoKrServiceKey } from "../secrets";
import type {
  SeoulDermatologyAuditArtifact,
  SeoulDermatologyCandidate,
  SeoulDermatologyIngestionMode,
  SeoulDermatologyIngestionTotals,
  PaginationCheckpoint,
  StaleRefreshDecision,
} from "./types";
import { SEOUL_DERMATOLOGY_INGESTION_TASK_ID } from "./types";

export function buildAuditArtifact(input: {
  runId: string;
  mode: SeoulDermatologyIngestionMode;
  generatedAt: string;
  checkpoint: PaginationCheckpoint;
  totals: SeoulDermatologyIngestionTotals;
  candidates: SeoulDermatologyCandidate[];
  staleDecisions: StaleRefreshDecision[];
  filterRejects: Array<{ institutionId: string; reasons: string[] }>;
  safeEndpoint: string | null;
  ok: boolean;
  notesKo?: string[];
  env?: NodeJS.ProcessEnv;
}): SeoulDermatologyAuditArtifact {
  const ready = input.candidates.filter(
    (c) =>
      c.status === "candidate_ready" ||
      c.status === "needs_refresh" ||
      c.status === "stale",
  );
  const artifact: SeoulDermatologyAuditArtifact = {
    taskId: SEOUL_DERMATOLOGY_INGESTION_TASK_ID,
    generatedAt: input.generatedAt,
    mode: input.mode,
    runId: input.runId,
    ok: input.ok,
    checkpoint: input.checkpoint,
    totals: input.totals,
    staleDecisions: input.staleDecisions,
    candidateIds: ready.map((c) => c.candidateId).sort(),
    sampleCandidates: ready.slice(0, 10).map((c) => ({
      candidateId: c.candidateId,
      institutionId: c.fields.institutionId,
      name: c.fields.name,
      status: c.status,
      departmentCode: c.fields.departmentCode,
      departmentName: c.fields.departmentName,
    })),
    filterRejectSample: input.filterRejects.slice(0, 20),
    safeEndpoint: input.safeEndpoint,
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    publishAllowed: false,
    notesKo: input.notesKo ?? [
      "후보만 수집 · 게시(publish) 금지",
      "Production/Staging DB 쓰기 없음",
      "serviceKey는 아티팩트에 포함되지 않음",
    ],
  };

  const serialized = JSON.stringify(artifact);
  const key = readDataGoKrServiceKey(input.env ?? process.env);
  if (key) {
    assertNoSecretLeak(serialized, [key]);
  }
  if (/(?:ServiceKey|serviceKey)=(?!\[REDACTED\])[^&\s"'`]+/i.test(serialized)) {
    throw new Error("service_key_param_leak_detected");
  }

  return artifact;
}
