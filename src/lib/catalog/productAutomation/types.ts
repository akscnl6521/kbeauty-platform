/**
 * Product automation ingestion contract (T03).
 * Common stages + category extractors. Never auto-publishes to Production.
 */

import type { RecommendationEligibility, RegulatoryClass } from "@/lib/catalog/commonProduct";
import type { BeautyDomain } from "@/lib/catalog/taxonomy/domains";
import type { CatalogQualityStatus } from "@/lib/catalog/qualityStatus";
import type { ProductIdentityMatch } from "@/lib/catalog/automation/productIdentity";
import type { CatalogProductVariantDraft } from "@/lib/catalog/variants/variantModel";
import type { CatalogProductMediaDraft } from "@/lib/catalog/media/validateMedia";
import type {
  ParsedCatalogOffer,
  ParsedCatalogProduct,
  ParsedIngredientSource,
} from "@/lib/catalog/automation/types";
import type { CatalogRefreshPlan } from "@/lib/catalog/refreshPolicy";

/** Ordered ingestion stages — common path before category extractors. */
export const PRODUCT_INGESTION_STAGES = [
  "candidate_discovery",
  "raw_source_preservation",
  "source_identification",
  "brand_normalization",
  "product_normalization",
  "category_classification",
  "variant_extraction",
  "ingredient_extraction",
  "media_normalization",
  "offer_normalization",
  "dedupe",
  "source_confidence",
  "field_verification",
  "completeness_score",
  "recommendation_eligibility",
  "staging_candidate",
  "manual_review_reasons",
  "refresh_scheduling",
] as const;

export type ProductIngestionStage = (typeof PRODUCT_INGESTION_STAGES)[number];

export type CategoryExtractorId =
  | "skincare"
  | "base_makeup"
  | "color_makeup"
  | "mascara"
  | "lip"
  | "hair_scalp"
  | "body"
  | "nail"
  | "fragrance"
  | "tool"
  | "device"
  | "unknown";

export type OfficialSourceEvidence = {
  sourceUrl: string;
  sourceHost: string;
  sourceTier: 1 | 2 | 3 | 4;
  isOfficialBrandSource: boolean;
  evidenceKind:
    | "official_product_page"
    | "official_inci_label"
    | "authorized_retailer"
    | "structured_data"
    | "fixture_offline";
  contentHash: string | null;
  fetchedAt: string | null;
  verifiedFields: string[];
  /** Fixtures never claim live official verification. */
  liveVerified: boolean;
};

export type FieldVerificationMap = Record<
  string,
  {
    status: "verified" | "unverified" | "conflict" | "missing";
    sourceUrl?: string | null;
    note?: string;
  }
>;

export type UsageMediaMetadataDraft = {
  mediaType: "video" | "image" | "animation";
  sourceUrl: string | null;
  rightsStatus: "unknown" | "official_remote_use" | "brand_permission" | "prohibited";
  reviewStatus: "draft" | "needs_review" | "approved" | "rejected";
  productMatchVerified: boolean;
  applicationDemonstrationVerified: boolean;
  containsMedicalClaim: boolean;
  isSponsored: boolean;
};

export type ProductAutomationReviewStatus =
  | "staging_candidate"
  | "needs_review"
  | "blocked"
  | "duplicate_watch"
  | "refresh_due"
  | "ready_for_admin";

export type CategoryAttributesDraft = {
  extractorId: CategoryExtractorId;
  mascaraEffects?: string[];
  waterproof?: boolean | null;
  lipEffects?: string[];
  undertoneFit?: string[];
  finish?: string | null;
  shadeFamily?: string | null;
  scalpTypes?: string[];
  scalpConcerns?: string[];
  hairTypes?: string[];
  functionalClaimVerified?: boolean;
  rawHints: string[];
};

export type ProductAutomationCandidate = {
  candidateId: string;
  stageReached: ProductIngestionStage;
  domain: BeautyDomain;
  category: string;
  extractorId: CategoryExtractorId;
  regulatoryClass: RegulatoryClass;
  product: ParsedCatalogProduct;
  ingredients: ParsedIngredientSource | null;
  offers: ParsedCatalogOffer[];
  variants: CatalogProductVariantDraft[];
  images: CatalogProductMediaDraft[];
  usageMedia: UsageMediaMetadataDraft[];
  evidence: OfficialSourceEvidence[];
  fieldVerification: FieldVerificationMap;
  categoryAttributes: CategoryAttributesDraft;
  dedupe: ProductIdentityMatch | null;
  duplicateGroupId: string | null;
  sourceConfidence: number;
  dataCompleteness: number;
  eligibility: RecommendationEligibility;
  qualityStatus: CatalogQualityStatus;
  reviewStatus: ProductAutomationReviewStatus;
  reviewReasons: string[];
  refreshPlan: CatalogRefreshPlan | null;
  isFixture: boolean;
  autoPromote: false;
};

export type ProductAutomationRunCheckpoint = {
  runId: string;
  startedAt: string;
  updatedAt: string;
  /** Last completed stage index in PRODUCT_INGESTION_STAGES */
  lastCompletedStageIndex: number;
  processedCandidateIds: string[];
  pendingCandidateIds: string[];
  status: "running" | "paused" | "completed" | "failed";
  failureReason: string | null;
};

export type ProductAutomationRunSummary = {
  runId: string;
  mode: "dry_run" | "fixture";
  generatedAt: string;
  stages: ProductIngestionStage[];
  candidates: ProductAutomationCandidate[];
  checkpoint: ProductAutomationRunCheckpoint;
  totals: {
    discovered: number;
    withIngredients: number;
    withOffers: number;
    withImages: number;
    duplicates: number;
    needsReview: number;
    recommendationReady: number;
    stagingCandidates: number;
  };
  adminQueueHints: Array<{
    candidateId: string;
    reviewStatus: ProductAutomationReviewStatus;
    qualityStatus: CatalogQualityStatus;
    priority: "critical" | "high" | "medium" | "low";
    reasons: string[];
  }>;
};
