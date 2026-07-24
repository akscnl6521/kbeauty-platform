/**
 * T07-04 — Official-site symptom evidence review bundle contracts.
 * Manifest-only entry. No login/CAPTCHA/scrape automation. Never publishes.
 */

export const SYMPTOM_EVIDENCE_REVIEW_TASK_ID = "T07-04" as const;

export type SymptomEvidenceReviewMode =
  | "fixture"
  | "dry_run"
  | "live_blocked";

/** Symptom claim categories covered by this review bundle. */
export type SymptomClaimCategory =
  | "acne"
  | "rosacea_redness"
  | "atopic_dermatitis"
  | "pigmentation";

export type EvidenceSourceKind =
  | "official_hospital_page"
  | "approved_public_evidence"
  | "fixture_offline"
  | "marketplace_or_blog"
  | "partner_feed"
  | "unknown";

export type EvidenceAccessMode =
  | "manifest_manual"
  | "public_https_paste"
  | "offline_fixture"
  | "blocked_auth_required"
  | "blocked_captcha"
  | "blocked_restricted_crawl"
  | "blocked_terms_risk_scrape"
  | "blocked_paid_api";

export type ReviewerStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "needs_more_evidence"
  | "stale";

/** Commercial relationship — must not leak into Organic eligibility scoring. */
export type CommercialRelationship =
  | "none"
  | "affiliate"
  | "sponsored"
  | "booking_fee"
  | "lead_fee";

export type OrganicEligibility =
  | "organic_eligible"
  | "organic_ineligible_paid_relationship"
  | "organic_ineligible_unverified"
  | "organic_ineligible_rejected"
  | "organic_ineligible_stale"
  | "organic_ineligible_policy";

export type RejectionReasonCode =
  | "login_automation_forbidden"
  | "captcha_bypass_forbidden"
  | "restricted_crawl_forbidden"
  | "terms_risk_scrape_forbidden"
  | "paid_api_forbidden"
  | "source_kind_not_allowed"
  | "evidence_url_missing"
  | "evidence_url_invalid"
  | "page_title_missing"
  | "claim_category_unsupported"
  | "excerpt_summary_missing"
  | "verified_date_missing"
  | "verified_date_invalid"
  | "stale_date_missing"
  | "stale_beyond_policy"
  | "manifest_entry_missing"
  | "affiliate_as_organic_forbidden"
  | "sponsored_as_organic_forbidden"
  | "unverified_must_stay_unpublished"
  | "fixture_cannot_publish"
  | "production_write_forbidden"
  | "medical_claim_unverified"
  | "reviewer_rejected";

export type SymptomEvidenceManifestEntry = {
  sourceId: string;
  kind: EvidenceSourceKind;
  displayNameKo: string;
  hostPattern: string | null;
  accessMode: EvidenceAccessMode;
  allowedForReviewQueue: boolean;
  requiresHumanReview: boolean;
  notesKo: string;
};

/**
 * One manually entered evidence row (manifest / admin paste).
 * Exact URL + title + excerpt required — no invented live crawl.
 */
export type SymptomEvidenceManifestInput = {
  evidenceId: string;
  sourceId: string;
  claimCategory: SymptomClaimCategory;
  evidenceUrl: string;
  pageTitle: string;
  excerptSummary: string;
  verifiedAt: string | null;
  staleAt: string | null;
  reviewerStatus: ReviewerStatus;
  rejectionReasonCode: RejectionReasonCode | null;
  rejectionReasonKo: string | null;
  commercialRelationship: CommercialRelationship;
  commercialDisclosureKo: string | null;
  clinicOrInstitutionLabel: string | null;
  isFixture: boolean;
  accessMode: EvidenceAccessMode;
};

export type SymptomEvidenceReviewRecord = {
  evidenceId: string;
  sourceId: string;
  claimCategory: SymptomClaimCategory;
  evidenceUrl: string;
  pageTitle: string;
  excerptSummary: string;
  verifiedAt: string | null;
  staleAt: string | null;
  reviewerStatus: ReviewerStatus;
  rejectionReasonCode: RejectionReasonCode | null;
  rejectionReasonKo: string | null;
  commercialRelationship: CommercialRelationship;
  commercialDisclosureKo: string | null;
  clinicOrInstitutionLabel: string | null;
  sourceKind: EvidenceSourceKind;
  accessMode: EvidenceAccessMode;
  organicEligibility: OrganicEligibility;
  /** True only when approved + not stale + organic lane + non-fixture. Still unpublished in dry-run. */
  publishEligible: boolean;
  /** Hard gate — dry-run / fixture never publish. */
  publishAllowed: false;
  publicVisible: false;
  isFixture: boolean;
  rejectionCodes: RejectionReasonCode[];
  queueLane: "organic_review" | "paid_relationship_review" | "rejected" | "pending";
  reviewedAt: string;
};

export type SymptomEvidenceReviewQueue = {
  organicReview: SymptomEvidenceReviewRecord[];
  paidRelationshipReview: SymptomEvidenceReviewRecord[];
  pending: SymptomEvidenceReviewRecord[];
  rejected: SymptomEvidenceReviewRecord[];
};

export type SymptomEvidenceReviewTotals = {
  inputRows: number;
  acceptedToQueue: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  needsMoreEvidence: number;
  stale: number;
  organicEligible: number;
  organicIneligiblePaid: number;
  organicIneligibleOther: number;
  publishEligible: number;
  unpublishedUnverified: number;
  byCategory: Record<SymptomClaimCategory, number>;
};

export type SymptomEvidenceAuditArtifact = {
  taskId: typeof SYMPTOM_EVIDENCE_REVIEW_TASK_ID;
  generatedAt: string;
  mode: SymptomEvidenceReviewMode;
  runId: string;
  ok: boolean;
  totals: SymptomEvidenceReviewTotals;
  queueSummary: {
    organicReview: number;
    paidRelationshipReview: number;
    pending: number;
    rejected: number;
  };
  sampleRecords: Array<{
    evidenceId: string;
    claimCategory: SymptomClaimCategory;
    reviewerStatus: ReviewerStatus;
    organicEligibility: OrganicEligibility;
    publishEligible: boolean;
    queueLane: SymptomEvidenceReviewRecord["queueLane"];
    rejectionCodes: RejectionReasonCode[];
  }>;
  databaseTouched: false;
  writeAttempted: false;
  productionTouched: false;
  publishAllowed: false;
  crawlAttempted: false;
  loginAutomationAttempted: false;
  captchaBypassAttempted: false;
  notesKo: string[];
};

export type SymptomEvidenceReviewResult = {
  taskId: typeof SYMPTOM_EVIDENCE_REVIEW_TASK_ID;
  mode: SymptomEvidenceReviewMode;
  runId: string;
  generatedAt: string;
  records: SymptomEvidenceReviewRecord[];
  queue: SymptomEvidenceReviewQueue;
  totals: SymptomEvidenceReviewTotals;
  audit: SymptomEvidenceAuditArtifact;
  databaseTouched: false;
  writeAttempted: false;
  productionTouched: false;
  publishAllowed: false;
  crawlAttempted: false;
};
