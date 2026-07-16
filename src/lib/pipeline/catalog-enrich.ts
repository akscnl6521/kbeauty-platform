import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { materializeDraftProduct } from "@/lib/pipeline/draft-product";
import { linkProductIngredients } from "@/lib/pipeline/ingredient-link";
import { discoverAndPersistOffers } from "@/lib/pipeline/offers/offer-persist";
import { verifyAndActivateProduct } from "@/lib/pipeline/product-verify/product-activate";
import { loadPipelineOperationConfig } from "@/lib/pipeline/operation-config";
import type {
  DedupeDecision,
  ExtractedCatalogProduct,
  IngredientParseResult,
  QualityScore,
  SkinClassification,
  ToneMatchResult,
} from "@/lib/pipeline/types";

export type CatalogEnrichResult = {
  draft: Awaited<ReturnType<typeof materializeDraftProduct>>;
  ingredients: Awaited<ReturnType<typeof linkProductIngredients>> | null;
  offers: Awaited<ReturnType<typeof discoverAndPersistOffers>> | null;
  activation: Awaited<ReturnType<typeof verifyAndActivateProduct>> | null;
  recommendationEligible: boolean;
};

/**
 * After gated candidate commit: draft → ingredients → offers → auto-verify/activate.
 */
export async function enrichCatalogAfterCandidate(
  client: SupabaseClient,
  input: {
    product: ExtractedCatalogProduct;
    brandName: string;
    batchId: string;
    candidateId: string | null;
    site: {
      classification?: string;
      confidence?: number;
      allowCrawl?: boolean;
      selectedUrl?: string | null;
    } | null;
    dedupe: DedupeDecision;
    quality: QualityScore;
    officialConfidence: number;
    parsedIngredients: IngredientParseResult;
    skin: SkinClassification;
    tone: ToneMatchResult;
    pageHtml?: string | null;
    safetyConflict?: boolean;
  }
): Promise<CatalogEnrichResult> {
  const op = loadPipelineOperationConfig();

  const draft = await materializeDraftProduct(client, {
    product: input.product,
    brandName: input.brandName,
    batchId: input.batchId,
    candidateId: input.candidateId,
    site: input.site,
    dedupe: input.dedupe,
    quality: input.quality,
    officialConfidence: input.officialConfidence,
  });

  let ingredients: CatalogEnrichResult["ingredients"] = null;
  if (
    draft.productId &&
    input.parsedIngredients.normalized.length > 0 &&
    op.allowProductIngredientInsert
  ) {
    ingredients = await linkProductIngredients(client, {
      productId: draft.productId,
      variantId: draft.variantId,
      parsed: input.parsedIngredients,
      sourceUrl: input.product.canonicalUrl,
      batchId: input.batchId,
    });
  } else if (
    draft.productId &&
    input.parsedIngredients.normalized.length === 0 &&
    op.allowQueueInsert
  ) {
    const { data: open } = await client
      .from("verification_queue")
      .select("id")
      .eq("entity_type", "product")
      .eq("entity_id", String(draft.productId))
      .eq("review_type", "ingredients")
      .in("status", ["pending", "in_review"])
      .limit(1);
    if (!(open ?? []).length) {
      await client.from("verification_queue").insert({
        entity_type: "product",
        entity_id: String(draft.productId),
        review_type: "ingredients",
        priority: 70,
        status: "pending",
        reason: "ingredients_missing",
        assigned_to: null,
        reviewer_notes: null,
      });
    }
  }

  let offers: CatalogEnrichResult["offers"] = null;
  if (
    draft.productId &&
    (op.allowOfferCandidateInsert || op.allowVerifiedOfferUpsert)
  ) {
    let html = input.pageHtml ?? null;
    if (!html) {
      const { fetchPublicHtmlPage } = await import(
        "@/lib/admin/import/fetch-page"
      );
      const page = await fetchPublicHtmlPage(input.product.canonicalUrl);
      if (page.ok) html = page.html;
    }

    if (html) {
      let officialHost: string | null = null;
      try {
        officialHost = input.site?.selectedUrl
          ? new URL(input.site.selectedUrl).hostname.replace(/^www\./i, "")
          : new URL(input.product.canonicalUrl).hostname.replace(/^www\./i, "");
      } catch {
        officialHost = null;
      }

      offers = await discoverAndPersistOffers(client, {
        productId: draft.productId,
        productName: input.product.productName,
        brandName: input.brandName,
        // Drafts may still receive verified offers (activation gate uses them)
        productActive: draft.created ? false : draft.linkedExisting ? null : false,
        pageHtml: html,
        pageUrl: input.product.canonicalUrl,
        officialHost,
        batchId: input.batchId,
        sizeLabel: input.product.sizeLabel,
      });
    }
  }

  let activation: CatalogEnrichResult["activation"] = null;
  if (
    draft.productId &&
    draft.created &&
    (op.allowProductAutoVerify || op.allowProductAutoActivate)
  ) {
    activation = await verifyAndActivateProduct(client, {
      productId: draft.productId,
      batchId: input.batchId,
      extracted: input.product,
      ambiguousIngredientCount: ingredients?.ambiguous ?? 0,
      unmatchedIngredientCount: ingredients?.unmatched ?? 0,
      safetyConflict: input.safetyConflict ?? false,
    });
  }

  return {
    draft,
    ingredients,
    offers,
    activation,
    recommendationEligible: Boolean(activation?.recommendationEligiblePreview),
  };
}
