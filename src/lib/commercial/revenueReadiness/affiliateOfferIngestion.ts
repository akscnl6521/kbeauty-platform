/**
 * Affiliate offer ingestion — dry-run / fixture only.
 * Does not activate commercial agreements.
 */

import { normalizeCommissionContract } from "./commissionSafety";
import { validateCountryPurchaseLinks } from "./countryPurchaseLinks";
import { buildDisclosureContract } from "./disclosure";
import type {
  AffiliateOfferIngestInput,
  RevenueCandidateRecord,
  RevenueRejectionCode,
} from "./types";

export function ingestAffiliateOffer(
  input: AffiliateOfferIngestInput,
  options: { mode: "fixture" | "dry_run" } = { mode: "fixture" },
): RevenueCandidateRecord {
  const reasons: RevenueRejectionCode[] = [];

  if (input.inventedLiveUrl) {
    reasons.push("live_url_invented");
  }
  if (!input.partnerId?.trim()) reasons.push("partner_missing");
  if (!input.campaignId?.trim()) reasons.push("campaign_missing");
  if (!input.evidenceVerified) reasons.push("evidence_unverified");

  const { commission, reasons: commissionReasons } = normalizeCommissionContract({
    ...input.commission,
    inventedCommissionRate: input.inventedCommissionRate,
  });
  reasons.push(...commissionReasons);

  const links = validateCountryPurchaseLinks(input.countryLinks, {
    requireAtLeastOne: true,
  });
  reasons.push(...links.reasons);

  const { disclosure, reasons: disclosureReasons } = buildDisclosureContract({
    lane: "affiliate",
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

  // Readiness layer never activates agreements.
  reasons.push("commercial_agreement_not_activated");
  reasons.push("admin_approval_required");

  const unique = [...new Set(reasons)];
  const structuralOk =
    !unique.includes("commission_rate_invented") &&
    !unique.includes("live_url_invented") &&
    !unique.includes("disclosure_missing") &&
    !unique.includes("disclosure_looks_like_organic_reason") &&
    !unique.includes("partner_missing") &&
    !unique.includes("campaign_missing") &&
    !unique.includes("country_link_missing") &&
    input.evidenceVerified;

  return {
    recordId: input.offerId,
    lane: "affiliate",
    entityType: "product",
    entityId: input.productId,
    partnerId: input.partnerId?.trim() || null,
    campaignId: input.campaignId?.trim() || null,
    commission,
    countryLinks: links.normalized,
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
    sponsoredPlacementRank: null,
    zone: null,
  };
}
