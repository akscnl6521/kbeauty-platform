/**
 * Machine-readable audit for P3-T04 revenue readiness.
 */

import { SAFETY_NOTES_KO } from "./constants";
import type {
  OrganicIndependenceProof,
  RevenueCandidateRecord,
  RevenueReadinessAuditArtifact,
  RevenueReadinessAuditTotals,
  RevenueReadinessMode,
} from "./types";
import { REVENUE_READINESS_TASK_ID } from "./types";

export function emptyTotals(): RevenueReadinessAuditTotals {
  return {
    offersSeen: 0,
    placementsSeen: 0,
    ingestedOk: 0,
    rejected: 0,
    expired: 0,
    needsReview: 0,
    adminApprovedStructural: 0,
    countryLinksSeen: 0,
    eventsValidated: 0,
    eventsRejected: 0,
    privacyViolations: 0,
    fixtureNonPublic: 0,
    dryRunNonPublic: 0,
    agreementsActivated: 0,
  };
}

export function recomputeTotals(input: {
  candidates: RevenueCandidateRecord[];
  eventsValidated: number;
  eventsRejected: number;
  privacyViolations: number;
}): RevenueReadinessAuditTotals {
  const totals = emptyTotals();
  totals.eventsValidated = input.eventsValidated;
  totals.eventsRejected = input.eventsRejected;
  totals.privacyViolations = input.privacyViolations;

  for (const c of input.candidates) {
    if (c.lane === "affiliate") totals.offersSeen += 1;
    else totals.placementsSeen += 1;
    totals.countryLinksSeen += c.countryLinks.length;
    if (c.isFixture) totals.fixtureNonPublic += 1;
    if (c.isDryRunRecord) totals.dryRunNonPublic += 1;
    if (c.adminStatus === "expired") totals.expired += 1;
    if (c.adminStatus === "rejected") totals.rejected += 1;
    if (c.adminStatus === "needs_review") totals.needsReview += 1;
    if (
      c.adminStatus === "activation_blocked" ||
      c.adminStatus === "admin_approved"
    ) {
      totals.adminApprovedStructural += 1;
    }
    if (
      !c.rejectionCodes.includes("commission_rate_invented") &&
      !c.rejectionCodes.includes("live_url_invented") &&
      !c.rejectionCodes.includes("disclosure_looks_like_organic_reason") &&
      !c.rejectionCodes.includes("organic_zone_forbidden") &&
      !c.rejectionCodes.includes("country_link_missing")
    ) {
      totals.ingestedOk += 1;
    }
  }
  return totals;
}

export function buildRevenueReadinessAudit(input: {
  mode: RevenueReadinessMode;
  runId: string;
  generatedAt: string;
  candidates: RevenueCandidateRecord[];
  eventsValidated: number;
  eventsRejected: number;
  privacyViolations: number;
  organicIndependence: OrganicIndependenceProof;
}): RevenueReadinessAuditArtifact {
  return {
    taskId: REVENUE_READINESS_TASK_ID,
    mode: input.mode,
    runId: input.runId,
    generatedAt: input.generatedAt,
    totals: recomputeTotals({
      candidates: input.candidates,
      eventsValidated: input.eventsValidated,
      eventsRejected: input.eventsRejected,
      privacyViolations: input.privacyViolations,
    }),
    publishAllowed: false,
    publicVisible: false,
    commercialAgreementsActivated: false,
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    paidApiUsed: false,
    inventedCommissionRates: false,
    inventedLiveUrls: false,
    organicIndependent: input.organicIndependence.organicOrderUnchanged,
    professionalRoutingIndependent:
      input.organicIndependence.professionalRoutingUnchanged,
    notesKo: [...SAFETY_NOTES_KO],
  };
}
