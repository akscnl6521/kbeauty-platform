/**
 * User-facing display eligibility for usage / product media.
 * Pure function — does not touch ranking or Organic scores.
 */
import {
  decideUsageMediaPublication,
  type UsageMediaAsset,
} from "@/lib/media/productUsageMediaPolicy";

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
 * HTTP sourceUrl is never eligible. Sponsored content requires disclosure.
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
    disclosureOk: !decision.requiresDisclosure || Boolean(decision.disclosureText),
    displayEligible: false,
  };

  if (!checklist.productLinked) reasons.push("product_link_missing");

  const eligible = reasons.length === 0;
  checklist.displayEligible = eligible;

  return {
    eligible,
    reasonCodes: [...new Set(reasons)],
    checklist,
    requiresDisclosure: decision.requiresDisclosure,
    disclosureText: decision.disclosureText,
  };
}
