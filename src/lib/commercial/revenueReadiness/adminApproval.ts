/**
 * Admin approval gate — structural approval ≠ commercial activation.
 */

import type {
  AdminApprovalDecision,
  RevenueCandidateRecord,
  RevenueRejectionCode,
} from "./types";

const BLOCKING: RevenueRejectionCode[] = [
  "commission_rate_invented",
  "live_url_invented",
  "disclosure_missing",
  "disclosure_looks_like_organic_reason",
  "partner_missing",
  "campaign_missing",
  "evidence_unverified",
  "expired",
  "country_link_missing",
  "organic_zone_forbidden",
  "health_targeting_forbidden",
];

/**
 * Dry-run admin approval: may mark structurally ready for human contract review,
 * but never activates commercialAgreementsActivated.
 */
export function evaluateAdminApproval(
  candidate: RevenueCandidateRecord,
  options: { humanApproved: boolean } = { humanApproved: false },
): AdminApprovalDecision {
  const blocking = candidate.rejectionCodes.filter((c) => BLOCKING.includes(c));
  const expired = candidate.adminStatus === "expired";

  if (expired || blocking.length > 0) {
    return {
      recordId: candidate.recordId,
      approved: false,
      adminStatus: expired ? "expired" : "rejected",
      reasonCodes: [
        ...blocking,
        "commercial_agreement_not_activated",
      ],
      requiresHumanContract: true,
    };
  }

  if (!options.humanApproved) {
    return {
      recordId: candidate.recordId,
      approved: false,
      adminStatus: "needs_review",
      reasonCodes: [
        "admin_approval_required",
        "commercial_agreement_not_activated",
      ],
      requiresHumanContract: true,
    };
  }

  // Structural admin_approved — still activation_blocked for real agreements.
  return {
    recordId: candidate.recordId,
    approved: true,
    adminStatus: "admin_approved",
    reasonCodes: [
      "commercial_agreement_not_activated",
      "fixture_non_public",
    ],
    requiresHumanContract: true,
  };
}

export function applyAdminApproval(
  candidate: RevenueCandidateRecord,
  decision: AdminApprovalDecision,
): RevenueCandidateRecord {
  const codes = [
    ...new Set([...candidate.rejectionCodes, ...decision.reasonCodes]),
  ];
  return {
    ...candidate,
    adminStatus:
      decision.adminStatus === "admin_approved"
        ? "activation_blocked"
        : decision.adminStatus,
    rejectionCodes: codes,
    commercialAgreementActivated: false,
    allowPublicPaidSurface: false,
  };
}
