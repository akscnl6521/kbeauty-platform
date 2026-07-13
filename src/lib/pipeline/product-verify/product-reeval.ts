import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPipelineOperationConfig } from "@/lib/pipeline/operation-config";
import { verifyAndActivateProduct } from "@/lib/pipeline/product-verify/product-activate";
import { shouldDemoteVerifiedProduct } from "@/lib/pipeline/product-verify/product-verify-gate";
import {
  evaluateRecommendationEligibility,
} from "@/lib/pipeline/product-verify/recommendation-eligibility";
import { normalizeProductOffer } from "@/lib/recommend/productOffer";
import type { ShippingCountry } from "@/lib/recommend/selectPurchaseLink";

export type ProductReevalResult = {
  scanned: number;
  activated: number;
  skippedUnchanged: number;
  needsReview: number;
  demotionsBlocked: number;
  eligibilityFalse: number;
};

/**
 * Re-evaluate draft products for auto-verify, and check eligibility
 * for already-verified products without demotion.
 */
export async function reevaluateProductsForActivation(
  client: SupabaseClient,
  input: { batchId: string; limit?: number }
): Promise<ProductReevalResult> {
  const op = loadPipelineOperationConfig();
  const result: ProductReevalResult = {
    scanned: 0,
    activated: 0,
    skippedUnchanged: 0,
    needsReview: 0,
    demotionsBlocked: 0,
    eligibilityFalse: 0,
  };

  if (!op.allowProductReevaluation) {
    return result;
  }

  const limit = Math.min(
    input.limit ?? op.maxProductVerificationsPerRun,
    op.maxProductVerificationsPerRun
  );

  // Draft candidates: inactive + unverified
  const { data: drafts } = await client
    .from("products")
    .select("id")
    .eq("active", false)
    .is("verified_at", null)
    .order("id", { ascending: false })
    .limit(limit);

  for (const d of drafts ?? []) {
    const id = Number((d as { id: number }).id);
    if (!Number.isFinite(id)) continue;
    result.scanned += 1;
    const out = await verifyAndActivateProduct(client, {
      productId: id,
      batchId: input.batchId,
    });
    if (out.activated && out.skippedReason !== "already_verified_active") {
      if (out.skippedReason === "unchanged" || out.skippedReason === "already_verified_active") {
        result.skippedUnchanged += 1;
      } else if (out.activated) {
        result.activated += 1;
      }
    } else if (out.skippedReason === "already_verified_active" || out.skippedReason === "unchanged") {
      result.skippedUnchanged += 1;
    } else if (out.activated) {
      result.activated += 1;
    } else if (out.needsReview) {
      result.needsReview += 1;
    }
  }

  // Already verified: eligibility only — never demote
  if (op.allowProductReevaluation) {
    const { data: verified } = await client
      .from("products")
      .select("id, active, verified_at")
      .eq("active", true)
      .not("verified_at", "is", null)
      .order("id", { ascending: false })
      .limit(Math.min(20, limit));

    const country = (op.shippingCountriesPriority[0] ?? "KR") as ShippingCountry;

    for (const v of verified ?? []) {
      const id = Number((v as { id: number }).id);
      const { data: offerRows } = await client
        .from("product_offers")
        .select(
          "id, product_id, retailer_name, retailer_country, ships_to_countries, purchase_url, price, currency, stock_status, verification_status, is_official, verified_at, last_checked_at, active"
        )
        .eq("product_id", id)
        .limit(50);

      const offers = (offerRows ?? [])
        .map((r) => normalizeProductOffer(r))
        .filter((o): o is NonNullable<typeof o> => o != null);

      const { data: ings } = await client
        .from("product_ingredients")
        .select("id, verification_status, verified_at, source_url, source_type")
        .eq("product_id", id)
        .eq("verification_status", "approved")
        .limit(50);

      const elig = evaluateRecommendationEligibility(
        {
          active: true,
          verifiedAt: (v as { verified_at: string }).verified_at,
          approvedStructuredIngredientCount: (ings ?? []).length,
          offers,
        },
        country,
        { requireFreshnessHours: op.offerFreshnessHours }
      );

      if (!elig.eligible) {
        result.eligibilityFalse += 1;
      }

      const demote = shouldDemoteVerifiedProduct({
        hadVerifiedOffers: offers.some((o) => o.verificationStatus === "verified"),
        nowHasEligibleOffers: elig.eligibleOfferCount > 0,
        allowProductDemotion: op.allowProductDemotion,
      });
      if (demote) {
        // Policy forbids — count only
        result.demotionsBlocked += 1;
      } else if (!elig.eligible) {
        result.demotionsBlocked += 1; // would-have-demoted blocked
      }
    }
  }

  return result;
}
