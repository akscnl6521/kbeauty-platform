/**
 * SSOT: when a catalog product may enter the Korea MVP recommendable pool.
 * Does NOT auto-set verified_at. Does NOT invent ingredients or offers.
 *
 * Two layers:
 * 1) Staging candidate readiness (catalog_staging_products.recommendable)
 * 2) Public Top5 core eligibility (active + verified + structured INCI + KR offer)
 */

import { isOfferEligibleForCoreRecommendation } from "@/lib/recommend/productOffer";
import type { ProductOffer } from "@/lib/recommend/catalogTypes";
import type { ShippingCountry } from "@/lib/recommend/selectPurchaseLink";
import {
  evaluateRecommendationEligibility,
  type ProductRecommendationSnapshot,
} from "@/lib/pipeline/product-verify/recommendation-eligibility";

export type RecommendableReviewBucket =
  | "READY_FOR_REVIEW"
  | "MISSING_OFFICIAL_INCI"
  | "IMAGE_INVALID"
  | "OFFER_INVALID"
  | "DUPLICATE_SUSPECT"
  | "VARIANT_MISMATCH"
  | "SOURCE_CONFLICT"
  | "READY_TO_RECOMMEND"
  | "BLOCKED";

export type StagingRecommendableInput = {
  productStatus: string | null | undefined;
  matchClass: string | null | undefined;
  ingredientsStatus: string | null | undefined;
  recommendableFlag?: boolean | null;
  hasOfficialUrl?: boolean;
  hasPrimaryImage?: boolean;
  imageValid?: boolean | null;
  hasKrOfferCandidate?: boolean;
  duplicateSuspect?: boolean;
  variantMismatch?: boolean;
  sourceConflict?: boolean;
  officialInciBlocked?: boolean;
};

export type StagingRecommendableResult = {
  readyToRecommend: boolean;
  bucket: RecommendableReviewBucket;
  blockers: string[];
  reasons: string[];
};

const REJECTED = new Set(["rejected", "discontinued", "duplicate_candidate"]);
const DRAFTISH = new Set([
  "discovered",
  "fetched",
  "parsed",
  "source_verified",
]);

/**
 * Staging → recommendable pool gate (never auto-verified).
 */
export function evaluateStagingRecommendable(
  input: StagingRecommendableInput
): StagingRecommendableResult {
  const blockers: string[] = [];
  const reasons: string[] = [];
  const status = String(input.productStatus ?? "").toLowerCase();
  const match = String(input.matchClass ?? "").toLowerCase();
  const inci = String(input.ingredientsStatus ?? "").toLowerCase();

  if (input.officialInciBlocked) {
    return {
      readyToRecommend: false,
      bucket: "BLOCKED",
      blockers: ["official_inci_verbatim_unavailable"],
      reasons,
    };
  }
  if (input.sourceConflict) {
    return {
      readyToRecommend: false,
      bucket: "SOURCE_CONFLICT",
      blockers: ["official_source_conflict"],
      reasons,
    };
  }
  if (input.variantMismatch) {
    return {
      readyToRecommend: false,
      bucket: "VARIANT_MISMATCH",
      blockers: ["variant_or_shade_mismatch"],
      reasons,
    };
  }
  if (input.duplicateSuspect || status === "duplicate_candidate" || match === "duplicate") {
    return {
      readyToRecommend: false,
      bucket: "DUPLICATE_SUSPECT",
      blockers: ["duplicate_suspect"],
      reasons,
    };
  }
  if (REJECTED.has(status)) {
    return {
      readyToRecommend: false,
      bucket: "BLOCKED",
      blockers: [`status_${status || "unknown"}`],
      reasons,
    };
  }
  if (!input.hasOfficialUrl && match !== "official_matched") {
    blockers.push("official_source_missing");
  }
  if (
    !inci ||
    inci === "not_found" ||
    (inci !== "raw_collected" &&
      inci !== "parsed" &&
      inci !== "normalized" &&
      inci !== "source_verified")
  ) {
    return {
      readyToRecommend: false,
      bucket: "MISSING_OFFICIAL_INCI",
      blockers: ["official_inci_missing", ...blockers],
      reasons,
    };
  }
  if (input.imageValid === false || (input.hasPrimaryImage === false && input.imageValid !== true)) {
    return {
      readyToRecommend: false,
      bucket: "IMAGE_INVALID",
      blockers: ["image_invalid_or_missing", ...blockers],
      reasons,
    };
  }
  if (input.hasKrOfferCandidate === false) {
    return {
      readyToRecommend: false,
      bucket: "OFFER_INVALID",
      blockers: ["kr_offer_unclear", ...blockers],
      reasons,
    };
  }
  if (DRAFTISH.has(status) || status === "needs_review" || status === "data_complete") {
    reasons.push("needs_human_review_before_public");
    return {
      readyToRecommend: false,
      bucket: "READY_FOR_REVIEW",
      blockers: blockers.length ? blockers : ["awaiting_review"],
      reasons,
    };
  }

  if (blockers.length) {
    return {
      readyToRecommend: false,
      bucket: "READY_FOR_REVIEW",
      blockers,
      reasons,
    };
  }

  reasons.push("staging_fields_complete");
  if (input.recommendableFlag === true) reasons.push("staging_recommendable_flag");
  return {
    readyToRecommend: true,
    bucket: "READY_TO_RECOMMEND",
    blockers: [],
    reasons,
  };
}

/**
 * Public Top5 gate — delegates to shared eligibility (no padding).
 */
export function evaluatePublicCoreRecommendable(
  product: ProductRecommendationSnapshot,
  country: ShippingCountry = "KR"
) {
  return evaluateRecommendationEligibility(product, country);
}

export function countEligibleKrOffers(offers: ProductOffer[]): number {
  return offers.filter((o) => isOfferEligibleForCoreRecommendation(o, "KR")).length;
}

/** Tiny / placeholder image heuristic (bytes). */
export const MIN_VALID_IMAGE_BYTES = 1000;

export function isTinyPlaceholderImage(contentLength: number | null | undefined): boolean {
  if (contentLength == null || !Number.isFinite(contentLength)) return false;
  return contentLength > 0 && contentLength < MIN_VALID_IMAGE_BYTES;
}
