import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { tryInsertWriteAudit } from "@/lib/admin/audit-log";
import { extractDomain } from "@/lib/admin/import/normalize";
import { findImportDuplicate } from "@/lib/admin/import/duplicate-check";
import type { ExtractedCatalogProduct } from "@/lib/pipeline/types";
import { evaluateCandidateCommitGate } from "@/lib/pipeline/quality-gate";
import type { OfficialSiteResolution } from "@/lib/pipeline/official-site-resolver";
import {
  isPlaceholderBrand,
  looksLikeProductTitle,
  looksLikeProductUrl,
} from "@/lib/pipeline/product-page";
import type { DedupeDecision, QualityScore } from "@/lib/pipeline/types";

function resolveBrandName(
  productBrand: string | null | undefined,
  fallback: string
): string {
  if (!isPlaceholderBrand(productBrand)) return String(productBrand).trim();
  return fallback.trim();
}

export type CandidateCommitResult = {
  candidateId: string | null;
  queueId: string | null;
  skippedReason: string | null;
  committed: boolean;
};

/**
 * Idempotent gated commit of a discovery candidate + duplicate queue.
 * Allowed: NEW candidate INSERT, NEW duplicate queue INSERT, audit INSERT.
 * Never: products/ingredients/offers, published/verified, DELETE,
 *        existing candidate UPDATE/bulk reclassify.
 */
export async function commitDiscoveryCandidateGated(
  client: SupabaseClient,
  input: {
    product: ExtractedCatalogProduct;
    brandName: string;
    batchId: string;
    site: OfficialSiteResolution | null;
    dedupe: DedupeDecision;
    quality: QualityScore;
    officialConfidence: number;
  }
): Promise<CandidateCommitResult> {
  const { loadPipelineOperationConfig } = await import(
    "@/lib/pipeline/operation-config"
  );
  const op = loadPipelineOperationConfig();
  if (!op.allowCandidateInsert) {
    return {
      candidateId: null,
      queueId: null,
      skippedReason: "allowCandidateInsert=false",
      committed: false,
    };
  }
  if (
    op.allowProductInsert ||
    op.allowOfferInsert ||
    op.allowPublish ||
    op.allowDelete
  ) {
    return {
      candidateId: null,
      queueId: null,
      skippedReason: "hard_policy_violation",
      committed: false,
    };
  }

  const brandName = resolveBrandName(input.product.brandName, input.brandName);
  const product = { ...input.product, brandName };

  const gate = evaluateCandidateCommitGate({
    site: input.site,
    product,
    dedupe: input.dedupe,
    quality: input.quality,
    officialConfidence: input.officialConfidence,
  });

  const hardBlock = gate.blockers.some((b) =>
    /marketplace|retailer|social|blocked|https|제품 URL|브랜드명 없음|제품명 없음|publishEligible|중복 판정/i.test(
      b
    )
  );

  // Soft path: valid product-ish fields but gate not fully passed → INSERT needs_review (new rows only)
  const softInsert =
    !gate.pass &&
    !hardBlock &&
    Boolean(product.canonicalUrl?.startsWith("https://")) &&
    looksLikeProductUrl(product.canonicalUrl) &&
    looksLikeProductTitle(product.productName) &&
    !isPlaceholderBrand(brandName) &&
    input.dedupe.action === "create_candidate";

  if (!gate.pass && !softInsert) {
    return {
      candidateId: null,
      queueId: null,
      skippedReason: gate.blockers.join("; ") || "gate_failed",
      committed: false,
    };
  }

  const workflowStatus = gate.pass ? "discovered" : "needs_review";

  const dup = await findImportDuplicate(client, {
    canonicalUrl: product.canonicalUrl,
    productName: product.productName,
    brandName,
  });
  if (dup) {
    return {
      candidateId: dup.kind === "candidate" ? dup.candidateId : null,
      queueId: null,
      skippedReason: "duplicate_recheck",
      committed: false,
    };
  }

  const notes = [
    `autonomous_pipeline batch=${input.batchId}`,
    `quality=${input.quality.grade}`,
    `officialConfidence=${input.officialConfidence.toFixed(2)}`,
    gate.pass
      ? gate.reasons[0] ?? "gated commit"
      : `needs_review: ${gate.blockers.join("; ")}`,
  ]
    .join(" | ")
    .slice(0, 2000);

  const { data, error } = await client
    .from("product_discovery_candidates")
    .insert({
      discovered_name: product.productName,
      discovered_brand: brandName,
      discovered_url: product.canonicalUrl,
      discovered_country: product.country,
      source_type: "official_brand_page",
      notes,
      workflow_status: workflowStatus,
      duplicate_check_status: "pending",
      sale_check_status: "pending",
      ingredient_check_status: "pending",
      evidence_check_status: "pending",
      safety_check_status: "pending",
      linked_product_id: null,
      assigned_to: null,
      search_query: null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      candidateId: null,
      queueId: null,
      skippedReason: "insert_failed",
      committed: false,
    };
  }

  const candidateId = (data as { id: string }).id;

  if (op.allowAuditInsert) {
    await tryInsertWriteAudit(client, {
      action: "candidate_imported_from_url",
      productId: null,
      actorRole: "admin",
      metadata: {
        candidateId,
        domain: extractDomain(product.canonicalUrl),
        via: "autonomous_pipeline",
        batchId: input.batchId,
      },
    });
  }

  let queueId: string | null = null;
  if (!op.allowQueueInsert) {
    return { candidateId, queueId: null, skippedReason: null, committed: true };
  }
  const { data: openRows } = await client
    .from("verification_queue")
    .select("id")
    .eq("entity_type", "candidate")
    .eq("entity_id", candidateId)
    .eq("review_type", "duplicate")
    .in("status", ["pending", "in_review"])
    .limit(1);

  const existing = (openRows ?? [])[0] as { id: string } | undefined;
  if (existing) {
    queueId = existing.id;
  } else {
    const { data: queue } = await client
      .from("verification_queue")
      .insert({
        entity_type: "candidate",
        entity_id: candidateId,
        review_type: "duplicate",
        priority: 100,
        status: "pending",
        reason: "autonomous pipeline duplicate check",
        assigned_to: null,
        reviewer_notes: null,
      })
      .select("id")
      .single();
    queueId = (queue as { id?: string } | null)?.id ?? null;

    if (queueId) {
      await tryInsertWriteAudit(client, {
        action: "verification_queue_created",
        productId: null,
        actorRole: "admin",
        metadata: {
          queueId,
          candidateId,
          reviewType: "duplicate",
          via: "autonomous_pipeline",
        },
      });
    }
  }

  return { candidateId, queueId, skippedReason: null, committed: true };
}
