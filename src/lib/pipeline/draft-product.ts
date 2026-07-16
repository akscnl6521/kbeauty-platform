import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { tryInsertWriteAudit } from "@/lib/admin/audit-log";
import { extractDomain } from "@/lib/admin/import/normalize";
import { classifyProductCategory } from "@/lib/pipeline/category-classify";
import { loadPipelineOperationConfig } from "@/lib/pipeline/operation-config";
import {
  looksLikeProductTitle,
  looksLikeProductUrl,
  isPlaceholderBrand,
} from "@/lib/pipeline/product-page";
import type {
  DedupeDecision,
  ExtractedCatalogProduct,
  QualityScore,
} from "@/lib/pipeline/types";

// Avoid circular import — minimal site shape
export type OfficialSiteLike = {
  classification?: string;
  confidence?: number;
  allowCrawl?: boolean;
} | null;

function slugify(name: string, brand: string): string {
  const base = `${brand}-${name}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return base || `draft-${Date.now()}`;
}

export type DraftProductResult = {
  productId: number | null;
  variantId: string | null;
  created: boolean;
  linkedExisting: boolean;
  skippedReason: string | null;
  recommendationEligible: false;
};

/**
 * Insert draft product (active=false) when identity gate passes.
 * Never publishes; never writes offers; never overwrites existing products.
 */
export async function materializeDraftProduct(
  client: SupabaseClient,
  input: {
    product: ExtractedCatalogProduct;
    brandName: string;
    batchId: string;
    candidateId: string | null;
    site: OfficialSiteLike;
    dedupe: DedupeDecision;
    quality: QualityScore;
    officialConfidence: number;
  }
): Promise<DraftProductResult> {
  const op = loadPipelineOperationConfig();
  const empty: DraftProductResult = {
    productId: null,
    variantId: null,
    created: false,
    linkedExisting: false,
    skippedReason: null,
    recommendationEligible: false,
  };

  if (!op.allowDraftProductInsert) {
    return { ...empty, skippedReason: "allowDraftProductInsert=false" };
  }
  if (op.allowPublish || op.allowExistingProductOverwrite || op.allowProductInsert) {
    return { ...empty, skippedReason: "hard_policy_violation" };
  }

  const brand = input.brandName.trim();
  const name = input.product.productName.trim();
  if (isPlaceholderBrand(brand) || !looksLikeProductTitle(name)) {
    return { ...empty, skippedReason: "identity_incomplete" };
  }
  if (!looksLikeProductUrl(input.product.canonicalUrl)) {
    return { ...empty, skippedReason: "not_product_url" };
  }
  if (input.officialConfidence < 0.65) {
    return { ...empty, skippedReason: "official_confidence_low" };
  }
  if (input.site && input.site.allowCrawl === false) {
    return { ...empty, skippedReason: "crawl_not_allowed" };
  }
  if (
    input.site?.classification &&
    ["marketplace", "retailer", "social", "blocked", "unrelated"].includes(
      input.site.classification
    )
  ) {
    return { ...empty, skippedReason: `site_${input.site.classification}` };
  }
  if (input.product.confidence < op.draftProductQualityThreshold) {
    return { ...empty, skippedReason: "extraction_confidence_low" };
  }
  if (input.quality.publishEligible) {
    return { ...empty, skippedReason: "publishEligible_blocked" };
  }

  const category = classifyProductCategory(input.product);
  if (!category.category || category.confidence < 0.55) {
    return { ...empty, skippedReason: "category_uncertain" };
  }

  if (input.dedupe.action === "link_existing" && input.dedupe.existingProductId) {
    return {
      ...empty,
      productId: input.dedupe.existingProductId,
      linkedExisting: true,
      skippedReason: "linked_existing",
    };
  }
  if (input.dedupe.action === "needs_review") {
    return { ...empty, skippedReason: "dedupe_needs_review" };
  }

  // Idempotency: same name+brand already in products
  const { data: existing } = await client
    .from("products")
    .select("id, active")
    .ilike("name", name)
    .ilike("brand", brand)
    .limit(2);

  if ((existing ?? []).length > 1) {
    return { ...empty, skippedReason: "ambiguous_existing_product" };
  }
  if ((existing ?? []).length === 1) {
    const id = (existing![0] as { id: number }).id;
    if (input.candidateId) {
      await client
        .from("product_discovery_candidates")
        .update({ linked_product_id: id })
        .eq("id", input.candidateId)
        .is("linked_product_id", null);
    }
    return {
      ...empty,
      productId: id,
      linkedExisting: true,
      skippedReason: "existing_name_brand",
    };
  }

  const slug = slugify(name, brand);
  const { data: slugHit } = await client
    .from("products")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  const finalSlug = slugHit
    ? `${slug}-${Date.now().toString(36).slice(-4)}`
    : slug;

  const row = {
    name,
    brand,
    slug: finalSlug,
    category: category.category,
    active: false,
    verified_at: null,
    data_confidence: Math.min(input.product.confidence, input.officialConfidence),
    key_ingredients: input.product.keyIngredients.slice(0, 12),
    full_ingredients: input.product.fullIngredientsText
      ? [input.product.fullIngredientsText.slice(0, 2000)]
      : [],
    recommendation_reason: null,
    skin_concern: [],
    skin_tone: [],
  };

  const { data: inserted, error } = await client
    .from("products")
    .insert(row)
    .select("id")
    .single();

  if (error || !inserted) {
    return { ...empty, skippedReason: "insert_failed" };
  }

  const productId = (inserted as { id: number }).id;

  if (op.allowAuditInsert) {
    await tryInsertWriteAudit(client, {
      action: "discovery_candidate_created",
      productId,
      actorRole: "admin",
      metadata: {
        via: "autonomous_draft_catalog",
        batchId: input.batchId,
        domain: extractDomain(input.product.canonicalUrl),
        active: false,
        recommendationEligible: false,
        candidateId: input.candidateId,
      },
    });
  }

  if (input.candidateId) {
    await client
      .from("product_discovery_candidates")
      .update({ linked_product_id: productId })
      .eq("id", input.candidateId);
  }

  let variantId: string | null = null;
  if (op.allowVariantInsert && input.product.sizeLabel) {
    const { data: variant } = await client
      .from("product_variants")
      .insert({
        product_id: productId,
        country_code: input.product.country?.slice(0, 2)?.toUpperCase() || "KR",
        variant_name: input.product.sizeLabel.slice(0, 120),
        size_value: null,
        size_unit: null,
        verification_status: "pending",
        active: false,
      })
      .select("id")
      .single();
    variantId = (variant as { id?: string } | null)?.id ?? null;
  }

  return {
    productId,
    variantId,
    created: true,
    linkedExisting: false,
    skippedReason: null,
    recommendationEligible: false,
  };
}
