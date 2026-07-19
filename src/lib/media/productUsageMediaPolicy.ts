export type MediaRightsStatus =
  | "owned"
  | "licensed"
  | "brand_permission"
  | "user_consent"
  | "unknown"
  | "expired"
  | "revoked";

export type MediaReviewStatus =
  | "draft"
  | "needs_review"
  | "approved"
  | "rejected";

export type UsageMediaAsset = {
  id: string;
  productId: string;
  mediaType: "video" | "image" | "animation";
  sourceUrl: string | null;
  storagePath: string | null;
  rightsStatus: MediaRightsStatus;
  rightsExpiresAt: string | null;
  consentReference: string | null;
  reviewStatus: MediaReviewStatus;
  productMatchVerified: boolean;
  applicationDemonstrationVerified: boolean;
  containsMedicalClaim: boolean;
  containsBeforeAfter: boolean;
  isSponsored: boolean;
  sponsorName: string | null;
  disclosureText: string | null;
  locale: string;
};

export type UsageInstruction = {
  productId: string;
  amountLabel: string;
  orderIndex: number;
  frequency: "morning" | "evening" | "weekly" | "as_needed";
  applicationArea: string[];
  methodSteps: string[];
  cautionText: string[];
  sourceType: "official_brand" | "verified_editorial" | "internal_review";
  sourceUrl: string | null;
  verifiedAt: string;
};

export type MediaPublicationDecision = {
  publishable: boolean;
  reasonCodes: string[];
  requiresDisclosure: boolean;
  disclosureText: string | null;
};

function isRightsExpired(asset: UsageMediaAsset, now: Date): boolean {
  if (asset.rightsStatus === "expired" || asset.rightsStatus === "revoked") return true;
  if (!asset.rightsExpiresAt) return false;
  const expiresAt = new Date(asset.rightsExpiresAt);
  return Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime();
}

export function decideUsageMediaPublication(
  asset: UsageMediaAsset,
  now: Date = new Date()
): MediaPublicationDecision {
  const reasons: string[] = [];

  if (!asset.sourceUrl && !asset.storagePath) reasons.push("media_source_missing");
  if (asset.reviewStatus !== "approved") reasons.push("media_not_approved");
  if (!asset.productMatchVerified) reasons.push("product_match_unverified");
  if (!asset.applicationDemonstrationVerified) reasons.push("application_demo_unverified");

  if (
    asset.rightsStatus === "unknown" ||
    asset.rightsStatus === "revoked" ||
    asset.rightsStatus === "expired"
  ) {
    reasons.push("rights_not_publishable");
  }
  if (isRightsExpired(asset, now)) reasons.push("rights_expired");

  if (
    (asset.rightsStatus === "licensed" ||
      asset.rightsStatus === "brand_permission" ||
      asset.rightsStatus === "user_consent") &&
    !asset.consentReference
  ) {
    reasons.push("rights_evidence_missing");
  }

  if (asset.containsMedicalClaim) reasons.push("medical_claim_requires_rejection");
  if (asset.containsBeforeAfter) reasons.push("before_after_requires_manual_review");

  const requiresDisclosure = asset.isSponsored;
  const disclosureText = asset.isSponsored
    ? asset.disclosureText?.trim() ||
      (asset.sponsorName ? `${asset.sponsorName}의 유료 광고가 포함되어 있습니다.` : null)
    : null;

  if (requiresDisclosure && !disclosureText) reasons.push("sponsorship_disclosure_missing");

  return {
    publishable: reasons.length === 0,
    reasonCodes: [...new Set(reasons)],
    requiresDisclosure,
    disclosureText,
  };
}

export function validateUsageInstruction(instruction: UsageInstruction): string[] {
  const reasons: string[] = [];
  if (!instruction.amountLabel.trim()) reasons.push("amount_missing");
  if (!Number.isInteger(instruction.orderIndex) || instruction.orderIndex < 1) {
    reasons.push("invalid_order_index");
  }
  if (instruction.applicationArea.length === 0) reasons.push("application_area_missing");
  if (instruction.methodSteps.length === 0) reasons.push("method_steps_missing");
  if (!instruction.sourceUrl && instruction.sourceType !== "internal_review") {
    reasons.push("instruction_source_missing");
  }
  const verifiedAt = new Date(instruction.verifiedAt);
  if (Number.isNaN(verifiedAt.getTime())) reasons.push("verified_at_invalid");
  return reasons;
}
