/**
 * Audit builders — JSON totals + CSV summary. No secrets.
 */

import type {
  AdminDryRunAuditArtifact,
  AdminDryRunMode,
  AdminDryRunStageSummary,
  AdminDryRunTotals,
  AdminGateRecord,
  CommercialIndependenceProof,
  GateRecordStatus,
  OneTimeHumanAction,
  PublishBlockReasonCode,
  StatusReasonCount,
} from "./types";
import { ADMIN_DRY_RUN_PUBLISHABLE_GATE_TASK_ID } from "./types";
import {
  COMMERCIAL_INDEPENDENCE_NOTE_KO,
  HUMAN_ACTION_NOTE_KO,
  NO_DB_WRITE_NOTE_KO,
  PUBLISHABLE_REQUIRES_NOTE_KO,
  UNPUBLISHED_NOTE_KO,
} from "./constants";

export function emptyTotals(): AdminDryRunTotals {
  return {
    inputRecords: 0,
    blocked: 0,
    adminReviewEligible: 0,
    structurallyPublishable: 0,
    publicVisible: 0,
    publishAllowed: 0,
    byStatus: {
      blocked: 0,
      admin_review_eligible: 0,
      structurally_publishable: 0,
      public_forbidden: 0,
    },
    byBlockReason: {},
    fixtureCount: 0,
    failedCount: 0,
    staleCount: 0,
    conflictingCount: 0,
    insufficientEvidenceCount: 0,
  };
}

export function accumulateTotals(
  totals: AdminDryRunTotals,
  record: AdminGateRecord,
): void {
  totals.inputRecords += 1;
  totals.byStatus[record.status] =
    (totals.byStatus[record.status] ?? 0) + 1;

  if (record.status === "blocked") totals.blocked += 1;
  if (record.adminReviewEligible) totals.adminReviewEligible += 1;
  if (record.structurallyPublishable) totals.structurallyPublishable += 1;
  if (record.isFixture) totals.fixtureCount += 1;

  for (const reason of record.blockReasons) {
    totals.byBlockReason[reason] = (totals.byBlockReason[reason] ?? 0) + 1;
    if (
      reason === "enrichment_failed_retryable" ||
      reason === "enrichment_failed_terminal" ||
      reason === "ingestion_failed"
    ) {
      totals.failedCount += 1;
    }
    if (
      reason === "ingestion_stale" ||
      reason === "ingestion_needs_refresh" ||
      reason === "symptom_evidence_stale"
    ) {
      totals.staleCount += 1;
    }
    if (reason === "enrichment_conflicting_source") {
      totals.conflictingCount += 1;
    }
    if (
      reason === "enrichment_insufficient_evidence" ||
      reason === "official_evidence_missing" ||
      reason === "symptom_evidence_insufficient"
    ) {
      totals.insufficientEvidenceCount += 1;
    }
  }
}

export function buildStatusReasonCounts(
  records: AdminGateRecord[],
): StatusReasonCount[] {
  const map = new Map<string, StatusReasonCount>();
  for (const record of records) {
    const reasons =
      record.blockReasons.length > 0 ? record.blockReasons : (["none"] as const);
    for (const reason of reasons) {
      const key = `${record.status}|${reason}`;
      const prev = map.get(key);
      if (prev) {
        prev.count += 1;
      } else {
        map.set(key, {
          status: record.status as GateRecordStatus,
          reason: reason as PublishBlockReasonCode | "none",
          count: 1,
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return `${a.status}:${a.reason}`.localeCompare(`${b.status}:${b.reason}`);
  });
}

export function buildCsvSummary(
  statusReasonCounts: StatusReasonCount[],
  totals: AdminDryRunTotals,
): string {
  const lines: string[] = [
    "section,status,reason,count",
    ...statusReasonCounts.map(
      (row) => `status_reason,${row.status},${row.reason},${row.count}`,
    ),
    `totals,inputRecords,,${totals.inputRecords}`,
    `totals,blocked,,${totals.blocked}`,
    `totals,adminReviewEligible,,${totals.adminReviewEligible}`,
    `totals,structurallyPublishable,,${totals.structurallyPublishable}`,
    `totals,publicVisible,,${totals.publicVisible}`,
    `totals,publishAllowed,,${totals.publishAllowed}`,
    `totals,fixtureCount,,${totals.fixtureCount}`,
    `totals,failedCount,,${totals.failedCount}`,
    `totals,staleCount,,${totals.staleCount}`,
    `totals,conflictingCount,,${totals.conflictingCount}`,
    `totals,insufficientEvidenceCount,,${totals.insufficientEvidenceCount}`,
  ];
  return `${lines.join("\n")}\n`;
}

export function buildAuditArtifact(input: {
  runId: string;
  mode: AdminDryRunMode;
  generatedAt: string;
  totals: AdminDryRunTotals;
  statusReasonCounts: StatusReasonCount[];
  stageSummaries: AdminDryRunStageSummary[];
  commercialIndependence: CommercialIndependenceProof;
  humanActions: OneTimeHumanAction[];
  records: AdminGateRecord[];
  ok: boolean;
  notesKo?: string[];
}): AdminDryRunAuditArtifact {
  return {
    taskId: ADMIN_DRY_RUN_PUBLISHABLE_GATE_TASK_ID,
    generatedAt: input.generatedAt,
    mode: input.mode,
    runId: input.runId,
    ok: input.ok,
    totals: input.totals,
    statusReasonCounts: input.statusReasonCounts,
    stageSummaries: input.stageSummaries,
    commercialIndependence: input.commercialIndependence,
    humanActions: input.humanActions,
    sampleRecords: input.records.slice(0, 20).map((r) => ({
      recordId: r.recordId,
      status: r.status,
      blockReasons: r.blockReasons,
      structurallyPublishable: r.structurallyPublishable,
      adminReviewEligible: r.adminReviewEligible,
      isFixture: r.isFixture,
    })),
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    publishAllowed: false,
    publicVisibleCount: 0,
    secretsPresent: false,
    notesKo: [
      UNPUBLISHED_NOTE_KO,
      PUBLISHABLE_REQUIRES_NOTE_KO,
      COMMERCIAL_INDEPENDENCE_NOTE_KO,
      NO_DB_WRITE_NOTE_KO,
      HUMAN_ACTION_NOTE_KO,
      ...(input.notesKo ?? []),
    ],
  };
}
