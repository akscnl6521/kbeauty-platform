import type { BeautyDomain } from "./taxonomy/domains";

export type RegulatoryClass =
  | "general_cosmetic"
  | "functional_cosmetic"
  | "quasi_drug"
  | "consumer_good"
  | "supplement"
  | "medical_device"
  | "medical_device_unknown"
  | "professional_only"
  | "regulatory_review_required";

export type RecommendationEligibility =
  | "recommendation_ready"
  | "insufficient_data"
  | "verification_required"
  | "regulatory_review_required"
  | "safety_hold"
  | "out_of_stock"
  | "unavailable_in_country";

export type CommercialMetadata = {
  organicRank: number | null;
  isAffiliate: boolean;
  isSponsored: boolean;
  disclosureLabel: string | null;
  partner: string | null;
  commissionType: string | null;
  campaignId: string | null;
  sponsoredPlacement: number | null;
  affiliateUrl: string | null;
  affiliateVerifiedAt: string | null;
};

export type CommonProduct = {
  id: string;
  brandId: string;
  canonicalName: string;
  displayName: string;
  domain: BeautyDomain;
  category: string;
  regulatoryClass: RegulatoryClass;
  eligibility: RecommendationEligibility;
  categoryAttributes: Record<string, unknown>;
  variantIds: string[];
  sourceIds: string[];
  duplicateGroupId: string | null;
  reformulationOfId: string | null;
  collectedAt: string | null;
  verifiedAt: string | null;
  refreshDueAt: string | null;
  dataCompleteness: number;
  sourceConfidence: number;
  commercial: CommercialMetadata;
};

export function isOrdinaryCosmeticRecommendationAllowed(
  product: Pick<CommonProduct, "regulatoryClass" | "eligibility">
): boolean {
  return (
    (product.regulatoryClass === "general_cosmetic" ||
      product.regulatoryClass === "functional_cosmetic" ||
      product.regulatoryClass === "quasi_drug") &&
    product.eligibility === "recommendation_ready"
  );
}
