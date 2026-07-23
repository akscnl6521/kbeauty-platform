/**
 * Human review checklists for Korean products and clinic/professional listings.
 */

import type { ReviewChecklistItem } from "./types";

export const REVIEW_CHECKLISTS: readonly ReviewChecklistItem[] = [
  // --- Korean product ---
  {
    id: "kp-brand-name",
    lane: "korean_product",
    required: true,
    titleKo: "브랜드·제품명·용량 확인",
    evidenceHintKo: "공식 제품 페이지 또는 라벨 사진",
  },
  {
    id: "kp-official-source",
    lane: "korean_product",
    required: true,
    titleKo: "공식 출처 URL(우선순위 1) 확인",
    evidenceHintKo: "브랜드 공식 사이트/제품 상세 HTTPS",
  },
  {
    id: "kp-full-inci",
    lane: "korean_product",
    required: true,
    titleKo: "전성분(INCI) 확보",
    evidenceHintKo: "공식 라벨·INCI. 미확보 시 자동 완성 금지",
  },
  {
    id: "kp-sale-check",
    lane: "korean_product",
    required: true,
    titleKo: "판매 페이지·구매 가능 여부 확인",
    evidenceHintKo: "판매 미확인이면 핵심 추천 제외",
  },
  {
    id: "kp-no-invent",
    lane: "korean_product",
    required: true,
    titleKo: "가격·재고·링크 미발명",
    evidenceHintKo: "미확인 값은 비워 두고 사유 기록",
  },
  {
    id: "kp-provenance",
    lane: "korean_product",
    required: true,
    titleKo: "필드별 provenance 기록",
    evidenceHintKo: "brand/name/inci/source_url 출처 필수",
  },
  {
    id: "kp-no-paid-scrape",
    lane: "korean_product",
    required: true,
    titleKo: "유료 API·로그인 스크랩·CAPTCHA 우회 없음",
    evidenceHintKo: "공개 HTTPS 또는 수동 붙여넣기만",
  },
  {
    id: "kp-medical-boundary",
    lane: "korean_product",
    required: true,
    titleKo: "의료·효능 과장 문구 없음",
    evidenceHintKo: "성분 논문 1건으로 제품 전체 효과 단정 금지",
  },
  // --- Clinic / professional ---
  {
    id: "cl-official-site",
    lane: "clinic_professional",
    required: true,
    titleKo: "병원 공식 사이트 HTTPS",
    evidenceHintKo: "광고 랜딩만으로 대체 불가",
  },
  {
    id: "cl-address-hours",
    lane: "clinic_professional",
    required: true,
    titleKo: "주소·진료시간 확인",
    evidenceHintKo: "공식 페이지 또는 공개 레지스트리",
  },
  {
    id: "cl-specialties",
    lane: "clinic_professional",
    required: true,
    titleKo: "진료 분야·증상 태그 근거",
    evidenceHintKo: "광고 문구만으로 전문 분야 확정 금지",
  },
  {
    id: "cl-evidence-fresh",
    lane: "clinic_professional",
    required: true,
    titleKo: "근거 신선도(180일 이내)",
    evidenceHintKo: "만료 시 publishable 차단",
  },
  {
    id: "cl-languages",
    lane: "clinic_professional",
    required: true,
    titleKo: "지원 언어 기록",
    evidenceHintKo: "미확인 시 빈 값 유지",
  },
  {
    id: "cl-partner-disclosure",
    lane: "clinic_professional",
    required: true,
    titleKo: "제휴 시 고지·Organic 분리",
    evidenceHintKo: "유료 관계가 Organic 순위를 바꾸지 않음",
  },
  {
    id: "cl-fixture-block",
    lane: "clinic_professional",
    required: true,
    titleKo: "fixture는 사용자 비공개",
    evidenceHintKo: "fixtureOnly → publishable 불가",
  },
  {
    id: "cl-no-invent",
    lane: "clinic_professional",
    required: true,
    titleKo: "가짜 병원·예약 URL 미발명",
    evidenceHintKo: "미확인 필드는 공란 + 거절 사유",
  },
] as const;

export function checklistForLane(
  lane: ReviewChecklistItem["lane"],
): ReviewChecklistItem[] {
  return REVIEW_CHECKLISTS.filter((item) => item.lane === lane);
}

export function requiredChecklistIds(
  lane: ReviewChecklistItem["lane"],
): string[] {
  return checklistForLane(lane)
    .filter((item) => item.required)
    .map((item) => item.id);
}
