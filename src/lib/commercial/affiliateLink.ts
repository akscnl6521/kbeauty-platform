/**
 * Stage 7 — affiliate / sponsored link data structure.
 * Never invents destination URLs. Paid fields must not feed Organic score.
 */

export type AffiliateCommissionType =
  | "cpa"
  | "cps"
  | "cpl"
  | "flat_fee"
  | "unknown";

export type AffiliateEntityType = "product" | "clinic" | "media";

export type AffiliateLinkRecord = {
  id: string;
  entityType: AffiliateEntityType;
  entityId: string;
  /** Destination used only for paid placements — never as Organic rank input. */
  affiliateUrl: string | null;
  isAffiliate: boolean;
  isSponsored: boolean;
  disclosureLabel: string | null;
  partner: string | null;
  commissionType: AffiliateCommissionType | null;
  campaignId: string | null;
  sponsoredPlacement: number | null;
  affiliateVerifiedAt: string | null;
  /** Organic fit score computed elsewhere — stored for audit, not recomputed from fees. */
  organicRank: number | null;
  evidenceVerified: boolean;
  reviewStatus: "draft" | "reviewed" | "publishable" | "blocked";
  createdAt: string;
  updatedAt: string;
};

export type AffiliateLinkValidation = {
  ok: boolean;
  reasons: string[];
};

const HTTPS = /^https:\/\//i;

export function validateAffiliateLink(
  link: Pick<
    AffiliateLinkRecord,
    | "entityId"
    | "affiliateUrl"
    | "isAffiliate"
    | "isSponsored"
    | "disclosureLabel"
    | "partner"
    | "commissionType"
    | "campaignId"
    | "evidenceVerified"
    | "reviewStatus"
  >,
): AffiliateLinkValidation {
  const reasons: string[] = [];

  if (!link.entityId.trim()) reasons.push("entity_id_missing");
  if (!link.evidenceVerified) reasons.push("evidence_unverified");

  const paid = link.isAffiliate || link.isSponsored;
  if (paid) {
    if (!link.affiliateUrl || !HTTPS.test(link.affiliateUrl)) {
      reasons.push("affiliate_url_invalid");
    }
    if (!link.disclosureLabel?.trim()) reasons.push("disclosure_label_missing");
  }

  if (link.isSponsored && !link.partner?.trim()) {
    reasons.push("sponsor_partner_missing");
  }
  if (link.isAffiliate && !link.commissionType) {
    reasons.push("commission_type_missing");
  }
  if (link.isSponsored && !link.campaignId?.trim()) {
    reasons.push("campaign_id_missing");
  }
  if (link.reviewStatus === "publishable" && reasons.length > 0) {
    reasons.push("publishable_requires_valid_fields");
  }

  return { ok: reasons.length === 0, reasons };
}

/** Paid commercial fields that must never enter Organic score math. */
export const ORGANIC_SCORE_FORBIDDEN_FIELDS = [
  "isAffiliate",
  "isSponsored",
  "affiliateUrl",
  "commissionType",
  "campaignId",
  "sponsoredPlacement",
  "partner",
  "advertisingFee",
  "listingFee",
  "margin",
  "brandContract",
  "campaignSpend",
] as const;

export function stripPaidFieldsForOrganicScore<T extends Record<string, unknown>>(
  input: T,
): Omit<T, (typeof ORGANIC_SCORE_FORBIDDEN_FIELDS)[number]> {
  const next = { ...input };
  for (const key of ORGANIC_SCORE_FORBIDDEN_FIELDS) {
    if (key in next) {
      delete next[key];
    }
  }
  return next;
}

export function createAffiliateLinkDraft(
  input: Omit<AffiliateLinkRecord, "createdAt" | "updatedAt" | "reviewStatus"> & {
    reviewStatus?: AffiliateLinkRecord["reviewStatus"];
  },
  now = new Date(),
): AffiliateLinkRecord {
  const iso = now.toISOString();
  return {
    ...input,
    reviewStatus: input.reviewStatus ?? "draft",
    createdAt: iso,
    updatedAt: iso,
  };
}
