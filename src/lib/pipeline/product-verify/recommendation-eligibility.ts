/**
 * Shared recommendation eligibility (product + country offer).
 * Pure helpers — no DB writes.
 */

import { isOfferEligibleForCoreRecommendation } from "@/lib/recommend/productOffer";
import type { ProductOffer } from "@/lib/recommend/catalogTypes";
import type { ShippingCountry } from "@/lib/recommend/selectPurchaseLink";

export type ProductRecommendationSnapshot = {
  active: boolean | null;
  verifiedAt: string | null;
  approvedStructuredIngredientCount: number;
  offers: ProductOffer[];
};

export type RecommendationEligibilityResult = {
  eligible: boolean;
  reasons: string[];
  blockers: string[];
  country: ShippingCountry | null;
  eligibleOfferCount: number;
};

/**
 * Core Top5 eligibility for a shipping country.
 * Does not pad results — callers must accept fewer than 5.
 */
export function evaluateRecommendationEligibility(
  product: ProductRecommendationSnapshot,
  shippingCountry: ShippingCountry,
  options?: { requireFreshnessHours?: number; now?: Date }
): RecommendationEligibilityResult {
  const blockers: string[] = [];
  const reasons: string[] = [];
  const now = options?.now ?? new Date();
  const freshnessHours = options?.requireFreshnessHours;

  if (product.active !== true) blockers.push("product_not_active");
  if (!product.verifiedAt) blockers.push("product_not_verified");
  if (product.approvedStructuredIngredientCount < 1) {
    blockers.push("structured_ingredients_incomplete");
  }

  let eligibleOffers = product.offers.filter((o) =>
    isOfferEligibleForCoreRecommendation(o, shippingCountry)
  );

  if (typeof freshnessHours === "number" && freshnessHours > 0) {
    const maxAgeMs = freshnessHours * 3600_000;
    eligibleOffers = eligibleOffers.filter((o) => {
      const checked = o.lastCheckedAt ?? o.verifiedAt;
      if (!checked) return false;
      const t = Date.parse(checked);
      if (!Number.isFinite(t)) return false;
      return now.getTime() - t <= maxAgeMs;
    });
  }

  if (eligibleOffers.length < 1) {
    blockers.push("no_country_eligible_verified_offer");
  } else {
    reasons.push(`eligible_offers=${eligibleOffers.length}`);
  }

  return {
    eligible: blockers.length === 0,
    reasons,
    blockers,
    country: shippingCountry,
    eligibleOfferCount: eligibleOffers.length,
  };
}

/**
 * Never invent filler products to reach Top N.
 */
export { clampTopNWithoutPadding } from "@/lib/recommend/clampTopN";
