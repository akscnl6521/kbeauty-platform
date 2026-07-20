/**
 * Pure catalog media display eligibility for admin review.
 * No DB / server-only imports — safe for self-tests.
 */
import type {
  UsageRightsStatus,
  MediaValidationStatus,
} from "@/lib/catalog/media/validateMedia";

function isSafeHttpsUrl(url: string | null | undefined): boolean {
  if (!url || !url.trim()) return false;
  try {
    return new URL(url.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

export type AdminCatalogMediaChecklist = {
  httpsSource: boolean;
  sourceTypePresent: boolean;
  productLinked: boolean;
  rightsStatusValid: boolean;
  rightsEndDateOk: boolean | null; // null = schema absent
  verifiedAtPresent: boolean;
  disclosureRequired: boolean;
  disclosurePresent: boolean | null; // null = schema absent
  displayEligible: boolean;
};

const PUBLISHABLE_RIGHTS = new Set<UsageRightsStatus>([
  "official_remote_use",
  "licensed_copy_allowed",
  "external_link_only",
]);

/**
 * Catalog row eligibility for end-user display (read-only admin judgment).
 * Uses only columns that exist on catalog_product_media.
 */
export function evaluateCatalogProductMediaDisplay(row: {
  productId: number | null;
  imageUrl: string;
  canonicalImageUrl: string | null;
  sourcePageUrl: string;
  sourceType: string;
  usageRightsStatus: string;
  validationStatus: string;
  verifiedAt: string | null;
  rightsNotes: string | null;
}): {
  checklist: AdminCatalogMediaChecklist;
  displayEligible: boolean;
  ineligibilityReasons: string[];
} {
  const reasons: string[] = [];
  const imageHttps = isSafeHttpsUrl(row.imageUrl);
  const canonicalHttps = isSafeHttpsUrl(row.canonicalImageUrl);
  const httpsSource = imageHttps || canonicalHttps;

  if (!httpsSource) reasons.push("https_required");
  if (!row.productId) reasons.push("product_link_missing");
  if (!row.sourceType?.trim()) reasons.push("source_type_missing");

  const rightsValid = PUBLISHABLE_RIGHTS.has(
    row.usageRightsStatus as UsageRightsStatus
  );
  if (!rightsValid) reasons.push("rights_not_publishable");

  if (row.validationStatus !== ("verified" as MediaValidationStatus)) {
    reasons.push("media_not_verified");
  }
  if (!row.verifiedAt || Number.isNaN(new Date(row.verifiedAt).getTime())) {
    reasons.push("verified_at_missing");
  }

  const disclosureRequired =
    row.sourceType === "ai_generated" || row.sourceType === "user_ugc";
  if (disclosureRequired) {
    reasons.push("disclosure_schema_missing");
  }

  const checklist: AdminCatalogMediaChecklist = {
    httpsSource,
    sourceTypePresent: Boolean(row.sourceType?.trim()),
    productLinked: Boolean(row.productId),
    rightsStatusValid: rightsValid,
    rightsEndDateOk: null,
    verifiedAtPresent: Boolean(
      row.verifiedAt && !Number.isNaN(new Date(row.verifiedAt).getTime())
    ),
    disclosureRequired,
    disclosurePresent: disclosureRequired ? null : true,
    displayEligible: false,
  };

  const displayEligible = reasons.length === 0;
  checklist.displayEligible = displayEligible;

  return {
    checklist,
    displayEligible,
    ineligibilityReasons: [...new Set(reasons)],
  };
}

export function catalogMediaStatusLabel(
  validationStatus: string,
  rightsStatus: string
): string {
  if (validationStatus === "prohibited" || rightsStatus === "prohibited") {
    return "prohibited";
  }
  if (rightsStatus === "unknown") return "rights_unverified";
  if (validationStatus === "needs_review") return "needs_review";
  if (validationStatus === "discovered") return "candidate";
  if (validationStatus === "verified") return "verified";
  if (validationStatus === "broken" || validationStatus === "mismatched") {
    return validationStatus;
  }
  return validationStatus || "unknown";
}
