/**
 * Build admin review queues with Organic vs paid relationship separation.
 */

import type {
  SymptomEvidenceReviewQueue,
  SymptomEvidenceReviewRecord,
} from "./types";

export function buildReviewQueue(
  records: SymptomEvidenceReviewRecord[],
): SymptomEvidenceReviewQueue {
  const queue: SymptomEvidenceReviewQueue = {
    organicReview: [],
    paidRelationshipReview: [],
    pending: [],
    rejected: [],
  };
  for (const row of records) {
    switch (row.queueLane) {
      case "organic_review":
        queue.organicReview.push(row);
        break;
      case "paid_relationship_review":
        queue.paidRelationshipReview.push(row);
        break;
      case "rejected":
        queue.rejected.push(row);
        break;
      case "pending":
      default:
        queue.pending.push(row);
        break;
    }
  }
  return queue;
}

/** Admin-facing summary lines (Korean). */
export function formatQueueSummaryKo(queue: SymptomEvidenceReviewQueue): string[] {
  return [
    `Organic 검수: ${queue.organicReview.length}건`,
    `제휴·스폰서·유료 관계 검수: ${queue.paidRelationshipReview.length}건`,
    `대기/추가근거: ${queue.pending.length}건`,
    `거절/정책차단: ${queue.rejected.length}건`,
  ];
}
