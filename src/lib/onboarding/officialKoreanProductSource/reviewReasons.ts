/**
 * Review / rejection reason catalog for official KR product onboarding (P3-T01).
 */

export type ReviewReasonCode =
  | "official_source_missing"
  | "official_source_not_priority"
  | "full_inci_missing"
  | "brand_or_name_missing"
  | "price_or_stock_invented"
  | "country_availability_invented"
  | "paid_api_forbidden"
  | "authenticated_scrape_forbidden"
  | "captcha_bypass_forbidden"
  | "terms_risk_automation_forbidden"
  | "production_write_forbidden"
  | "fixture_cannot_publish"
  | "stale_beyond_refresh_window"
  | "refresh_due"
  | "field_provenance_incomplete"
  | "duplicate_unresolved"
  | "marketplace_only_forbidden"
  | "usage_guidance_incomplete"
  | "image_rights_unknown"
  | "needs_human_review";

export type ReviewReasonEntry = {
  code: ReviewReasonCode;
  titleKo: string;
  blocksPublish: boolean;
  blocksStagingReview: boolean;
};

export const REVIEW_REASON_CATALOG: readonly ReviewReasonEntry[] = [
  {
    code: "official_source_missing",
    titleKo: "공식 출처 없음",
    blocksPublish: true,
    blocksStagingReview: true,
  },
  {
    code: "official_source_not_priority",
    titleKo: "공식 출처 우선순위 미충족(마켓 단독 등)",
    blocksPublish: true,
    blocksStagingReview: true,
  },
  {
    code: "full_inci_missing",
    titleKo: "공식 전성분 미확인",
    blocksPublish: true,
    blocksStagingReview: true,
  },
  {
    code: "brand_or_name_missing",
    titleKo: "브랜드·제품명 미확인",
    blocksPublish: true,
    blocksStagingReview: true,
  },
  {
    code: "price_or_stock_invented",
    titleKo: "가격·재고 발명 금지",
    blocksPublish: true,
    blocksStagingReview: true,
  },
  {
    code: "country_availability_invented",
    titleKo: "국가 가용성 발명 금지",
    blocksPublish: true,
    blocksStagingReview: true,
  },
  {
    code: "paid_api_forbidden",
    titleKo: "유료 API 금지",
    blocksPublish: true,
    blocksStagingReview: true,
  },
  {
    code: "authenticated_scrape_forbidden",
    titleKo: "로그인 스크래핑 금지",
    blocksPublish: true,
    blocksStagingReview: true,
  },
  {
    code: "captcha_bypass_forbidden",
    titleKo: "CAPTCHA 우회 금지",
    blocksPublish: true,
    blocksStagingReview: true,
  },
  {
    code: "terms_risk_automation_forbidden",
    titleKo: "약관 위험 자동화 금지",
    blocksPublish: true,
    blocksStagingReview: true,
  },
  {
    code: "production_write_forbidden",
    titleKo: "Production 쓰기 금지",
    blocksPublish: true,
    blocksStagingReview: true,
  },
  {
    code: "fixture_cannot_publish",
    titleKo: "fixture 비공개",
    blocksPublish: true,
    blocksStagingReview: false,
  },
  {
    code: "stale_beyond_refresh_window",
    titleKo: "근거 만료",
    blocksPublish: true,
    blocksStagingReview: true,
  },
  {
    code: "refresh_due",
    titleKo: "재확인 필요",
    blocksPublish: true,
    blocksStagingReview: false,
  },
  {
    code: "field_provenance_incomplete",
    titleKo: "필드 provenance 불완전",
    blocksPublish: true,
    blocksStagingReview: false,
  },
  {
    code: "duplicate_unresolved",
    titleKo: "중복 미해소",
    blocksPublish: true,
    blocksStagingReview: true,
  },
  {
    code: "marketplace_only_forbidden",
    titleKo: "마켓 단독 출처 금지",
    blocksPublish: true,
    blocksStagingReview: true,
  },
  {
    code: "usage_guidance_incomplete",
    titleKo: "사용 가이드 불완전(비차단·검수 표시)",
    blocksPublish: false,
    blocksStagingReview: false,
  },
  {
    code: "image_rights_unknown",
    titleKo: "이미지 권리 미확인",
    blocksPublish: true,
    blocksStagingReview: false,
  },
  {
    code: "needs_human_review",
    titleKo: "사람 검수 필요",
    blocksPublish: true,
    blocksStagingReview: false,
  },
] as const;

export function reviewReasonTitle(code: string): string {
  const hit = REVIEW_REASON_CATALOG.find((r) => r.code === code);
  return hit?.titleKo ?? code;
}
