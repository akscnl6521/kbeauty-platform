/**
 * Expiry / active-window handling for affiliate offers and sponsored placements.
 */

import type {
  ExpiryDecision,
  RevenueCandidateRecord,
  RevenueRejectionCode,
} from "./types";

export function evaluateExpiry(
  record: Pick<
    RevenueCandidateRecord,
    "recordId" | "startsAt" | "expiresAt"
  >,
  now: Date,
): ExpiryDecision {
  const reasons: RevenueRejectionCode[] = [];
  const nowMs = now.getTime();
  const startsMs = record.startsAt ? Date.parse(record.startsAt) : null;
  const expiresMs = record.expiresAt ? Date.parse(record.expiresAt) : null;

  const notYetStarted =
    startsMs != null && !Number.isNaN(startsMs) && nowMs < startsMs;
  const expired =
    expiresMs != null && !Number.isNaN(expiresMs) && nowMs >= expiresMs;

  if (notYetStarted) reasons.push("not_yet_started");
  if (expired) reasons.push("expired");

  return {
    recordId: record.recordId,
    expired,
    notYetStarted,
    activeWindow: !expired && !notYetStarted,
    expiresAt: record.expiresAt,
    startsAt: record.startsAt,
    reasonCodes: reasons,
  };
}

export function applyExpiryToCandidate(
  candidate: RevenueCandidateRecord,
  now: Date,
): { candidate: RevenueCandidateRecord; decision: ExpiryDecision } {
  const decision = evaluateExpiry(candidate, now);
  if (!decision.expired && !decision.notYetStarted) {
    return { candidate, decision };
  }

  const codes = [
    ...new Set([...candidate.rejectionCodes, ...decision.reasonCodes]),
  ];
  return {
    decision,
    candidate: {
      ...candidate,
      adminStatus: decision.expired ? "expired" : candidate.adminStatus,
      rejectionCodes: codes,
      allowPublicPaidSurface: false,
      commercialAgreementActivated: false,
    },
  };
}
