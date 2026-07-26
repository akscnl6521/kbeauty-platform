/**
 * Staging / admin review linkage for product automation candidates.
 * Read-model only — no DB writes, no auto-promote.
 */

import type { CommonProduct } from "@/lib/catalog/commonProduct";
import type { ProductAutomationCandidate } from "./types";
import type { ProductAutomationRunSummary } from "./types";

export type AdminCatalogReviewLink = {
  candidateId: string;
  adminPath: string;
  reviewStatus: ProductAutomationCandidate["reviewStatus"];
  qualityStatus: ProductAutomationCandidate["qualityStatus"];
  eligibility: ProductAutomationCandidate["eligibility"];
  priority: "critical" | "high" | "medium" | "low";
  reasons: string[];
  isFixture: boolean;
  autoPromote: false;
  stagingWriteAllowed: false;
};

export function toAdminCatalogReviewLinks(
  summary: ProductAutomationRunSummary
): AdminCatalogReviewLink[] {
  return summary.adminQueueHints.map((hint) => ({
    candidateId: hint.candidateId,
    adminPath: `/admin/catalog/review?candidate=${encodeURIComponent(hint.candidateId)}`,
    reviewStatus: hint.reviewStatus,
    qualityStatus: hint.qualityStatus,
    eligibility:
      summary.candidates.find((c) => c.candidateId === hint.candidateId)
        ?.eligibility ?? "verification_required",
    priority: hint.priority,
    reasons: hint.reasons,
    isFixture: true,
    autoPromote: false,
    stagingWriteAllowed: false,
  }));
}

/**
 * Map automation candidate → CommonProduct draft for downstream contracts.
 * Eligibility stays verification_required for fixtures.
 */
export function toCommonProductDraft(
  candidate: ProductAutomationCandidate
): CommonProduct {
  return {
    id: candidate.candidateId,
    brandId: `brand:${(candidate.product.brandCanonical || candidate.product.brandRaw)
      .toLowerCase()
      .replace(/\s+/g, "-")}`,
    canonicalName: candidate.product.productNameEn || candidate.product.productNameRaw,
    displayName: candidate.product.productNameKo || candidate.product.productNameRaw,
    domain: candidate.domain,
    category: candidate.category,
    regulatoryClass: candidate.regulatoryClass,
    eligibility: candidate.eligibility,
    categoryAttributes: { ...candidate.categoryAttributes },
    variantIds: candidate.variants.map((v) => v.variantKey),
    sourceIds: candidate.evidence.map((e) => e.sourceUrl),
    duplicateGroupId: candidate.duplicateGroupId,
    reformulationOfId: null,
    collectedAt: candidate.evidence[0]?.fetchedAt ?? null,
    verifiedAt: null,
    refreshDueAt: candidate.refreshPlan?.nextCheckAt ?? null,
    dataCompleteness: candidate.dataCompleteness,
    sourceConfidence: candidate.sourceConfidence,
    commercial: {
      organicRank: null,
      isAffiliate: false,
      isSponsored: false,
      disclosureLabel: null,
      partner: null,
      commissionType: null,
      campaignId: null,
      sponsoredPlacement: null,
      affiliateUrl: null,
      affiliateVerifiedAt: null,
    },
  };
}
