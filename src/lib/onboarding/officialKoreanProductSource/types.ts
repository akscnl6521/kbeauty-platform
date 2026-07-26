/**
 * P3-T01 — Official Korean product source onboarding contracts.
 * Official-source-first · fixture/dry-run only by default.
 * Never publishes · never writes Production · never invents unknown fields.
 */

export const OFFICIAL_KR_PRODUCT_SOURCE_TASK_ID = "P3-T01" as const;

export type OfficialKrProductIngestionMode =
  | "fixture"
  | "dry_run"
  | "live_blocked";

export type OfficialKrProductCandidateStatus =
  | "discovered"
  | "filtered_out"
  | "duplicate"
  | "stale"
  | "needs_refresh"
  | "needs_review"
  | "blocked_policy"
  | "candidate_ready";

/** Source trust tiers — lower number = higher priority. */
export type OfficialSourceTier = 1 | 2 | 3 | 4;

export type OfficialProductSourceKind =
  | "brand_official_page"
  | "official_kr_mall_page"
  | "official_inci_disclosure"
  | "authorized_retailer_page"
  | "marketplace_listing"
  | "partner_feed"
  | "manual_curated"
  | "fixture_offline";

export type SourceAccessMode =
  | "public_https"
  | "manual_paste"
  | "offline_fixture"
  | "blocked_auth_required"
  | "blocked_paid_api"
  | "blocked_captcha"
  | "blocked_terms_risk";

export type ProvenanceStatus =
  | "verified"
  | "present"
  | "unknown"
  | "missing"
  | "conflict"
  | "stale"
  | "rejected";

export type StockStatus = "in_stock" | "out_of_stock" | "unknown";

export type FieldProvenanceEntry = {
  fieldKey: string;
  /** null when unknown — never invent. */
  valuePreview: string | null;
  sourceKind: OfficialProductSourceKind | null;
  /** Safe public URL only — never embeds secrets. */
  sourceUrl: string | null;
  sourceTier: OfficialSourceTier | null;
  status: ProvenanceStatus;
  verifiedAt: string | null;
  noteKo: string | null;
};

export type ProductVariantDraft = {
  variantId: string;
  sizeLabel: string | null;
  shadeLabel: string | null;
  sku: string | null;
  /** Unknown stays null. */
  barcode: string | null;
};

export type ProductImageDraft = {
  imageId: string;
  sourceUrl: string | null;
  role: "hero" | "ingredient_label" | "packaging" | "usage" | "other";
  rightsStatus: "unknown" | "official_remote_use" | "prohibited";
  verified: boolean;
};

export type ProductOfferDraft = {
  offerId: string;
  retailerName: string | null;
  retailerType: "official_mall" | "authorized" | "marketplace" | "unknown";
  /** ISO country of retailer (e.g. KR). Unknown → null. */
  retailerCountry: string | null;
  /** Countries this offer ships to. Empty = unknown, never invent. */
  shipsToCountries: string[];
  purchaseUrl: string | null;
  /** null when unknown — never invent price. */
  price: number | null;
  currency: string | null;
  stockStatus: StockStatus;
  isOfficial: boolean;
  lastCheckedAt: string | null;
};

export type UsageGuidanceDraft = {
  amountHint: string | null;
  orderHint: string | null;
  frequencyHint: string | null;
  cautions: string[];
  patchTestRecommended: boolean | null;
  sourceUrl: string | null;
  /** Incomplete guidance stays incomplete — never fill from marketing alone. */
  complete: boolean;
};

/** Core product fields collected from official-first sources. */
export type OfficialKrProductFields = {
  brandName: string | null;
  productNameKo: string | null;
  productNameEn: string | null;
  category: string | null;
  /** Full INCI / official disclosure text. Unknown → null. */
  fullIngredients: string | null;
  volumeLabel: string | null;
  brandOfficialUrl: string | null;
  officialMallUrl: string | null;
  inciDisclosureUrl: string | null;
  collectedAt: string;
  sourceVerifiedAt: string | null;
};

export type OfficialKrProductCandidate = {
  candidateId: string;
  status: OfficialKrProductCandidateStatus;
  fields: OfficialKrProductFields;
  variants: ProductVariantDraft[];
  images: ProductImageDraft[];
  offers: ProductOfferDraft[];
  usageGuidance: UsageGuidanceDraft | null;
  provenance: FieldProvenanceEntry[];
  reviewReasons: string[];
  filterReasons: string[];
  duplicateOf: string | null;
  sourceKind: OfficialProductSourceKind;
  accessMode: SourceAccessMode;
  sourceTier: OfficialSourceTier;
  isFixture: boolean;
  /** Hard gate — this pipeline never grants public visibility. */
  publishAllowed: false;
  publicVisible: false;
};

export type SourceManifestEntry = {
  sourceId: string;
  kind: OfficialProductSourceKind;
  displayNameKo: string;
  hostPattern: string | null;
  tier: OfficialSourceTier;
  accessMode: SourceAccessMode;
  allowedForImport: boolean;
  requiresHumanReview: boolean;
  notesKo: string;
};

export type ResumableManifestCheckpoint = {
  runId: string;
  taskId: typeof OFFICIAL_KR_PRODUCT_SOURCE_TASK_ID;
  status: "running" | "paused" | "completed" | "failed";
  startedAt: string;
  updatedAt: string;
  mode: OfficialKrProductIngestionMode;
  /** Manifest entry index last completed (0-based). */
  lastCompletedIndex: number;
  processedSourceIds: string[];
  pendingSourceIds: string[];
  processedCandidateIds: string[];
  failureReason: string | null;
  /** Safe host/path only. */
  safeEndpoint: string | null;
};

export type StaleRefreshDecision = {
  candidateId: string;
  ageDays: number | null;
  maxAgeDays: number;
  action: "fresh" | "queue_refresh" | "mark_stale" | "block_publish";
  reasonKo: string;
};

export type OfficialKrProductIngestionTotals = {
  sourcesSeen: number;
  rawItems: number;
  officialPass: number;
  filteredOut: number;
  duplicates: number;
  uniqueCandidates: number;
  stale: number;
  needsRefresh: number;
  needsReview: number;
  blockedPolicy: number;
  candidateReady: number;
  withIngredients: number;
  withImages: number;
  withVariants: number;
  withOffers: number;
  withUsageGuidance: number;
  unknownFieldsPreserved: number;
};

export type OfficialKrProductAuditArtifact = {
  taskId: typeof OFFICIAL_KR_PRODUCT_SOURCE_TASK_ID;
  generatedAt: string;
  mode: OfficialKrProductIngestionMode;
  runId: string;
  ok: boolean;
  checkpoint: ResumableManifestCheckpoint;
  totals: OfficialKrProductIngestionTotals;
  staleDecisions: StaleRefreshDecision[];
  candidateIds: string[];
  sampleCandidates: Array<{
    candidateId: string;
    brandName: string | null;
    productNameKo: string | null;
    status: OfficialKrProductCandidateStatus;
    sourceKind: OfficialProductSourceKind;
    hasIngredients: boolean;
  }>;
  reviewReasonSample: Array<{ candidateId: string; reasons: string[] }>;
  filterRejectSample: Array<{ candidateId: string; reasons: string[] }>;
  safeEndpoint: string | null;
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

export type OfficialKrProductIngestionResult = {
  taskId: typeof OFFICIAL_KR_PRODUCT_SOURCE_TASK_ID;
  mode: OfficialKrProductIngestionMode;
  runId: string;
  generatedAt: string;
  candidates: OfficialKrProductCandidate[];
  checkpoint: ResumableManifestCheckpoint;
  staleDecisions: StaleRefreshDecision[];
  totals: OfficialKrProductIngestionTotals;
  audit: OfficialKrProductAuditArtifact;
  databaseTouched: false;
  writeAttempted: false;
  productionTouched: false;
  publishAllowed: false;
  publicVisible: false;
};

/** Raw intake row from an offline/manual manifest (never invented live scrape). */
export type OfficialKrProductRawItem = {
  sourceId: string;
  sourceKind: OfficialProductSourceKind;
  accessMode: SourceAccessMode;
  sourceTier: OfficialSourceTier;
  brandOfficialUrl: string | null;
  officialMallUrl: string | null;
  inciDisclosureUrl: string | null;
  brandName: string | null;
  productNameKo: string | null;
  productNameEn: string | null;
  category: string | null;
  fullIngredients: string | null;
  volumeLabel: string | null;
  variants: ProductVariantDraft[];
  images: ProductImageDraft[];
  offers: ProductOfferDraft[];
  usageGuidance: UsageGuidanceDraft | null;
  sourceVerifiedAt: string | null;
  isFixture: boolean;
  /** Explicit policy-block markers for tests. */
  forceBlockReason?: string | null;
};

export type OfficialKrProductPageFetcher = {
  listManifestSlice(req: {
    startIndex: number;
    limit: number;
  }): Promise<{
    ok: boolean;
    items: OfficialKrProductRawItem[];
    totalCount: number;
    safeEndpoint: string;
    usedFixture: boolean;
    errorMessageKo: string | null;
  }>;
};
