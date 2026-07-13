import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { materializeDraftProduct } from "@/lib/pipeline/draft-product";
import { linkProductIngredients } from "@/lib/pipeline/ingredient-link";
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
  recommendationEligible: false;
};

/**
 * After gated candidate commit: optional draft product + ingredient links.
 * Scores are persisted by orchestrator via persistence layer.
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
    } | null;
    dedupe: DedupeDecision;
    quality: QualityScore;
    officialConfidence: number;
    parsedIngredients: IngredientParseResult;
    skin: SkinClassification;
    tone: ToneMatchResult;
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
    // ingredients_missing → needs_review queue only
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

  return {
    draft,
    ingredients,
    recommendationEligible: false,
  };
}
