/**
 * Eligibility / policy filters for official KR product onboarding (P3-T01).
 */

import { isBlockedAccessMode } from "./sourceManifest";
import type {
  OfficialKrProductCandidate,
  OfficialKrProductRawItem,
  OfficialProductSourceKind,
} from "./types";
import type { ReviewReasonCode } from "./reviewReasons";

const OFFICIAL_KINDS: readonly OfficialProductSourceKind[] = [
  "brand_official_page",
  "official_kr_mall_page",
  "official_inci_disclosure",
] as const;

export type PolicyFilterResult = {
  pass: boolean;
  reasons: ReviewReasonCode[];
  status:
    | "filtered_out"
    | "blocked_policy"
    | "needs_review"
    | "candidate_ready";
};

function hasInventedPriceOrStock(raw: OfficialKrProductRawItem): boolean {
  // Convention: forceBlockReason or sentinel note "invented"
  if (raw.forceBlockReason === "price_or_stock_invented") return true;
  return raw.offers.some(
    (o) =>
      (o.price != null && o.lastCheckedAt == null && !o.isOfficial) ||
      (o.stockStatus !== "unknown" &&
        o.lastCheckedAt == null &&
        o.purchaseUrl == null),
  );
}

function hasInventedCountry(raw: OfficialKrProductRawItem): boolean {
  if (raw.forceBlockReason === "country_availability_invented") return true;
  return false;
}

export function evaluatePolicyFilters(
  raw: OfficialKrProductRawItem,
): PolicyFilterResult {
  const reasons: ReviewReasonCode[] = [];

  if (isBlockedAccessMode(raw.accessMode)) {
    if (raw.accessMode === "blocked_paid_api") {
      reasons.push("paid_api_forbidden");
    } else if (raw.accessMode === "blocked_auth_required") {
      reasons.push("authenticated_scrape_forbidden");
    } else if (raw.accessMode === "blocked_captcha") {
      reasons.push("captcha_bypass_forbidden");
    } else if (raw.accessMode === "blocked_terms_risk") {
      reasons.push("terms_risk_automation_forbidden");
    }
    return { pass: false, reasons, status: "blocked_policy" };
  }

  if (raw.forceBlockReason === "paid_api_forbidden") {
    reasons.push("paid_api_forbidden");
    return { pass: false, reasons, status: "blocked_policy" };
  }

  if (raw.sourceKind === "marketplace_listing") {
    reasons.push("marketplace_only_forbidden");
    reasons.push("official_source_not_priority");
    return { pass: false, reasons, status: "filtered_out" };
  }

  if (!OFFICIAL_KINDS.includes(raw.sourceKind) && raw.sourceKind !== "authorized_retailer_page" && raw.sourceKind !== "fixture_offline" && raw.sourceKind !== "manual_curated") {
    reasons.push("official_source_not_priority");
    return { pass: false, reasons, status: "filtered_out" };
  }

  if (!raw.brandName?.trim() || !raw.productNameKo?.trim()) {
    reasons.push("brand_or_name_missing");
  }

  const hasOfficialUrl =
    Boolean(raw.brandOfficialUrl?.trim()) ||
    Boolean(raw.officialMallUrl?.trim()) ||
    Boolean(raw.inciDisclosureUrl?.trim());
  if (!hasOfficialUrl && raw.sourceKind !== "fixture_offline") {
    reasons.push("official_source_missing");
  }

  if (!raw.fullIngredients?.trim()) {
    reasons.push("full_inci_missing");
  }

  if (hasInventedPriceOrStock(raw)) {
    reasons.push("price_or_stock_invented");
  }
  if (hasInventedCountry(raw)) {
    reasons.push("country_availability_invented");
  }

  if (raw.isFixture) {
    reasons.push("fixture_cannot_publish");
  }

  if (
    raw.usageGuidance &&
    !raw.usageGuidance.complete
  ) {
    reasons.push("usage_guidance_incomplete");
  }

  if (
    raw.images.some(
      (img) => img.rightsStatus === "unknown" || !img.verified,
    )
  ) {
    reasons.push("image_rights_unknown");
  }

  const blocking = reasons.filter(
    (r) =>
      r !== "fixture_cannot_publish" &&
      r !== "usage_guidance_incomplete" &&
      r !== "image_rights_unknown",
  );

  if (
    blocking.includes("price_or_stock_invented") ||
    blocking.includes("country_availability_invented")
  ) {
    return { pass: false, reasons, status: "filtered_out" };
  }

  if (
    blocking.includes("brand_or_name_missing") ||
    blocking.includes("official_source_missing") ||
    blocking.includes("full_inci_missing")
  ) {
    return { pass: false, reasons, status: "filtered_out" };
  }

  // Fixture with complete official-like fields → non-public but structurally ready path
  if (raw.isFixture) {
    return {
      pass: true,
      reasons: [...reasons, "needs_human_review"],
      status: "needs_review",
    };
  }

  reasons.push("needs_human_review");
  return {
    pass: true,
    reasons,
    status: "needs_review",
  };
}

export function isStructurallyCandidateReady(
  candidate: OfficialKrProductCandidate,
): boolean {
  if (candidate.publishAllowed !== false) return false;
  if (candidate.publicVisible !== false) return false;
  if (candidate.isFixture) return false;
  if (candidate.status !== "candidate_ready" && candidate.status !== "needs_review") {
    return false;
  }
  return (
    Boolean(candidate.fields.brandName) &&
    Boolean(candidate.fields.productNameKo) &&
    Boolean(candidate.fields.fullIngredients) &&
    (Boolean(candidate.fields.brandOfficialUrl) ||
      Boolean(candidate.fields.officialMallUrl) ||
      Boolean(candidate.fields.inciDisclosureUrl))
  );
}
