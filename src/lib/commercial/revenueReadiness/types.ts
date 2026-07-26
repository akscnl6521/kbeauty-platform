/**
 * P3-T04 — Affiliate and sponsored revenue readiness contracts.
 * Architecture only — never activates real commercial agreements.
 * Never invents commission rates or live purchase URLs.
 */

export const REVENUE_READINESS_TASK_ID = "P3-T04" as const;

export type RevenueReadinessMode = "fixture" | "dry_run" | "live_blocked";

export type RevenueLane = "affiliate" | "sponsored";

export type CommissionTypeKnown =
  | "cpa"
  | "cps"
  | "cpl"
  | "flat_fee"
  | "unknown";

/** Commission numeric rate is never invented — only known+provided or null. */
export type CommissionRateContract = {
  commissionType: CommissionTypeKnown;
  /** Always null unless an explicit verified rate was supplied (never invented). */
  commissionRatePercent: number | null;
  commissionRateKnown: boolean;
  commissionAmountKnown: boolean;
  commissionAmount: number | null;
  currency: string | null;
};

export type DisclosureContract = {
  required: true;
  labelKo: string;
  labelEn: string;
  visibleToUser: boolean;
  looksLikeOrganicReason: false;
};

export type CountryPurchaseLink = {
  countryCode: string;
  languageCode: string | null;
  currency: string | null;
  /** Fixture/example only — never a live commercial destination invented by code. */
  purchaseUrl: string | null;
  shipsToCountry: boolean | null;
  inStock: boolean | null;
  verifiedAt: string | null;
  isFixtureUrl: boolean;
};

export type AffiliateOfferIngestInput = {
  offerId: string;
  productId: string;
  partnerId: string | null;
  campaignId: string | null;
  commission: CommissionRateContract;
  countryLinks: CountryPurchaseLink[];
  disclosureLabelKo: string | null;
  disclosureLabelEn: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  evidenceVerified: boolean;
  isFixture: boolean;
  /** Forbidden: inventing rates. */
  inventedCommissionRate?: boolean;
  /** Forbidden: inventing live URLs. */
  inventedLiveUrl?: boolean;
};

export type SponsoredPlacementContractInput = {
  placementId: string;
  entityType: "product" | "clinic" | "media";
  entityId: string;
  partnerId: string | null;
  campaignId: string | null;
  sponsoredPlacementRank: number | null;
  zone: "sponsored_rail" | "affiliate_aside" | "clinic_partner_aside";
  disclosureLabelKo: string | null;
  disclosureLabelEn: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  evidenceVerified: boolean;
  isFixture: boolean;
  /** Must never target organic_recommendation zone. */
  attemptedOrganicZone?: boolean;
};

export type RevenueAdminStatus =
  | "draft"
  | "needs_review"
  | "admin_approved"
  | "rejected"
  | "expired"
  | "activation_blocked";

export type RevenueRejectionCode =
  | "commission_rate_invented"
  | "live_url_invented"
  | "disclosure_missing"
  | "disclosure_looks_like_organic_reason"
  | "partner_missing"
  | "campaign_missing"
  | "evidence_unverified"
  | "expired"
  | "not_yet_started"
  | "country_link_missing"
  | "country_link_unverified"
  | "fixture_non_public"
  | "dry_run_non_public"
  | "admin_approval_required"
  | "commercial_agreement_not_activated"
  | "organic_zone_forbidden"
  | "health_targeting_forbidden"
  | "paid_fields_in_organic_score"
  | "paid_fields_in_professional_routing";

export type ClickConversionEventKind =
  | "impression"
  | "click"
  | "lead"
  | "conversion";

export type ClickConversionEventInput = {
  eventId: string;
  kind: ClickConversionEventKind;
  lane: RevenueLane;
  entityType: "product" | "clinic" | "media";
  entityId: string;
  offerOrPlacementId: string;
  countryCode: string | null;
  /** Rejected if health/symptom keys present. */
  targetingProfile?: Record<string, unknown> | null;
  revenueAmount?: number | null;
  currency?: string | null;
};

export type AnalyticsPrivacyBoundary = {
  healthTargetingAllowed: false;
  symptomTargetingAllowed: false;
  beautyProfileTargetingAllowed: false;
  photoAnalysisTargetingAllowed: false;
  piiForAdAuctionAllowed: false;
  allowedEventFields: readonly string[];
};

export type RevenueCandidateRecord = {
  recordId: string;
  lane: RevenueLane;
  entityType: "product" | "clinic" | "media";
  entityId: string;
  partnerId: string | null;
  campaignId: string | null;
  commission: CommissionRateContract;
  countryLinks: CountryPurchaseLink[];
  disclosure: DisclosureContract | null;
  startsAt: string | null;
  expiresAt: string | null;
  evidenceVerified: boolean;
  adminStatus: RevenueAdminStatus;
  rejectionCodes: RevenueRejectionCode[];
  isFixture: boolean;
  isDryRunRecord: boolean;
  /** Always false in this readiness layer. */
  commercialAgreementActivated: false;
  /** Soft hold — never implies public paid surface. */
  allowPublicPaidSurface: false;
  sponsoredPlacementRank: number | null;
  zone: "sponsored_rail" | "affiliate_aside" | "clinic_partner_aside" | null;
};

export type ExpiryDecision = {
  recordId: string;
  expired: boolean;
  notYetStarted: boolean;
  activeWindow: boolean;
  expiresAt: string | null;
  startsAt: string | null;
  reasonCodes: RevenueRejectionCode[];
};

export type AdminApprovalDecision = {
  recordId: string;
  approved: boolean;
  adminStatus: RevenueAdminStatus;
  reasonCodes: RevenueRejectionCode[];
  requiresHumanContract: true;
};

export type OrganicIndependenceProof = {
  organicOrderUnchanged: boolean;
  professionalRoutingUnchanged: boolean;
  paidKeysInOrganicScore: string[];
  paidKeysInProfessionalRouting: string[];
  ok: boolean;
};

export type RevenueReadinessAuditTotals = {
  offersSeen: number;
  placementsSeen: number;
  ingestedOk: number;
  rejected: number;
  expired: number;
  needsReview: number;
  adminApprovedStructural: number;
  countryLinksSeen: number;
  eventsValidated: number;
  eventsRejected: number;
  privacyViolations: number;
  fixtureNonPublic: number;
  dryRunNonPublic: number;
  agreementsActivated: 0;
};

export type RevenueReadinessAuditArtifact = {
  taskId: typeof REVENUE_READINESS_TASK_ID;
  mode: RevenueReadinessMode;
  runId: string;
  generatedAt: string;
  totals: RevenueReadinessAuditTotals;
  publishAllowed: false;
  publicVisible: false;
  commercialAgreementsActivated: false;
  databaseTouched: false;
  writeAttempted: false;
  productionTouched: false;
  paidApiUsed: false;
  inventedCommissionRates: false;
  inventedLiveUrls: false;
  organicIndependent: boolean;
  professionalRoutingIndependent: boolean;
  notesKo: string[];
};

export type RevenueReadinessRunResult = {
  taskId: typeof REVENUE_READINESS_TASK_ID;
  mode: RevenueReadinessMode;
  runId: string;
  generatedAt: string;
  candidates: RevenueCandidateRecord[];
  expiryDecisions: ExpiryDecision[];
  adminDecisions: AdminApprovalDecision[];
  eventValidations: Array<{
    eventId: string;
    ok: boolean;
    reasons: RevenueRejectionCode[];
  }>;
  organicIndependence: OrganicIndependenceProof;
  privacyBoundary: AnalyticsPrivacyBoundary;
  audit: RevenueReadinessAuditArtifact;
  publishAllowed: false;
  publicVisible: false;
  commercialAgreementsActivated: false;
  databaseTouched: false;
  writeAttempted: false;
  productionTouched: false;
  paidApiUsed: false;
};
