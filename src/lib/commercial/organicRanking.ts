/**
 * Organic ranking helpers — paid relationship fields never alter organicScore.
 */

import type { CommercialMetadata } from "@/lib/catalog/commonProduct";
import {
  buildCommercialPresentation,
  type CommercialCandidate,
  type CommercialRelationship,
  type CommercialPresentation,
} from "@/lib/commercial/commercialSeparationPolicy";
import { stripPaidFieldsForOrganicScore } from "@/lib/commercial/affiliateLink";

export type OrganicRankInput = {
  id: string;
  entityType: "product" | "clinic";
  /** Pre-computed Organic fit — must not include affiliate/sponsor fees. */
  organicScore: number;
  commercial: CommercialMetadata;
  organicRankEligible?: boolean;
};

function relationshipFromCommercial(
  commercial: CommercialMetadata,
  entityType: "product" | "clinic",
): CommercialRelationship {
  if (commercial.isSponsored) {
    return entityType === "clinic" ? "sponsored_clinic" : "sponsored_product";
  }
  if (
    entityType === "clinic" &&
    commercial.isAffiliate &&
    commercial.commissionType === "cpl"
  ) {
    return "booking_commission";
  }
  if (commercial.isAffiliate) {
    return "affiliate_link";
  }
  return "none";
}

export function toCommercialCandidate(input: OrganicRankInput): CommercialCandidate {
  const relationship = relationshipFromCommercial(
    input.commercial,
    input.entityType,
  );
  const sponsored =
    relationship === "sponsored_product" || relationship === "sponsored_clinic";
  const paidAffiliate =
    relationship === "affiliate_link" || relationship === "booking_commission";
  return {
    id: input.id,
    entityType: input.entityType,
    organicScore: input.organicScore,
    relationship,
    sponsorName: sponsored ? input.commercial.partner : null,
    disclosureText: input.commercial.disclosureLabel,
    destinationUrl: input.commercial.affiliateUrl,
    organicRankEligible: input.organicRankEligible ?? !input.commercial.isSponsored,
    evidenceVerified:
      Boolean(input.commercial.affiliateVerifiedAt) || !paidAffiliate,
  };
}

/**
 * Re-rank by organicScore only. Mutating paid metadata must not change order.
 */
export function rankByOrganicScoreOnly(
  candidates: OrganicRankInput[],
): CommercialCandidate[] {
  return [...candidates]
    .map(toCommercialCandidate)
    .filter((c) => c.organicRankEligible && c.evidenceVerified)
    .sort((a, b) => b.organicScore - a.organicScore);
}

export function buildOrganicCommercePresentation(
  candidates: OrganicRankInput[],
): CommercialPresentation {
  return buildCommercialPresentation(candidates.map(toCommercialCandidate));
}

/**
 * Assert that two ranking inputs that differ only in paid fields produce
 * identical Organic id order.
 */
export function assertPaidFieldsDoNotAlterOrganicOrder(
  base: OrganicRankInput[],
  withPaidNoise: OrganicRankInput[],
): boolean {
  const baseOrder = rankByOrganicScoreOnly(base).map((c) => c.id);
  const noisyOrder = rankByOrganicScoreOnly(
    withPaidNoise.map((item) => {
      const strippedCommercial = stripPaidFieldsForOrganicScore({
        ...item.commercial,
      }) as CommercialMetadata;
      // Keep commercial on the noisy copy for presentation, but score path uses organicScore only.
      return {
        ...item,
        // organicScore intentionally unchanged — paid noise lives only in commercial.*
        commercial: {
          ...strippedCommercial,
          ...item.commercial,
        },
      };
    }),
  ).map((c) => c.id);
  return (
    baseOrder.length === noisyOrder.length &&
    baseOrder.every((id, index) => id === noisyOrder[index])
  );
}

/** Detect illegal paid keys inside an Organic score payload. */
export function findForbiddenPaidKeysInScorePayload(
  payload: Record<string, unknown>,
): string[] {
  const forbidden = [
    "isAffiliate",
    "isSponsored",
    "affiliateUrl",
    "commissionType",
    "campaignId",
    "sponsoredPlacement",
    "advertisingFee",
    "listingFee",
    "margin",
    "brandContract",
    "campaignSpend",
  ];
  return forbidden.filter((key) => key in payload && payload[key] != null);
}
