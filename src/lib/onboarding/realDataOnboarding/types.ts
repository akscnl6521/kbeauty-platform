/**
 * P2-T04 — Real-data onboarding readiness contracts.
 * Fixtures / dry-run only. Never invents live catalog rows or Production writes.
 */

export const REAL_DATA_ONBOARDING_TASK_ID = "P2-T04" as const;

export type OnboardingLane = "korean_product" | "clinic_professional";

/** Source trust tiers — lower number = higher priority. */
export type OfficialSourceTier = 1 | 2 | 3 | 4;

export type SourceKind =
  | "official_brand_site"
  | "official_product_page"
  | "official_inci_label"
  | "authorized_retailer"
  | "clinic_official_site"
  | "medical_registry"
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
  | "blocked_captcha";

export type ProvenanceStatus =
  | "verified"
  | "unverified"
  | "conflict"
  | "missing"
  | "stale"
  | "rejected";

export type OnboardingEligibility =
  | "eligible_for_staging_review"
  | "needs_manual_review"
  | "rejected"
  | "fixture_non_public"
  | "blocked_policy";

export type RejectionReasonCode =
  // Product
  | "invented_data_forbidden"
  | "official_source_missing"
  | "official_source_not_priority"
  | "full_inci_missing"
  | "brand_or_name_missing"
  | "sale_page_unverified"
  | "price_or_stock_invented"
  | "affiliate_as_organic_forbidden"
  | "paid_api_forbidden"
  | "authenticated_scrape_forbidden"
  | "captcha_bypass_forbidden"
  | "production_write_forbidden"
  | "fixture_cannot_publish"
  | "stale_beyond_refresh_window"
  | "field_provenance_incomplete"
  | "duplicate_unresolved"
  | "medical_claim_unverified"
  // Clinic / professional
  | "clinic_official_site_missing"
  | "clinic_address_missing"
  | "clinic_hours_missing"
  | "clinic_specialties_missing"
  | "clinic_symptom_tags_missing"
  | "clinic_evidence_missing"
  | "clinic_evidence_stale"
  | "clinic_fixture_cannot_publish"
  | "clinic_partnership_disclosure_missing"
  | "clinic_booking_url_invalid"
  | "clinic_languages_missing"
  | "professional_listing_incomplete";

export type FieldProvenanceRecord = {
  fieldKey: string;
  valuePreview: string | null;
  sourceKind: SourceKind | null;
  sourceUrl: string | null;
  sourceTier: OfficialSourceTier | null;
  status: ProvenanceStatus;
  verifiedAt: string | null;
  noteKo: string | null;
};

export type SourceManifestEntry = {
  sourceId: string;
  lane: OnboardingLane;
  kind: SourceKind;
  displayNameKo: string;
  hostPattern: string | null;
  tier: OfficialSourceTier;
  accessMode: SourceAccessMode;
  allowedForImport: boolean;
  requiresHumanReview: boolean;
  notesKo: string;
};

export type StaleRefreshRule = {
  id: string;
  lane: OnboardingLane;
  fieldGroup: string;
  maxAgeDays: number;
  onStale: "queue_refresh" | "block_publish" | "needs_review";
  priority: "urgent" | "high" | "normal" | "low";
  reasonKo: string;
};

export type ReviewChecklistItem = {
  id: string;
  lane: OnboardingLane;
  required: boolean;
  titleKo: string;
  evidenceHintKo: string;
};

export type ImportTemplateColumn = {
  key: string;
  required: boolean;
  descriptionKo: string;
  example: string;
};

export type ImportTemplateDefinition = {
  templateId: string;
  lane: OnboardingLane;
  format: "csv" | "jsonl";
  columns: ImportTemplateColumn[];
  headerRow: string;
  /** Non-public sample rows — never claim as live catalog. */
  sampleRows: string[][];
  publicClaimForbidden: true;
};

export type DryRunRowInput = {
  rowId: string;
  lane: OnboardingLane;
  isFixture: boolean;
  fields: Record<string, string | null | undefined>;
  provenance: FieldProvenanceRecord[];
  sourceKind: SourceKind | null;
  sourceUrl: string | null;
  accessMode: SourceAccessMode;
  lastVerifiedAt: string | null;
};

export type DryRunValidationResult = {
  rowId: string;
  lane: OnboardingLane;
  ok: boolean;
  eligibility: OnboardingEligibility;
  rejectionReasons: RejectionReasonCode[];
  checklistGaps: string[];
  staleFieldGroups: string[];
  writeAttempted: false;
  productionWriteForbidden: true;
  publicVisible: false;
};

export type OnboardingCheckStatus = "pass" | "fail" | "warn";

export type OnboardingCheckResult = {
  id: string;
  lane: OnboardingLane | "cross_cutting";
  titleKo: string;
  status: OnboardingCheckStatus;
  detailKo: string;
};

export type RealDataOnboardingReport = {
  taskId: typeof REAL_DATA_ONBOARDING_TASK_ID;
  generatedAt: string;
  mode: "local_fixture_dry_run";
  ok: boolean;
  writeAttempted: false;
  productionWriteAttempted: false;
  paidApiUsed: false;
  captchaBypassAttempted: false;
  authenticatedScrapeAttempted: false;
  product: {
    validated: number;
    eligibleForStagingReview: number;
    rejected: number;
    fixtureNonPublic: number;
  };
  clinic: {
    validated: number;
    eligibleForStagingReview: number;
    rejected: number;
    fixtureNonPublic: number;
  };
  checks: OnboardingCheckResult[];
  dryRunResults: DryRunValidationResult[];
  summary: {
    pass: number;
    fail: number;
    warn: number;
  };
};
