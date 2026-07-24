/**
 * Sponsored placement contracts — separated from Organic recommendation lanes.
 */

import { buildDisclosureContract } from "./disclosure";
import type {
  RevenueCandidateRecord,
  RevenueRejectionCode,
  SponsoredPlacementContractInput,
} from "./types";

export function ingestSponsoredPlacement(
  input: SponsoredPlacementContractInput,
  options: { mode: "fixture" | "dry_run" } = { mode: "fixture" },
): RevenueCandidateRecord {
  const reasons: RevenueRejectionCode[] = [];

  if (input.attemptedOrganicZone) {
    reasons.push("organic_zone_forbidden");
  }
  if (!input.partnerId?.trim()) reasons.push("partner_missing");
  if (!input.campaignId?.trim()) reasons.push("campaign_missing");
  if (!input.evidenceVerified) reasons.push("evidence_unverified");

  const { disclosure, reasons: disclosureReasons } = buildDisclosureContract({
    lane: "sponsored",
    labelKo: input.disclosureLabelKo,
    labelEn: input.disclosureLabelEn,
  });
  reasons.push(...disclosureReasons);

  if (input.isFixture || options.mode === "fixture") {
    reasons.push("fixture_non_public");
  }
  if (options.mode === "dry_run") {
    reasons.push("dry_run_non_public");
  }

  reasons.push("commercial_agreement_not_activated");
  reasons.push("admin_approval_required");

  const unique = [...new Set(reasons)];
  const structuralOk =
    !unique.includes("organic_zone_forbidden") &&
    !unique.includes("disclosure_missing") &&
    !unique.includes("disclosure_looks_like_organic_reason") &&
    !unique.includes("partner_missing") &&
    !unique.includes("campaign_missing") &&
    input.evidenceVerified;

  return {
    recordId: input.placementId,
    lane: "sponsored",
    entityType: input.entityType,
    entityId: input.entityId,
    partnerId: input.partnerId?.trim() || null,
    campaignId: input.campaignId?.trim() || null,
    commission: {
      commissionType: "unknown",
      commissionRatePercent: null,
      commissionRateKnown: false,
      commissionAmountKnown: false,
      commissionAmount: null,
      currency: null,
    },
    countryLinks: [],
    disclosure,
    startsAt: input.startsAt,
    expiresAt: input.expiresAt,
    evidenceVerified: input.evidenceVerified,
    adminStatus: structuralOk ? "needs_review" : "rejected",
    rejectionCodes: unique,
    isFixture: input.isFixture || options.mode === "fixture",
    isDryRunRecord: true,
    commercialAgreementActivated: false,
    allowPublicPaidSurface: false,
    sponsoredPlacementRank: input.sponsoredPlacementRank,
    zone: input.zone,
  };
}
