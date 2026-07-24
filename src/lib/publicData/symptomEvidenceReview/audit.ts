/**
 * Audit artifact + totals for T07-04 symptom evidence review.
 */

import type {
  SymptomClaimCategory,
  SymptomEvidenceAuditArtifact,
  SymptomEvidenceReviewMode,
  SymptomEvidenceReviewQueue,
  SymptomEvidenceReviewRecord,
  SymptomEvidenceReviewTotals,
} from "./types";
import { SYMPTOM_EVIDENCE_REVIEW_TASK_ID } from "./types";
import { REQUIRED_CLAIM_CATEGORIES } from "./constants";

export function emptyReviewTotals(): SymptomEvidenceReviewTotals {
  const byCategory = {} as Record<SymptomClaimCategory, number>;
  for (const cat of REQUIRED_CLAIM_CATEGORIES) {
    byCategory[cat] = 0;
  }
  return {
    inputRows: 0,
    acceptedToQueue: 0,
    pendingReview: 0,
    approved: 0,
    rejected: 0,
    needsMoreEvidence: 0,
    stale: 0,
    organicEligible: 0,
    organicIneligiblePaid: 0,
    organicIneligibleOther: 0,
    publishEligible: 0,
    unpublishedUnverified: 0,
    byCategory,
  };
}

export function accumulateReviewTotals(
  totals: SymptomEvidenceReviewTotals,
  row: SymptomEvidenceReviewRecord,
): void {
  totals.inputRows += 1;
  totals.byCategory[row.claimCategory] =
    (totals.byCategory[row.claimCategory] ?? 0) + 1;

  if (row.queueLane !== "rejected") {
    totals.acceptedToQueue += 1;
  }

  switch (row.reviewerStatus) {
    case "pending_review":
      totals.pendingReview += 1;
      break;
    case "approved":
      totals.approved += 1;
      break;
    case "rejected":
      totals.rejected += 1;
      break;
    case "needs_more_evidence":
      totals.needsMoreEvidence += 1;
      break;
    case "stale":
      totals.stale += 1;
      break;
    default:
      break;
  }

  if (row.organicEligibility === "organic_eligible") {
    totals.organicEligible += 1;
  } else if (row.organicEligibility === "organic_ineligible_paid_relationship") {
    totals.organicIneligiblePaid += 1;
  } else {
    totals.organicIneligibleOther += 1;
  }

  if (row.publishEligible) totals.publishEligible += 1;
  if (
    row.reviewerStatus !== "approved" ||
    row.rejectionCodes.includes("unverified_must_stay_unpublished")
  ) {
    totals.unpublishedUnverified += 1;
  }
}

export function buildSymptomEvidenceAudit(input: {
  runId: string;
  mode: SymptomEvidenceReviewMode;
  generatedAt: string;
  totals: SymptomEvidenceReviewTotals;
  queue: SymptomEvidenceReviewQueue;
  records: SymptomEvidenceReviewRecord[];
  ok: boolean;
  notesKo: string[];
}): SymptomEvidenceAuditArtifact {
  return {
    taskId: SYMPTOM_EVIDENCE_REVIEW_TASK_ID,
    generatedAt: input.generatedAt,
    mode: input.mode,
    runId: input.runId,
    ok: input.ok,
    totals: input.totals,
    queueSummary: {
      organicReview: input.queue.organicReview.length,
      paidRelationshipReview: input.queue.paidRelationshipReview.length,
      pending: input.queue.pending.length,
      rejected: input.queue.rejected.length,
    },
    sampleRecords: input.records.slice(0, 16).map((r) => ({
      evidenceId: r.evidenceId,
      claimCategory: r.claimCategory,
      reviewerStatus: r.reviewerStatus,
      organicEligibility: r.organicEligibility,
      publishEligible: r.publishEligible,
      queueLane: r.queueLane,
      rejectionCodes: r.rejectionCodes,
    })),
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    publishAllowed: false,
    crawlAttempted: false,
    loginAutomationAttempted: false,
    captchaBypassAttempted: false,
    notesKo: input.notesKo,
  };
}
