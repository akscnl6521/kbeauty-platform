/**
 * Machine-readable audit for P3-T02 verified product pool.
 */

import { emptyCategoryCounts } from "./constants";
import type {
  VerifiedPoolAuditArtifact,
  VerifiedPoolAuditTotals,
  VerifiedPoolCandidate,
  VerifiedPoolCategory,
  VerifiedPoolMode,
  VerifiedPoolRejectionCode,
} from "./types";
import { VERIFIED_PRODUCT_POOL_TASK_ID, VERIFIED_POOL_CATEGORIES } from "./types";

export function emptyTotals(): VerifiedPoolAuditTotals {
  return {
    rawSeen: 0,
    manifestApproved: 0,
    manifestRejected: 0,
    byCategory: emptyCategoryCounts(),
    normalized: 0,
    duplicatesMerged: 0,
    uniqueCandidates: 0,
    rejected: 0,
    safetyHold: 0,
    needsReview: 0,
    recommendationReady: 0,
    publicTop5Eligible: 0,
    publicTop5Blocked: 0,
    missingSource: 0,
    missingIngredients: 0,
    missingImageRights: 0,
    missingPurchaseOffer: 0,
    fixtureNonPublic: 0,
    dryRunNonPublic: 0,
  };
}

export function recomputeTotals(
  candidates: VerifiedPoolCandidate[],
  base: Pick<
    VerifiedPoolAuditTotals,
    "rawSeen" | "manifestApproved" | "manifestRejected"
  >,
): VerifiedPoolAuditTotals {
  const totals = emptyTotals();
  totals.rawSeen = base.rawSeen;
  totals.manifestApproved = base.manifestApproved;
  totals.manifestRejected = base.manifestRejected;

  for (const c of candidates) {
    if (c.status !== "duplicate_merged" && c.status !== "rejected") {
      totals.byCategory[c.poolCategory] += 1;
      totals.normalized += 1;
    }
    if (c.status === "duplicate_merged") totals.duplicatesMerged += 1;
    if (c.status === "rejected") totals.rejected += 1;
    if (c.status === "safety_hold") totals.safetyHold += 1;
    if (c.status === "needs_review") totals.needsReview += 1;
    if (c.gate.recommendationReady) totals.recommendationReady += 1;
    if (c.publicTop5Allowed) totals.publicTop5Eligible += 1;
    else totals.publicTop5Blocked += 1;
    if (!c.gate.sourceVerified) totals.missingSource += 1;
    if (!c.gate.ingredientsVerified) totals.missingIngredients += 1;
    if (!c.gate.imageRightsVerified) totals.missingImageRights += 1;
    if (!c.gate.purchaseOfferVerified) totals.missingPurchaseOffer += 1;
    if (c.isFixture) totals.fixtureNonPublic += 1;
    if (c.isDryRunRecord) totals.dryRunNonPublic += 1;
  }

  totals.uniqueCandidates = candidates.filter(
    (c) => c.status !== "duplicate_merged",
  ).length;

  return totals;
}

function countRejectionReasons(
  candidates: VerifiedPoolCandidate[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of candidates) {
    for (const code of c.rejectionReasons) {
      counts[code] = (counts[code] ?? 0) + 1;
    }
  }
  return counts;
}

export function buildVerifiedPoolAudit(input: {
  runId: string;
  mode: VerifiedPoolMode;
  generatedAt: string;
  totals: VerifiedPoolAuditTotals;
  candidates: VerifiedPoolCandidate[];
  top5BlockedSample: Array<{
    candidateId: string;
    reasons: VerifiedPoolRejectionCode[];
  }>;
  notesKo?: string[];
}): VerifiedPoolAuditArtifact {
  const recommendationReadySample = input.candidates
    .filter((c) => c.gate.recommendationReady)
    .slice(0, 8)
    .map((c) => ({
      candidateId: c.candidateId,
      poolCategory: c.poolCategory,
      publicTop5Allowed: c.publicTop5Allowed,
    }));

  const categoryCounts = emptyCategoryCounts();
  for (const cat of VERIFIED_POOL_CATEGORIES) {
    categoryCounts[cat] = input.totals.byCategory[cat] ?? 0;
  }

  const fatal =
    input.candidates.some((c) => c.publishAllowed !== false) ||
    input.candidates.some((c) => c.publicVisible !== false) ||
    (input.mode !== "live_blocked" &&
      input.candidates.some(
        (c) =>
          c.publicTop5Allowed === true &&
          (c.isFixture || c.isDryRunRecord),
      ));

  return {
    taskId: VERIFIED_PRODUCT_POOL_TASK_ID,
    generatedAt: input.generatedAt,
    mode: input.mode,
    runId: input.runId,
    ok: !fatal,
    totals: input.totals,
    candidateIds: input.candidates.map((c) => c.candidateId),
    top5BlockedSample: input.top5BlockedSample.slice(0, 12),
    recommendationReadySample,
    rejectionReasonCounts: countRejectionReasons(input.candidates),
    categoryCounts,
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    publishAllowed: false,
    publicVisible: false,
    paidApiUsed: false,
    captchaBypassAttempted: false,
    authenticatedScrapeAttempted: false,
    notesKo: input.notesKo ?? [
      "승인된 공식 매니페스트·비공개 dry-run만 사용.",
      "출처·전성분·이미지 권리·구매 offer 미검증 시 공개 Top 5 진입 금지.",
      "fixture/dry-run은 비공개 · Production 쓰기 없음.",
    ],
  };
}

export type { VerifiedPoolCategory };
