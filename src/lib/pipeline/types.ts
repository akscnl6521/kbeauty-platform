/**
 * Autonomous catalog pipeline types (shared, no secrets).
 */

export const PIPELINE_STAGES = [
  "brand_seed",
  "official_site_candidate",
  "official_site_verified",
  "sitemap_discovered",
  "product_urls_collected",
  "product_page_parsed",
  "product_deduplicated",
  "ingredients_extracted",
  "ingredients_normalized",
  "safety_checked",
  "skin_match_scored",
  "offer_candidates_found",
  "verification_completed",
  "publish_eligible",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_JOB_STATUSES = [
  "queued",
  "running",
  "completed",
  "completed_with_warnings",
  "needs_review",
  "retry_wait",
  "failed",
  "paused",
  "cancelled",
] as const;

export type PipelineJobStatus = (typeof PIPELINE_JOB_STATUSES)[number];

export type PipelineBatchStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "completed_with_warnings"
  | "failed"
  | "cancelled";

export type PipelineMode = "dry_run" | "commit";

export type PipelineJob = {
  jobId: string;
  batchId: string;
  entityType: "brand" | "product_url" | "product" | "ingredient" | "system";
  entityId: string;
  sourceKey?: string | null;
  brandName?: string | null;
  entityLabel: string;
  stage: PipelineStage;
  status: PipelineJobStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  claimedBy?: string | null;
  claimHeartbeatAt?: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failureCode: string | null;
  safeFailureMessage: string | null;
  checkpoint: Record<string, unknown>;
  warnings: string[];
  resultSummary: Record<string, unknown> | null;
};

export type PipelineProgress = {
  totalItems: number;
  processedItems: number;
  successItems: number;
  reviewItems: number;
  failedItems: number;
  skippedItems: number;
};

export type PipelineBatch = {
  batchId: string;
  mode: PipelineMode;
  status: PipelineBatchStatus;
  triggerType?: "manual" | "scheduler" | "api" | "resume" | "retry";
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  pausedAt?: string | null;
  completedAt: string | null;
  brandLimit: number;
  productLimitPerBrand: number;
  progress: PipelineProgress;
  stagesCompleted: PipelineStage[];
  notes: string[];
  checkpoint?: Record<string, unknown>;
  lockOwner: string | null;
  lockHeartbeatAt?: string | null;
  safeErrorCode?: string | null;
  safeErrorMessage?: string | null;
};

export type BrandSeed = {
  brandKey: string;
  canonicalName: string;
  source: "products" | "brands_table" | "manual_seed";
  productCount: number;
  officialWebsite: string | null;
  countryCode: string | null;
  confidence: number;
};

export type SiteDiscoveryResult = {
  brandKey: string;
  candidateUrl: string | null;
  verified: boolean;
  confidence: number;
  connector: string | null;
  blocked: boolean;
  needsReview: boolean;
  reasons: string[];
  sitemapUrls: string[];
  productUrls: string[];
  resolution?: {
    classification: string;
    confidence: number;
    allowCrawl: boolean;
    selectedUrl: string | null;
    reasons: string[];
  };
};

export type ExtractedCatalogProduct = {
  productName: string;
  brandName: string;
  canonicalUrl: string;
  category: string | null;
  imageUrl: string | null;
  description: string | null;
  fullIngredientsText: string | null;
  keyIngredients: string[];
  sizeLabel: string | null;
  priceReference: string | null;
  currency: string | null;
  availabilityReference: string | null;
  country: string | null;
  sourceType: string;
  confidence: number;
  extractionMethod: string;
  fieldConfidence: Record<string, number>;
};

export type DedupeDecision = {
  action: "create_candidate" | "link_existing" | "needs_review" | "skip";
  score: number;
  reasons: string[];
  existingCandidateId: string | null;
  existingProductId: number | null;
};

export type IngredientParseResult = {
  rawTokens: string[];
  normalized: Array<{
    token: string;
    normalizedName: string;
    confidence: number;
    matchedIngredientId: number | null;
    needsReview: boolean;
  }>;
};

export type SkinClassification = {
  skinTypes: string[];
  concerns: string[];
  usageAreas: string[];
  routineSteps: string[];
  confidence: number;
  reasons: string[];
  marketingOnly: boolean;
};

export type ToneMatchResult = {
  productKind: "skincare" | "color" | "unknown";
  toneRelevance: "not_applicable" | "low" | "medium" | "high";
  depths: string[];
  undertones: string[];
  matchScore: number | null;
  confidence: number;
  reasons: string[];
  cautionReasons: string[];
};

export type QualityScore = {
  grade: "A" | "B" | "C" | "D" | "Review Required";
  score: number;
  publishEligible: boolean;
  blockers: string[];
  dimensions: Record<string, number>;
};

export type RecommendationScoreInput = {
  skinType?: string | null;
  concerns?: string[];
  allergies?: string[];
  avoidIngredients?: string[];
  undertone?: string | null;
  toneDepth?: string | null;
};

export type RecommendationScore = {
  total: number;
  hardFiltered: boolean;
  filterReasons: string[];
  parts: Record<string, number>;
  recommendReasons: string[];
  cautionReasons: string[];
  confidence: number;
  missingData: string[];
};
