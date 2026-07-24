/**
 * T07-04 pipeline — manifest → validate → organic lane → review queue → audit.
 * Dry-run / fixture only. No crawl, no DB write, no publish.
 */

import {
  NO_CRAWL_NOTE_KO,
  ORGANIC_SEPARATION_NOTE_KO,
  UNVERIFIED_UNPUBLISHED_NOTE_KO,
} from "./constants";
import { findManifestEntry } from "./manifest";
import {
  paidRelationshipDoesNotGrantOrganic,
  resolveOrganicEligibility,
  resolvePublishEligible,
  resolveQueueLane,
} from "./organicSeparation";
import { buildReviewQueue, formatQueueSummaryKo } from "./reviewQueue";
import {
  accumulateReviewTotals,
  buildSymptomEvidenceAudit,
  emptyReviewTotals,
} from "./audit";
import { getFixtureSymptomEvidenceInputs } from "./fixtures";
import { collectRejectionCodes, hasHardBlock } from "./validate";
import type {
  SymptomEvidenceManifestInput,
  SymptomEvidenceReviewMode,
  SymptomEvidenceReviewRecord,
  SymptomEvidenceReviewResult,
} from "./types";
import { SYMPTOM_EVIDENCE_REVIEW_TASK_ID } from "./types";

function newRunId(now: string): string {
  return `t07-04-${now.replace(/[:.]/g, "-")}`;
}

export function evaluateSymptomEvidenceRow(
  input: SymptomEvidenceManifestInput,
  reviewedAt: string,
  nowMs?: number,
): SymptomEvidenceReviewRecord {
  const rejectionCodes = collectRejectionCodes(input, nowMs);
  const manifest = findManifestEntry(input.sourceId);
  const sourceKind = manifest?.kind ?? "unknown";
  const hardBlocked = hasHardBlock(rejectionCodes);

  const organicEligibility = resolveOrganicEligibility({
    reviewerStatus: input.reviewerStatus,
    commercialRelationship: input.commercialRelationship,
    rejectionCodes,
    isFixture: input.isFixture,
  });

  const publishEligible = resolvePublishEligible({
    organicEligibility,
    reviewerStatus: input.reviewerStatus,
    isFixture: input.isFixture,
    hardBlocked,
  });

  const draft: SymptomEvidenceReviewRecord = {
    evidenceId: input.evidenceId,
    sourceId: input.sourceId,
    claimCategory: input.claimCategory,
    evidenceUrl: input.evidenceUrl.trim(),
    pageTitle: input.pageTitle.trim(),
    excerptSummary: input.excerptSummary.trim(),
    verifiedAt: input.verifiedAt,
    staleAt: input.staleAt,
    reviewerStatus: input.reviewerStatus,
    rejectionReasonCode:
      input.rejectionReasonCode ??
      (input.reviewerStatus === "rejected"
        ? "reviewer_rejected"
        : rejectionCodes[0] ?? null),
    rejectionReasonKo: input.rejectionReasonKo,
    commercialRelationship: input.commercialRelationship,
    commercialDisclosureKo: input.commercialDisclosureKo,
    clinicOrInstitutionLabel: input.clinicOrInstitutionLabel,
    sourceKind,
    accessMode: input.accessMode,
    organicEligibility,
    publishEligible,
    publishAllowed: false,
    publicVisible: false,
    isFixture: input.isFixture,
    rejectionCodes,
    queueLane: "pending",
    reviewedAt,
  };

  draft.queueLane = resolveQueueLane(draft);

  if (
    !paidRelationshipDoesNotGrantOrganic({
      commercialRelationship: draft.commercialRelationship,
      organicEligibility: draft.organicEligibility,
    })
  ) {
    // Defensive: never allow paid → organic
    draft.organicEligibility = "organic_ineligible_paid_relationship";
    draft.publishEligible = false;
    draft.queueLane = "paid_relationship_review";
  }

  return draft;
}

export type RunSymptomEvidenceReviewInput = {
  mode: SymptomEvidenceReviewMode;
  rows?: SymptomEvidenceManifestInput[];
  now?: string;
  nowMs?: number;
};

export function runSymptomEvidenceReview(
  input: RunSymptomEvidenceReviewInput,
): SymptomEvidenceReviewResult {
  const generatedAt = input.now ?? new Date().toISOString();
  const runId = newRunId(generatedAt);
  const rows = input.rows ?? getFixtureSymptomEvidenceInputs();
  const nowMs = input.nowMs ?? Date.parse(generatedAt);

  const records = rows.map((row) =>
    evaluateSymptomEvidenceRow(row, generatedAt, nowMs),
  );
  const queue = buildReviewQueue(records);
  const totals = emptyReviewTotals();
  for (const record of records) {
    accumulateReviewTotals(totals, record);
  }

  const notesKo = [
    UNVERIFIED_UNPUBLISHED_NOTE_KO,
    ORGANIC_SEPARATION_NOTE_KO,
    NO_CRAWL_NOTE_KO,
    ...formatQueueSummaryKo(queue),
    `모드=${input.mode} · DB쓰기=없음 · 게시허용=false · 크롤시도=없음`,
  ];

  const anyPublic = records.some((r) => r.publicVisible || r.publishAllowed);
  const anyPaidOrganic = records.some(
    (r) =>
      (r.commercialRelationship === "affiliate" ||
        r.commercialRelationship === "sponsored" ||
        r.commercialRelationship === "booking_fee" ||
        r.commercialRelationship === "lead_fee") &&
      r.organicEligibility === "organic_eligible",
  );
  const ok = !anyPublic && !anyPaidOrganic;

  const audit = buildSymptomEvidenceAudit({
    runId,
    mode: input.mode,
    generatedAt,
    totals,
    queue,
    records,
    ok,
    notesKo,
  });

  return {
    taskId: SYMPTOM_EVIDENCE_REVIEW_TASK_ID,
    mode: input.mode,
    runId,
    generatedAt,
    records,
    queue,
    totals,
    audit,
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    publishAllowed: false,
    crawlAttempted: false,
  };
}

export function runFixtureSymptomEvidenceReview(
  now?: string,
): SymptomEvidenceReviewResult {
  return runSymptomEvidenceReview({
    mode: "fixture",
    rows: getFixtureSymptomEvidenceInputs(),
    now: now ?? "2026-07-24T04:00:00.000Z",
    nowMs: Date.parse(now ?? "2026-07-24T04:00:00.000Z"),
  });
}
