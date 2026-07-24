/**
 * T07-05 pipeline — full dry-run orchestration:
 * HIRA ingestion → institution enrichment → symptom evidence → publishable gate.
 * Fixture / dry-run only. Never publishes. Never writes DB.
 */

import { createHash } from "node:crypto";
import { runFixtureSeoulDermatologyIngestion } from "../seoulDermatologyIngestion";
import { runFixtureInstitutionDetailEnrichment } from "../institutionDetailEnrichment";
import { runFixtureSymptomEvidenceReview } from "../symptomEvidenceReview";
import {
  accumulateTotals,
  buildAuditArtifact,
  buildCsvSummary,
  buildStatusReasonCounts,
  emptyTotals,
} from "./audit";
import {
  proveCommercialIndependence,
  scoreClinicFitIgnoringCommercial,
} from "./commercialIndependence";
import { FIXTURE_NOW_ISO, getFixtureGateCandidates } from "./fixtures";
import { buildOneTimeHumanActions } from "./humanActions";
import {
  assertUnsafeNeverPublic,
  evaluatePublishableGate,
} from "./publishableGate";
import type {
  AdminDryRunMode,
  AdminDryRunPublishableGateResult,
  AdminDryRunStageSummary,
  AdminGateCandidateInput,
} from "./types";
import { ADMIN_DRY_RUN_PUBLISHABLE_GATE_TASK_ID } from "./types";

function newRunId(nowIso: string): string {
  const stamp = nowIso.replace(/[:.]/g, "-");
  const suffix = createHash("sha256")
    .update(`t07-05:${stamp}`)
    .digest("hex")
    .slice(0, 8);
  return `t07-05-${stamp.slice(0, 19)}-${suffix}`;
}

export type RunAdminDryRunPublishableGateInput = {
  mode?: AdminDryRunMode;
  candidates?: AdminGateCandidateInput[];
  now?: string;
  /** When false, skip upstream fixture stage runners (unit gate-only). Default true. */
  runUpstreamStages?: boolean;
};

async function runUpstreamStageSummaries(
  nowIso: string,
): Promise<AdminDryRunStageSummary[]> {
  const ingestion = await runFixtureSeoulDermatologyIngestion({
    now: new Date(nowIso),
  });
  const enrichment = await runFixtureInstitutionDetailEnrichment({
    now: new Date(nowIso),
  });
  const symptom = runFixtureSymptomEvidenceReview(nowIso);

  return [
    {
      stage: "hira_ingestion",
      taskId: ingestion.taskId,
      ok: ingestion.audit.ok && ingestion.publishAllowed === false,
      recordCount: ingestion.candidates.length,
      notesKo: [
        `모드=${ingestion.mode} · candidateReady=${ingestion.totals.candidateReady} · publishAllowed=false`,
      ],
    },
    {
      stage: "institution_enrichment",
      taskId: enrichment.taskId,
      ok: enrichment.audit.ok && enrichment.publishAllowed === false,
      recordCount: enrichment.candidates.length,
      notesKo: [
        `모드=${enrichment.mode} · enriched=${enrichment.totals.enriched} · publishAllowed=false`,
      ],
    },
    {
      stage: "symptom_evidence_review",
      taskId: symptom.taskId,
      ok: symptom.audit.ok && symptom.publishAllowed === false,
      recordCount: symptom.records.length,
      notesKo: [
        `모드=${symptom.mode} · publishEligible=${symptom.totals.publishEligible} · crawlAttempted=false`,
      ],
    },
  ];
}

export async function runAdminDryRunPublishableGate(
  input: RunAdminDryRunPublishableGateInput = {},
): Promise<AdminDryRunPublishableGateResult> {
  const mode = input.mode ?? "fixture";
  const generatedAt = input.now ?? new Date().toISOString();
  const runId = newRunId(generatedAt);
  const candidates = input.candidates ?? getFixtureGateCandidates();
  const runUpstream = input.runUpstreamStages !== false;

  const stageSummaries: AdminDryRunStageSummary[] = runUpstream
    ? await runUpstreamStageSummaries(generatedAt)
    : [
        {
          stage: "hira_ingestion",
          taskId: "T07-02",
          ok: true,
          recordCount: 0,
          notesKo: ["upstream skipped (gate-only)"],
        },
        {
          stage: "institution_enrichment",
          taskId: "T07-03",
          ok: true,
          recordCount: 0,
          notesKo: ["upstream skipped (gate-only)"],
        },
        {
          stage: "symptom_evidence_review",
          taskId: "T07-04",
          ok: true,
          recordCount: 0,
          notesKo: ["upstream skipped (gate-only)"],
        },
      ];

  const inputsById = new Map(candidates.map((c) => [c.recordId, c]));
  const records = candidates.map((candidate) => {
    const scores = scoreClinicFitIgnoringCommercial({
      symptomMatchCount: candidate.dermatologyDeptOfficial === true ? 1 : 0,
      hasOfficialDept: candidate.dermatologyDeptOfficial === true,
      specialistCount: candidate.dermatologySpecialistCount,
      evidenceStrength: candidate.enrichmentEvidenceStrength,
    });
    return evaluatePublishableGate(candidate, generatedAt, scores);
  });

  stageSummaries.push({
    stage: "admin_publishable_gate",
    taskId: ADMIN_DRY_RUN_PUBLISHABLE_GATE_TASK_ID,
    ok: true,
    recordCount: records.length,
    notesKo: [
      `평가 ${records.length}건 · 공개 0 · publishAllowed=false`,
    ],
  });

  const totals = emptyTotals();
  for (const record of records) {
    accumulateTotals(totals, record);
  }
  const statusReasonCounts = buildStatusReasonCounts(records);
  const commercialIndependence = proveCommercialIndependence(
    new Date(generatedAt),
  );
  const humanActions = buildOneTimeHumanActions();

  const safety = assertUnsafeNeverPublic(records, inputsById);
  const anyPublic = records.some((r) => r.publicVisible || r.publishAllowed);
  const fixturePublishable = records.some(
    (r) => r.isFixture && r.structurallyPublishable,
  );
  const stagesOk = stageSummaries.every((s) => s.ok);
  const ok =
    safety.ok &&
    !anyPublic &&
    !fixturePublishable &&
    commercialIndependence.organicOrderUnchanged &&
    commercialIndependence.clinicalFitOrderUnchanged &&
    stagesOk &&
    totals.publicVisible === 0 &&
    totals.publishAllowed === 0;

  const notesKo = [
    `모드=${mode} · runId=${runId}`,
    safety.ok ? "unsafe→public 위반 없음" : `위반: ${safety.violations.join(", ")}`,
    commercialIndependence.organicOrderUnchanged
      ? "Organic 순위 불변 확인"
      : "Organic 순위 변경됨(실패)",
    commercialIndependence.clinicalFitOrderUnchanged
      ? "clinical fit 순위/점수 불변 확인"
      : "clinical fit 변경됨(실패)",
  ];

  const audit = buildAuditArtifact({
    runId,
    mode,
    generatedAt,
    totals,
    statusReasonCounts,
    stageSummaries,
    commercialIndependence,
    humanActions,
    records,
    ok,
    notesKo,
  });

  return {
    taskId: ADMIN_DRY_RUN_PUBLISHABLE_GATE_TASK_ID,
    mode,
    runId,
    generatedAt,
    records,
    totals,
    statusReasonCounts,
    stageSummaries,
    commercialIndependence,
    humanActions,
    audit,
    csvSummary: buildCsvSummary(statusReasonCounts, totals),
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    publishAllowed: false,
  };
}

export async function runFixtureAdminDryRunPublishableGate(
  now?: string,
): Promise<AdminDryRunPublishableGateResult> {
  return runAdminDryRunPublishableGate({
    mode: "fixture",
    candidates: getFixtureGateCandidates(),
    now: now ?? FIXTURE_NOW_ISO,
    runUpstreamStages: true,
  });
}
