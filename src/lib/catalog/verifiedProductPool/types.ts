/**
 * P3-T02 — Verified product pool and category expansion contracts.
 * Official-manifest / non-public dry-run only.
 * Never publishes · never writes Production · never invents unknowns.
 */

import type { RecommendationEligibility } from "@/lib/catalog/commonProduct";

export const VERIFIED_PRODUCT_POOL_TASK_ID = "P3-T02" as const;

export type VerifiedPoolMode = "fixture" | "dry_run" | "live_blocked";

/** Target expansion categories for the verified candidate pool. */
export const VERIFIED_POOL_CATEGORIES = [
  "skincare",
  "makeup",
  "hair_scalp",
  "body",
  "lip_eye",
] as const;

export type VerifiedPoolCategory = (typeof VERIFIED_POOL_CATEGORIES)[number];

export type VerifiedPoolCandidateStatus =
  | "ingested"
  | "normalized"
  | "duplicate_merged"
  | "rejected"
  | "safety_hold"
  | "needs_review"
  | "recommendation_ready"
  | "blocked_public_top5";

export type SourceVerificationStatus =
  | "verified_official"
  | "present_unverified"
  | "missing"
  | "rejected";

export type ImageRightsStatus =
  | "verified_official"
  | "verified_brand_permission"
  | "unknown"
  | "prohibited"
  | "missing";

export type OfferVerificationStatus =
  | "verified_purchase"
  | "present_unverified"
  | "missing"
  | "invented_blocked";

export type IngredientsVerificationStatus =
  | "verified_full_inci"
  | "partial"
  | "missing"
  | "conflict";

export type VerifiedPoolRejectionCode =
  | "source_not_verified"
  | "ingredients_not_verified"
  | "image_rights_not_verified"
  | "purchase_offer_missing"
  | "marketplace_only_forbidden"
  | "paid_api_forbidden"
  | "captcha_or_login_forbidden"
  | "fixture_non_public"
  | "dry_run_non_public"
  | "category_unsupported"
  | "brand_or_name_missing"
  | "safety_ineligible"
  | "duplicate_merged"
  | "invented_field_forbidden"
  | "official_manifest_not_approved";

export type CategoryNormalizedFields = {
  poolCategory: VerifiedPoolCategory;
  canonicalCategory: string;
  brandNormalized: string | null;
  productNameNormalized: string | null;
  volumeNormalized: string | null;
  shadeOrColor: string | null;
  finish: string | null;
  scalpOrHairHint: string | null;
  bodyAreaHint: string | null;
  eyeOrLipHint: string | null;
  makeupFamily: string | null;
  rawCategoryHint: string | null;
};

export type VerifiedPoolGateSnapshot = {
  sourceVerified: boolean;
  ingredientsVerified: boolean;
  imageRightsVerified: boolean;
  purchaseOfferVerified: boolean;
  safetyEligible: boolean;
  /** Structural readiness for staging review — never implies public publish. */
  recommendationReady: boolean;
  /** Public Top 5 hard gate — false unless all verified gates pass AND non-fixture live path. */
  publicTop5Allowed: boolean;
  rejectionCodes: VerifiedPoolRejectionCode[];
};

export type VerifiedPoolCandidate = {
  candidateId: string;
  status: VerifiedPoolCandidateStatus;
  poolCategory: VerifiedPoolCategory;
  brandName: string | null;
  productNameKo: string | null;
  productNameEn: string | null;
  volumeLabel: string | null;
  fullIngredients: string | null;
  officialSourceUrl: string | null;
  sourceKind:
    | "brand_official_page"
    | "official_kr_mall_page"
    | "official_inci_disclosure"
    | "authorized_retailer_page"
    | "marketplace_listing"
    | "fixture_offline"
    | "manual_curated";
  sourceVerification: SourceVerificationStatus;
  ingredientsVerification: IngredientsVerificationStatus;
  imageRights: ImageRightsStatus;
  offerVerification: OfferVerificationStatus;
  purchaseUrl: string | null;
  normalized: CategoryNormalizedFields;
  eligibility: RecommendationEligibility;
  gate: VerifiedPoolGateSnapshot;
  rejectionReasons: VerifiedPoolRejectionCode[];
  reviewReasons: string[];
  duplicateOf: string | null;
  mergedFromIds: string[];
  isFixture: boolean;
  isDryRunRecord: boolean;
  manifestApproved: boolean;
  safetyFlags: string[];
  publishAllowed: false;
  publicVisible: false;
  publicTop5Allowed: false | true;
};

/** Approved official-source manifest entry (offline / dry-run). */
export type ApprovedOfficialManifestEntry = {
  manifestId: string;
  approved: boolean;
  sourceKind:
    | "brand_official_page"
    | "official_kr_mall_page"
    | "official_inci_disclosure"
    | "authorized_retailer_page"
    | "marketplace_listing"
    | "fixture_offline"
    | "manual_curated";
  hostPattern: string | null;
  notesKo: string;
};

/** Non-public dry-run / fixture intake row. */
export type VerifiedPoolRawRecord = {
  recordId: string;
  manifestId: string;
  brandName: string | null;
  productNameKo: string | null;
  productNameEn: string | null;
  categoryHint: string | null;
  volumeLabel: string | null;
  fullIngredients: string | null;
  officialSourceUrl: string | null;
  sourceKind: VerifiedPoolCandidate["sourceKind"];
  sourceVerification: SourceVerificationStatus;
  ingredientsVerification: IngredientsVerificationStatus;
  imageRights: ImageRightsStatus;
  offerVerification: OfferVerificationStatus;
  purchaseUrl: string | null;
  shadeOrColor?: string | null;
  finish?: string | null;
  scalpOrHairHint?: string | null;
  bodyAreaHint?: string | null;
  eyeOrLipHint?: string | null;
  makeupFamily?: string | null;
  isFixture: boolean;
  isDryRunRecord: boolean;
  safetyFlags?: string[];
  /** Test hook — force a rejection path. */
  forceRejectCode?: VerifiedPoolRejectionCode | null;
};

export type VerifiedPoolAuditTotals = {
  rawSeen: number;
  manifestApproved: number;
  manifestRejected: number;
  byCategory: Record<VerifiedPoolCategory, number>;
  normalized: number;
  duplicatesMerged: number;
  uniqueCandidates: number;
  rejected: number;
  safetyHold: number;
  needsReview: number;
  recommendationReady: number;
  publicTop5Eligible: number;
  publicTop5Blocked: number;
  missingSource: number;
  missingIngredients: number;
  missingImageRights: number;
  missingPurchaseOffer: number;
  fixtureNonPublic: number;
  dryRunNonPublic: number;
};

export type VerifiedPoolAuditArtifact = {
  taskId: typeof VERIFIED_PRODUCT_POOL_TASK_ID;
  generatedAt: string;
  mode: VerifiedPoolMode;
  runId: string;
  ok: boolean;
  totals: VerifiedPoolAuditTotals;
  candidateIds: string[];
  top5BlockedSample: Array<{
    candidateId: string;
    reasons: VerifiedPoolRejectionCode[];
  }>;
  recommendationReadySample: Array<{
    candidateId: string;
    poolCategory: VerifiedPoolCategory;
    publicTop5Allowed: boolean;
  }>;
  rejectionReasonCounts: Record<string, number>;
  categoryCounts: Record<VerifiedPoolCategory, number>;
  databaseTouched: false;
  writeAttempted: false;
  productionTouched: false;
  publishAllowed: false;
  publicVisible: false;
  paidApiUsed: false;
  captchaBypassAttempted: false;
  authenticatedScrapeAttempted: false;
  notesKo: string[];
};

export type VerifiedPoolExpansionResult = {
  taskId: typeof VERIFIED_PRODUCT_POOL_TASK_ID;
  mode: VerifiedPoolMode;
  runId: string;
  generatedAt: string;
  candidates: VerifiedPoolCandidate[];
  publicTop5: VerifiedPoolCandidate[];
  totals: VerifiedPoolAuditTotals;
  audit: VerifiedPoolAuditArtifact;
  databaseTouched: false;
  writeAttempted: false;
  productionTouched: false;
  publishAllowed: false;
  publicVisible: false;
};
