/**
 * User-facing display eligibility for usage / product media.
 * Pure function — does not touch ranking or Organic scores.
 */
import {
  decideUsageMediaPublication,
  type UsageMediaAsset,
} from "@/lib/media/productUsageMediaPolicy";
import {
  deriveUsageMediaRelationship,
  evaluateContentDisclosure,
} from "@/lib/media/contentDisclosurePolicy";

export type UsageMediaEligibilityChecklist = {
  httpsSource: boolean;
  sourceTypeKnown: boolean;
  productLinked: boolean;
  rightsValid: boolean;
  rightsNotExpired: boolean;
  verifiedOrApproved: boolean;
  disclosureOk: boolean;
  displayEligible: boolean;
};

export type UsageMediaEligibilityResult = {
  eligible: boolean;
  reasonCodes: string[];
  checklist: UsageMediaEligibilityChecklist;
  requiresDisclosure: boolean;
  disclosureText: string | null;
  disclosureLabel: string | null;
  relationship: ReturnType<typeof deriveUsageMediaRelationship>;
};

function isHttpsUrl(value: string | null | undefined): boolean {
  if (!value || !value.trim()) return false;
  try {
    return new URL(value.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Display eligibility for policy-layer UsageMediaAsset (localStorage / review queue).
 * HTTP sourceUrl is never eligible. Disclosure follows contentDisclosurePolicy.
 */
export function isUsageMediaDisplayEligible(
  asset: UsageMediaAsset,
  now: Date = new Date()
): UsageMediaEligibilityResult {
  const reasons: string[] = [];
  const hasHttps = isHttpsUrl(asset.sourceUrl);
  const hasStorage = Boolean(asset.storagePath?.trim());

  if (asset.sourceUrl && !hasHttps) {
    reasons.push("https_required");
  }
  if (!hasHttps && !hasStorage) {
    reasons.push("media_source_missing");
  }

  const decision = decideUsageMediaPublication(asset, now);
  for (const code of decision.reasonCodes) {
    if (!reasons.includes(code)) reasons.push(code);
  }

  const relationship = deriveUsageMediaRelationship({
    contentRelationship: asset.contentRelationship,
    isSponsored: asset.isSponsored,
  });
  const disclosure = evaluateContentDisclosure({
    relationship,
    disclosureText: asset.disclosureText,
    sponsorName: asset.sponsorName,
    httpsOk: hasHttps || (hasStorage && !asset.sourceUrl),
    verified: asset.reviewStatus === "approved",
    rightsValid:
      asset.rightsStatus !== "unknown" &&
      asset.rightsStatus !== "revoked" &&
      asset.rightsStatus !== "expired",
    rightsNotExpired: !decision.reasonCodes.includes("rights_expired"),
    productLinked: Boolean(asset.productId?.trim()),
    containsMedicalOverclaim: asset.containsMedicalClaim,
  });

  for (const code of disclosure.reasonCodes) {
    if (!reasons.includes(code)) reasons.push(code);
  }

  const checklist: UsageMediaEligibilityChecklist = {
    httpsSource: hasHttps || (hasStorage && !asset.sourceUrl),
    sourceTypeKnown: true,
    productLinked: Boolean(asset.productId?.trim()),
    rightsValid:
      asset.rightsStatus !== "unknown" &&
      asset.rightsStatus !== "revoked" &&
      asset.rightsStatus !== "expired",
    rightsNotExpired: !reasons.includes("rights_expired"),
    verifiedOrApproved: asset.reviewStatus === "approved",
    disclosureOk: !disclosure.requiresDisclosure || Boolean(disclosure.disclosureText),
    displayEligible: false,
  };

  if (!checklist.productLinked && !reasons.includes("product_link_missing")) {
    reasons.push("product_link_missing");
  }

  const eligible = reasons.length === 0;
  checklist.displayEligible = eligible;

  return {
    eligible,
    reasonCodes: [...new Set(reasons)],
    checklist,
    requiresDisclosure: disclosure.requiresDisclosure,
    disclosureText: disclosure.disclosureText,
    disclosureLabel: disclosure.disclosureLabel,
    relationship,
  };
}
