import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { tryInsertWriteAudit } from "@/lib/admin/audit-log";
import { loadPipelineOperationConfig } from "@/lib/pipeline/operation-config";
import {
  evaluateProductVerificationGate,
  type ProductQualityGrade,
} from "@/lib/pipeline/product-verify/product-verify-gate";
import { computeQualityScore } from "@/lib/pipeline/scoring";
import {
  isOfferEligibleForCoreRecommendation,
  normalizeProductOffer,
} from "@/lib/recommend/productOffer";
import type { ShippingCountry } from "@/lib/recommend/selectPurchaseLink";
import type { ExtractedCatalogProduct } from "@/lib/pipeline/types";

const OFFICIAL_SOURCE_TYPES = new Set([
  "official_brand_page",
  "official_label",
  "official_retailer",
]);

export type ProductActivationResult = {
  productId: number;
  activated: boolean;
  verified: boolean;
  skippedReason: string | null;
  needsReview: boolean;
  queueCreated: boolean;
  ingredientsApproved: number;
  gateBlockers: string[];
  recommendationEligiblePreview: boolean;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

function gradeFromScore(score: number, blockers: string[]): ProductQualityGrade {
  if (score >= 0.8 && blockers.length === 0) return "A";
  if (score >= 0.65) return "B";
  if (score >= 0.5) return "C";
  if (blockers.length) return "Review Required";
  return "D";
}

/**
 * Evaluate + optionally activate a draft product.
 * Never publishes. Never demotes existing verified products.
 */
export async function verifyAndActivateProduct(
  client: SupabaseClient,
  input: {
    productId: number;
    batchId: string;
    /** Optional extraction snapshot for quality recompute */
    extracted?: ExtractedCatalogProduct | null;
    ambiguousIngredientCount?: number;
    unmatchedIngredientCount?: number;
    safetyConflict?: boolean;
  }
): Promise<ProductActivationResult> {
  const op = loadPipelineOperationConfig();
  const empty = (skippedReason: string): ProductActivationResult => ({
    productId: input.productId,
    activated: false,
    verified: false,
    skippedReason,
    needsReview: false,
    queueCreated: false,
    ingredientsApproved: 0,
    gateBlockers: [],
    recommendationEligiblePreview: false,
  });

  if (!op.allowProductAutoVerify || !op.allowProductAutoActivate) {
    return empty("auto_verify_disabled");
  }
  if (op.allowPublish || op.allowExistingProductOverwrite || op.allowProductDemotion) {
    return empty("hard_policy_violation");
  }

  const { data: productRow, error } = await client
    .from("products")
    .select(
      "id, name, brand, active, verified_at, full_ingredients, key_ingredients, data_confidence"
    )
    .eq("id", input.productId)
    .maybeSingle();

  if (error || !productRow) {
    return empty("product_not_found");
  }

  const row = productRow as {
    id: number;
    name: string;
    brand: string;
    active: boolean | null;
    verified_at: string | null;
    full_ingredients: unknown;
    key_ingredients: unknown;
    data_confidence: string | null;
  };

  // Never demote existing verified products
  if (row.active === true && row.verified_at) {
    return {
      ...empty("already_verified_active"),
      verified: true,
      activated: true,
      skippedReason: "already_verified_active",
    };
  }

  const { data: ingredientRows } = await client
    .from("product_ingredients")
    .select(
      "id, verification_status, verified_at, source_url, source_type"
    )
    .eq("product_id", input.productId)
    .limit(500);

  const ingredients = (ingredientRows ?? []) as Array<{
    id: string;
    verification_status: string;
    verified_at: string | null;
    source_url: string | null;
    source_type: string | null;
  }>;

  const officialStructured = ingredients.filter(
    (i) =>
      i.source_url &&
      i.source_type &&
      OFFICIAL_SOURCE_TYPES.has(i.source_type)
  );

  const { data: offerRows } = await client
    .from("product_offers")
    .select(
      "id, product_id, retailer_name, retailer_country, ships_to_countries, purchase_url, price, currency, stock_status, verification_status, is_official, verified_at, last_checked_at, active"
    )
    .eq("product_id", input.productId)
    .limit(100);

  const offers = (offerRows ?? [])
    .map((r) => normalizeProductOffer(r))
    .filter((o): o is NonNullable<typeof o> => o != null);

  const verifiedInStock = offers.filter(
    (o) =>
      o.verificationStatus === "verified" &&
      o.stockStatus === "in_stock" &&
      o.price != null &&
      o.price > 0 &&
      o.currency &&
      o.verifiedAt &&
      o.purchaseUrl?.startsWith("https://") &&
      (o.shipsToCountries?.length ?? 0) > 0 &&
      o.active !== false
  );

  const priorityCountries = (op.shippingCountriesPriority.length
    ? op.shippingCountriesPriority
    : ["KR", "US", "JP"]) as ShippingCountry[];

  let countryEligible = 0;
  for (const c of priorityCountries) {
    if (
      offers.some((o) => isOfferEligibleForCoreRecommendation(o, c)) ||
      verifiedInStock.some(
        (o) =>
          o.retailerCountry === c &&
          o.shipsToCountries.includes(c) &&
          o.currency ===
            (c === "KR" ? "KRW" : c === "JP" ? "JPY" : "USD")
      )
    ) {
      countryEligible += 1;
    }
  }
  // Fallback: any verified in-stock with shipping list counts as country-eligible signal
  if (countryEligible === 0 && verifiedInStock.length > 0) {
    countryEligible = verifiedInStock.filter(
      (o) => (o.shipsToCountries?.length ?? 0) > 0
    ).length > 0
      ? 1
      : 0;
  }

  const fullIngredients = asStringArray(row.full_ingredients);
  const keyIngredients = asStringArray(row.key_ingredients);
  const hasOfficialText =
    fullIngredients.length > 0 ||
    Boolean(input.extracted?.fullIngredientsText?.trim());

  const extracted: ExtractedCatalogProduct = input.extracted ?? {
    productName: row.name,
    brandName: row.brand,
    canonicalUrl: "https://example.invalid/unknown",
    category: null,
    imageUrl: null,
    description: null,
    fullIngredientsText: fullIngredients.join(", ") || null,
    keyIngredients,
    sizeLabel: null,
    priceReference: null,
    currency: null,
    availabilityReference: null,
    country: null,
    sourceType: "official_site",
    confidence: 0.75,
    extractionMethod: "product_activate",
    fieldConfidence: {},
  };

  const quality = computeQualityScore({
    product: extracted,
    hasIngredients: hasOfficialText && officialStructured.length > 0,
    hasOfficialSource: true,
    dedupeOk: true,
    offerCount: verifiedInStock.length,
  });

  const allowedGrades = op.productVerifyQualityGrades as ProductQualityGrade[];
  const grade =
    (quality.grade as ProductQualityGrade) ||
    gradeFromScore(quality.score, quality.blockers);

  const gate = evaluateProductVerificationGate({
    active: row.active,
    verifiedAt: row.verified_at,
    qualityGrade: grade,
    allowedGrades,
    hasOfficialIngredientsText: hasOfficialText,
    structuredOfficialIngredientCount: officialStructured.length,
    ambiguousIngredientCount: input.ambiguousIngredientCount ?? 0,
    unmatchedIngredientCount: input.unmatchedIngredientCount ?? 0,
    safetyConflict: input.safetyConflict ?? false,
    verifiedInStockOfferCount: verifiedInStock.length,
    countryEligibleOfferCount: countryEligible,
    allowPublish: op.allowPublish,
    allowProductDemotion: op.allowProductDemotion,
  });

  if (gate.skipAsUnchanged || (row.active === true && row.verified_at)) {
    return {
      productId: input.productId,
      activated: true,
      verified: true,
      skippedReason: "unchanged",
      needsReview: false,
      queueCreated: false,
      ingredientsApproved: 0,
      gateBlockers: [],
      recommendationEligiblePreview: verifiedInStock.length > 0,
    };
  }

  if (!gate.canActivate) {
    let queueCreated = false;
    if (gate.needsReview && op.allowQueueInsert && op.allowProductVerifyReviewQueue) {
      const reasonCode = `product_verify_fail:${gate.blockers.slice(0, 5).join(",")}`;
      const { data: open } = await client
        .from("verification_queue")
        .select("id")
        .eq("entity_type", "product")
        .eq("entity_id", String(input.productId))
        .eq("review_type", "other")
        .eq("reason", reasonCode)
        .in("status", ["pending", "in_review"])
        .limit(1);

      if (!(open ?? []).length) {
        const { data: q } = await client
          .from("verification_queue")
          .insert({
            entity_type: "product",
            entity_id: String(input.productId),
            review_type: "other",
            priority: 60,
            status: "pending",
            reason: reasonCode,
            assigned_to: null,
            reviewer_notes: null,
          })
          .select("id")
          .single();
        queueCreated = Boolean((q as { id?: string } | null)?.id);
        if (queueCreated && op.allowAuditInsert) {
          await tryInsertWriteAudit(client, {
            action: "verification_queue_created",
            productId: input.productId,
            actorRole: "admin",
            metadata: {
              via: "product_auto_verify",
              blockers: gate.blockers,
              batchId: input.batchId,
            },
          });
        }
      }
    }

    return {
      productId: input.productId,
      activated: false,
      verified: false,
      skippedReason: "gate_failed",
      needsReview: gate.needsReview,
      queueCreated,
      ingredientsApproved: 0,
      gateBlockers: gate.blockers,
      recommendationEligiblePreview: false,
    };
  }

  // Approve official pending ingredients (required for recommendationEligible)
  let ingredientsApproved = 0;
  if (op.allowAutoApproveOfficialIngredients) {
    const nowIso = new Date().toISOString();
    for (const ing of officialStructured) {
      if (ing.verification_status === "approved" && ing.verified_at) continue;
      const { error: upErr } = await client
        .from("product_ingredients")
        .update({
          verification_status: "approved",
          verified_at: nowIso,
        })
        .eq("id", ing.id)
        .eq("product_id", input.productId);
      if (!upErr) ingredientsApproved += 1;
    }
  }

  const verifiedAt = new Date().toISOString();
  const { error: prodErr } = await client
    .from("products")
    .update({
      active: true,
      verified_at: verifiedAt,
      data_confidence: grade,
    })
    .eq("id", input.productId)
    .is("verified_at", null);

  if (prodErr) {
    return {
      productId: input.productId,
      activated: false,
      verified: false,
      skippedReason: `update_failed:${prodErr.message}`,
      needsReview: true,
      queueCreated: false,
      ingredientsApproved,
      gateBlockers: ["update_failed"],
      recommendationEligiblePreview: false,
    };
  }

  // Idempotent: if another worker raced, re-check
  const { data: after } = await client
    .from("products")
    .select("active, verified_at")
    .eq("id", input.productId)
    .maybeSingle();

  const activated =
    (after as { active?: boolean; verified_at?: string } | null)?.active ===
      true &&
    Boolean(
      (after as { verified_at?: string } | null)?.verified_at
    );

  if (activated && op.allowAuditInsert) {
    await tryInsertWriteAudit(client, {
      action: "verification_approved",
      productId: input.productId,
      actorRole: "admin",
      metadata: {
        via: "product_auto_verify",
        batchId: input.batchId,
        grade,
        ingredientsApproved,
        verifiedOfferCount: verifiedInStock.length,
        published: false,
      },
      oldValue: {
        active: row.active,
        verified_at: row.verified_at,
      },
    });
  }

  return {
    productId: input.productId,
    activated,
    verified: activated,
    skippedReason: activated ? null : "race_or_no_row",
    needsReview: false,
    queueCreated: false,
    ingredientsApproved,
    gateBlockers: [],
    recommendationEligiblePreview: activated && verifiedInStock.length > 0,
  };
}
