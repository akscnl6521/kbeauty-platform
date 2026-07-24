/**
 * Safety eligibility + recommendation readiness gates (P3-T02).
 */

import type { RecommendationEligibility } from "@/lib/catalog/commonProduct";
import { BLOCKING_SAFETY_FLAGS } from "./constants";
import type {
  ApprovedOfficialManifestEntry,
  VerifiedPoolGateSnapshot,
  VerifiedPoolRawRecord,
  VerifiedPoolRejectionCode,
} from "./types";

export function isSafetyEligible(flags: string[] | undefined): boolean {
  if (!flags?.length) return true;
  return !flags.some((f) =>
    (BLOCKING_SAFETY_FLAGS as readonly string[]).includes(f),
  );
}

export function evaluateVerifiedPoolGates(input: {
  raw: VerifiedPoolRawRecord;
  manifest: ApprovedOfficialManifestEntry | null;
}): VerifiedPoolGateSnapshot {
  const { raw, manifest } = input;
  const rejectionCodes: VerifiedPoolRejectionCode[] = [];

  if (raw.forceRejectCode) {
    rejectionCodes.push(raw.forceRejectCode);
  }

  if (!manifest || !manifest.approved) {
    rejectionCodes.push("official_manifest_not_approved");
  }

  if (raw.sourceKind === "marketplace_listing") {
    rejectionCodes.push("marketplace_only_forbidden");
  }

  if (raw.forceRejectCode === "paid_api_forbidden") {
    // already pushed via forceRejectCode
  }

  const sourceVerified = raw.sourceVerification === "verified_official";
  if (!sourceVerified) {
    rejectionCodes.push("source_not_verified");
  }

  const ingredientsVerified =
    raw.ingredientsVerification === "verified_full_inci" &&
    Boolean(raw.fullIngredients?.trim());
  if (!ingredientsVerified) {
    rejectionCodes.push("ingredients_not_verified");
  }

  const imageRightsVerified =
    raw.imageRights === "verified_official" ||
    raw.imageRights === "verified_brand_permission";
  if (!imageRightsVerified) {
    rejectionCodes.push("image_rights_not_verified");
  }

  const purchaseOfferVerified =
    raw.offerVerification === "verified_purchase" &&
    Boolean(raw.purchaseUrl?.trim());
  if (!purchaseOfferVerified) {
    rejectionCodes.push("purchase_offer_missing");
  }

  if (raw.offerVerification === "invented_blocked") {
    rejectionCodes.push("invented_field_forbidden");
  }

  if (!raw.brandName?.trim() || !raw.productNameKo?.trim()) {
    rejectionCodes.push("brand_or_name_missing");
  }

  const safetyEligible = isSafetyEligible(raw.safetyFlags);
  if (!safetyEligible) {
    rejectionCodes.push("safety_ineligible");
  }

  if (raw.isFixture) {
    rejectionCodes.push("fixture_non_public");
  }
  if (raw.isDryRunRecord) {
    rejectionCodes.push("dry_run_non_public");
  }

  const uniqueCodes = [...new Set(rejectionCodes)];

  const coreVerified =
    sourceVerified &&
    ingredientsVerified &&
    imageRightsVerified &&
    purchaseOfferVerified &&
    safetyEligible &&
    Boolean(raw.brandName?.trim()) &&
    Boolean(raw.productNameKo?.trim()) &&
    Boolean(manifest?.approved) &&
    raw.sourceKind !== "marketplace_listing" &&
    raw.offerVerification !== "invented_blocked";

  // Structural recommendation readiness (staging review path).
  // Fixtures/dry-run may be structurally ready but never public.
  const recommendationReady =
    coreVerified &&
    !uniqueCodes.includes("paid_api_forbidden") &&
    !uniqueCodes.includes("captcha_or_login_forbidden") &&
    !uniqueCodes.includes("invented_field_forbidden");

  // Public Top 5 requires core verification AND live (non-fixture, non-dry-run).
  const publicTop5Allowed =
    recommendationReady && !raw.isFixture && !raw.isDryRunRecord;

  return {
    sourceVerified,
    ingredientsVerified,
    imageRightsVerified,
    purchaseOfferVerified,
    safetyEligible,
    recommendationReady,
    publicTop5Allowed,
    rejectionCodes: uniqueCodes,
  };
}

export function mapEligibilityFromGate(
  gate: VerifiedPoolGateSnapshot,
): RecommendationEligibility {
  if (!gate.safetyEligible) return "safety_hold";
  if (
    gate.rejectionCodes.includes("invented_field_forbidden") ||
    gate.rejectionCodes.includes("marketplace_only_forbidden") ||
    gate.rejectionCodes.includes("paid_api_forbidden") ||
    gate.rejectionCodes.includes("captcha_or_login_forbidden")
  ) {
    return "safety_hold";
  }
  if (
    !gate.sourceVerified ||
    !gate.ingredientsVerified ||
    !gate.imageRightsVerified ||
    !gate.purchaseOfferVerified
  ) {
    return "insufficient_data";
  }
  if (gate.recommendationReady) {
    // Structurally ready — still verification_required when fixture/dry-run
    // blocks public; callers distinguish via publicTop5Allowed.
    if (gate.publicTop5Allowed) return "recommendation_ready";
    return "verification_required";
  }
  return "verification_required";
}
