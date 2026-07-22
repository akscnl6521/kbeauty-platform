/**
 * Multi-source catalog types (WQ-F strategy refresh + scenario pilot enrichment).
 * Official is preferred but never the only source.
 */

export type SourceTrustTier = "A" | "B" | "C" | "D";

export type IngredientEvidenceStatus =
  | "verified"
  | "source_verified_candidate"
  | "cross_source_confirmed"
  | "needs_review"
  | "ingredient_incomplete";

export type ProductReadinessState =
  | "trend_candidate"
  | "catalog_ready"
  | "ingredient_candidate"
  | "recommendation_ready"
  | "review_required"
  | "unavailable";

export type MultiSourceChannel =
  | "official_brand"
  | "naver_brand_store"
  | "naver_shopping"
  | "coupang_official"
  | "oliveyoung"
  | "authorized_retailer"
  | "open_beauty_facts"
  | "other";

export type SourceFetchOutcome =
  | "ok"
  | "blocked_by_policy"
  | "http_error"
  | "not_found"
  | "empty"
  | "skipped";

export type SourceEvidence = {
  channel: MultiSourceChannel;
  trust: SourceTrustTier;
  url: string;
  outcome: SourceFetchOutcome;
  httpStatus?: number;
  checkedAt: string;
  fields: string[];
  notes?: string[];
};

export type IngredientEvidence = {
  raw: string;
  status: IngredientEvidenceStatus;
  trust: SourceTrustTier;
  channel: MultiSourceChannel;
  sourceUrl: string;
  checkedAt: string;
};

export type OfferEvidence = {
  retailerName: string;
  trust: SourceTrustTier;
  channel: MultiSourceChannel;
  purchaseUrl: string;
  price: number | null;
  currency: string | null;
  inStock: boolean | null;
  isOfficialStore: boolean;
  checkedAt: string;
  sourceVerified: boolean;
};

export type ImageEvidence = {
  imageUrl: string;
  trust: SourceTrustTier;
  channel: MultiSourceChannel;
  sourcePageUrl: string;
  checkedAt: string;
  isOfficialSource: boolean;
};

/** Pilot / enrichment product identity (global registry row). */
export type ProductIdentity = {
  productId: string;
  brand: string;
  productName: string;
  normalizedBrand: string;
  normalizedName: string;
  volumeLabel: string | null;
  gtin: string | null;
  canonicalUrl: string | null;
  imageHash: string | null;
  category: string;
  scenarioIds: string[];
};

export type MergedMultiSourceProduct = {
  brandId: string;
  brand: string;
  productName: string;
  externalProductId: string;
  sizeLabel: string | null;
  officialUrl: string | null;
  primaryUrl: string;
  ingredientsRaw: string | null;
  ingredientStatus: IngredientEvidenceStatus;
  ingredientEvidences: IngredientEvidence[];
  images: ImageEvidence[];
  offers: OfferEvidence[];
  sourceEvidences: SourceEvidence[];
  mismatches: string[];
  duplicate: boolean;
  qualityNotes: string[];
  /** Pilot enrichment extensions */
  productIdentity?: ProductIdentity;
  readiness?: ProductReadinessState;
  rejectionReason?: string | null;
  roleTags?: string[];
  affiliateOrAdInScore?: boolean;
  cautionIngredients?: string[];
};
