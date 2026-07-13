import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { findImportDuplicate } from "@/lib/admin/import/duplicate-check";
import type {
  DedupeDecision,
  ExtractedCatalogProduct,
} from "@/lib/pipeline/types";

/**
 * Deduplicate extracted products against candidates + products.
 */
export async function decideProductDedupe(
  client: SupabaseClient,
  product: ExtractedCatalogProduct
): Promise<DedupeDecision> {
  const dup = await findImportDuplicate(client, {
    canonicalUrl: product.canonicalUrl,
    productName: product.productName,
    brandName: product.brandName,
  });

  if (dup?.kind === "candidate") {
    const score = dup.linkedProductId ? 0.95 : 0.88;
    return {
      action: score >= 0.9 ? "link_existing" : "needs_review",
      score,
      reasons: [
        "discovery candidate URL/name 중복",
        dup.linkedProductId ? "이미 제품 연결됨" : "후보만 존재",
      ],
      existingCandidateId: dup.candidateId,
      existingProductId: dup.linkedProductId,
    };
  }

  if (dup?.kind === "product") {
    return {
      action: "link_existing",
      score: 0.92,
      reasons: ["products name+brand 중복"],
      existingCandidateId: null,
      existingProductId: dup.productId,
    };
  }

  if (product.confidence < 0.45) {
    return {
      action: "needs_review",
      score: product.confidence,
      reasons: ["추출 confidence 낮음"],
      existingCandidateId: null,
      existingProductId: null,
    };
  }

  return {
    action: "create_candidate",
    score: 0.2,
    reasons: ["신규 후보로 판단"],
    existingCandidateId: null,
    existingProductId: null,
  };
}
