/**
 * P3-T04 constants — disclosure copy, privacy fields, safety notes.
 */

import type { AnalyticsPrivacyBoundary } from "./types";

export const DEFAULT_AFFILIATE_DISCLOSURE_KO =
  "이 링크를 통한 구매가 발생하면 플랫폼이 수수료를 받을 수 있습니다. Organic 추천 순위와는 무관합니다.";

export const DEFAULT_AFFILIATE_DISCLOSURE_EN =
  "The platform may earn a commission if you purchase through this link. This does not affect Organic ranking.";

export const DEFAULT_SPONSORED_DISCLOSURE_KO =
  "유료 광고 영역입니다. Organic 추천 이유로 표시되지 않습니다.";

export const DEFAULT_SPONSORED_DISCLOSURE_EN =
  "This is a paid advertisement. It is separate from Organic ranking.";

/** Phrases that make paid placement look like Organic fit — forbidden. */
export const ORGANIC_LOOKALIKE_DISCLOSURE_PATTERNS = [
  /유기적\s*추천/i,
  /적합도\s*(?:최고|1위|상위)/i,
  /best\s*match/i,
  /(?:^|[^.])\s*organic\s+recommendation\b/i,
  /clinically\s*proven\s*for\s*you/i,
] as const;

export const ANALYTICS_ALLOWED_EVENT_FIELDS = [
  "eventId",
  "kind",
  "lane",
  "entityType",
  "entityId",
  "offerOrPlacementId",
  "countryCode",
  "revenueAmount",
  "currency",
  "createdAt",
] as const;

export const ANALYTICS_PRIVACY_BOUNDARY: AnalyticsPrivacyBoundary = {
  healthTargetingAllowed: false,
  symptomTargetingAllowed: false,
  beautyProfileTargetingAllowed: false,
  photoAnalysisTargetingAllowed: false,
  piiForAdAuctionAllowed: false,
  allowedEventFields: ANALYTICS_ALLOWED_EVENT_FIELDS,
};

export const HEALTH_TARGETING_KEYS = [
  "skinConcerns",
  "concerns",
  "symptoms",
  "redFlags",
  "diagnosis",
  "medicalHistory",
  "allergy",
  "irritation",
  "beautyProfile",
  "healthCondition",
  "photoAnalysis",
  "acuteSignals",
  "professionalRoute",
  "symptomTags",
] as const;

export const ORGANIC_SCORE_FORBIDDEN_PAID_KEYS = [
  "isAffiliate",
  "isSponsored",
  "affiliateUrl",
  "commissionType",
  "commissionRatePercent",
  "commissionAmount",
  "campaignId",
  "sponsoredPlacement",
  "sponsoredPlacementRank",
  "partner",
  "partnerId",
  "advertisingFee",
  "listingFee",
  "margin",
  "brandContract",
  "campaignSpend",
] as const;

export const PROFESSIONAL_ROUTING_FORBIDDEN_PAID_KEYS = [
  ...ORGANIC_SCORE_FORBIDDEN_PAID_KEYS,
  "revenueAmount",
  "bookingCommission",
] as const;

export const SAFETY_NOTES_KO = [
  "실 상업 계약·실 제휴 URL·수수료율은 활성화하지 않습니다.",
  "수수료율·실 URL을 코드가 발명하지 않습니다.",
  "Organic 순위와 증상/전문가 라우팅은 유료 관계와 독립입니다.",
  "건강·증상·뷰티프로필로 광고 타기팅하지 않습니다.",
  "fixture/dry-run은 공개 유료 표면에 올리지 않습니다.",
] as const;
