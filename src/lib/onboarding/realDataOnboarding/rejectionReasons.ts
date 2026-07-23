/**
 * Structured rejection reasons for Korean products and clinic listings.
 */

import type { RejectionReasonCode } from "./types";

export type RejectionReasonMeta = {
  code: RejectionReasonCode;
  lane: "korean_product" | "clinic_professional" | "both";
  titleKo: string;
  severity: "block" | "review";
};

export const REJECTION_REASON_CATALOG: readonly RejectionReasonMeta[] = [
  {
    code: "invented_data_forbidden",
    lane: "both",
    titleKo: "데이터 발명 금지",
    severity: "block",
  },
  {
    code: "official_source_missing",
    lane: "korean_product",
    titleKo: "공식 출처 없음",
    severity: "block",
  },
  {
    code: "official_source_not_priority",
    lane: "korean_product",
    titleKo: "공식 출처 우선순위 미충족(마켓만 등)",
    severity: "block",
  },
  {
    code: "full_inci_missing",
    lane: "korean_product",
    titleKo: "전성분 미확보",
    severity: "block",
  },
  {
    code: "brand_or_name_missing",
    lane: "korean_product",
    titleKo: "브랜드 또는 제품명 없음",
    severity: "block",
  },
  {
    code: "sale_page_unverified",
    lane: "korean_product",
    titleKo: "판매 페이지 미확인",
    severity: "review",
  },
  {
    code: "price_or_stock_invented",
    lane: "korean_product",
    titleKo: "가격/재고 발명 의심",
    severity: "block",
  },
  {
    code: "affiliate_as_organic_forbidden",
    lane: "korean_product",
    titleKo: "제휴를 Organic으로 위장 금지",
    severity: "block",
  },
  {
    code: "paid_api_forbidden",
    lane: "both",
    titleKo: "유료 API 사용 금지",
    severity: "block",
  },
  {
    code: "authenticated_scrape_forbidden",
    lane: "both",
    titleKo: "로그인 필요 스크랩 금지",
    severity: "block",
  },
  {
    code: "captcha_bypass_forbidden",
    lane: "both",
    titleKo: "CAPTCHA 우회 금지",
    severity: "block",
  },
  {
    code: "production_write_forbidden",
    lane: "both",
    titleKo: "Production 쓰기 금지",
    severity: "block",
  },
  {
    code: "fixture_cannot_publish",
    lane: "korean_product",
    titleKo: "제품 fixture 게시 불가",
    severity: "block",
  },
  {
    code: "stale_beyond_refresh_window",
    lane: "both",
    titleKo: "갱신 기한 초과(만료)",
    severity: "block",
  },
  {
    code: "field_provenance_incomplete",
    lane: "both",
    titleKo: "필드 provenance 불완전",
    severity: "block",
  },
  {
    code: "duplicate_unresolved",
    lane: "korean_product",
    titleKo: "중복 미해결",
    severity: "review",
  },
  {
    code: "medical_claim_unverified",
    lane: "korean_product",
    titleKo: "미검증 의료/효능 주장",
    severity: "block",
  },
  {
    code: "clinic_official_site_missing",
    lane: "clinic_professional",
    titleKo: "병원 공식 사이트 없음",
    severity: "block",
  },
  {
    code: "clinic_address_missing",
    lane: "clinic_professional",
    titleKo: "주소 없음",
    severity: "block",
  },
  {
    code: "clinic_hours_missing",
    lane: "clinic_professional",
    titleKo: "진료시간 없음",
    severity: "block",
  },
  {
    code: "clinic_specialties_missing",
    lane: "clinic_professional",
    titleKo: "진료 분야 없음",
    severity: "block",
  },
  {
    code: "clinic_symptom_tags_missing",
    lane: "clinic_professional",
    titleKo: "증상 태그 없음",
    severity: "block",
  },
  {
    code: "clinic_evidence_missing",
    lane: "clinic_professional",
    titleKo: "근거 없음",
    severity: "block",
  },
  {
    code: "clinic_evidence_stale",
    lane: "clinic_professional",
    titleKo: "근거 만료",
    severity: "block",
  },
  {
    code: "clinic_fixture_cannot_publish",
    lane: "clinic_professional",
    titleKo: "병원 fixture 게시 불가",
    severity: "block",
  },
  {
    code: "clinic_partnership_disclosure_missing",
    lane: "clinic_professional",
    titleKo: "제휴 고지 누락",
    severity: "block",
  },
  {
    code: "clinic_booking_url_invalid",
    lane: "clinic_professional",
    titleKo: "예약 URL 형식 오류",
    severity: "block",
  },
  {
    code: "clinic_languages_missing",
    lane: "clinic_professional",
    titleKo: "지원 언어 없음",
    severity: "block",
  },
  {
    code: "professional_listing_incomplete",
    lane: "clinic_professional",
    titleKo: "전문가 리스팅 불완전",
    severity: "review",
  },
] as const;

export function rejectionTitleKo(code: RejectionReasonCode): string {
  return (
    REJECTION_REASON_CATALOG.find((item) => item.code === code)?.titleKo ?? code
  );
}

export function isBlockingRejection(code: RejectionReasonCode): boolean {
  return (
    REJECTION_REASON_CATALOG.find((item) => item.code === code)?.severity ===
    "block"
  );
}
