/**
 * Rejection / review reason catalog for P3-T02 verified product pool.
 */

import type { VerifiedPoolRejectionCode } from "./types";

export type RejectionReasonEntry = {
  code: VerifiedPoolRejectionCode;
  labelKo: string;
  blocksPublicTop5: boolean;
  blocksRecommendationReady: boolean;
};

export const REJECTION_REASON_CATALOG: readonly RejectionReasonEntry[] = [
  {
    code: "source_not_verified",
    labelKo: "공식 출처 미검증",
    blocksPublicTop5: true,
    blocksRecommendationReady: true,
  },
  {
    code: "ingredients_not_verified",
    labelKo: "전성분(INCI) 미검증",
    blocksPublicTop5: true,
    blocksRecommendationReady: true,
  },
  {
    code: "image_rights_not_verified",
    labelKo: "이미지 권리 미검증",
    blocksPublicTop5: true,
    blocksRecommendationReady: true,
  },
  {
    code: "purchase_offer_missing",
    labelKo: "검증된 구매 offer 없음",
    blocksPublicTop5: true,
    blocksRecommendationReady: true,
  },
  {
    code: "marketplace_only_forbidden",
    labelKo: "마켓플레이스 단독 출처 금지",
    blocksPublicTop5: true,
    blocksRecommendationReady: true,
  },
  {
    code: "paid_api_forbidden",
    labelKo: "유료 API 사용 금지",
    blocksPublicTop5: true,
    blocksRecommendationReady: true,
  },
  {
    code: "captcha_or_login_forbidden",
    labelKo: "CAPTCHA/로그인 우회 금지",
    blocksPublicTop5: true,
    blocksRecommendationReady: true,
  },
  {
    code: "fixture_non_public",
    labelKo: "fixture는 비공개",
    blocksPublicTop5: true,
    blocksRecommendationReady: false,
  },
  {
    code: "dry_run_non_public",
    labelKo: "dry-run 기록은 비공개",
    blocksPublicTop5: true,
    blocksRecommendationReady: false,
  },
  {
    code: "category_unsupported",
    labelKo: "확장 대상 카테고리 아님",
    blocksPublicTop5: true,
    blocksRecommendationReady: true,
  },
  {
    code: "brand_or_name_missing",
    labelKo: "브랜드 또는 제품명 없음",
    blocksPublicTop5: true,
    blocksRecommendationReady: true,
  },
  {
    code: "safety_ineligible",
    labelKo: "안전 적격 미달",
    blocksPublicTop5: true,
    blocksRecommendationReady: true,
  },
  {
    code: "duplicate_merged",
    labelKo: "중복 병합됨",
    blocksPublicTop5: true,
    blocksRecommendationReady: true,
  },
  {
    code: "invented_field_forbidden",
    labelKo: "미확인 필드 발명 금지",
    blocksPublicTop5: true,
    blocksRecommendationReady: true,
  },
  {
    code: "official_manifest_not_approved",
    labelKo: "승인된 공식 매니페스트 아님",
    blocksPublicTop5: true,
    blocksRecommendationReady: true,
  },
] as const;

export function rejectionLabelKo(code: VerifiedPoolRejectionCode): string {
  return (
    REJECTION_REASON_CATALOG.find((e) => e.code === code)?.labelKo ?? code
  );
}

export function blocksPublicTop5(code: VerifiedPoolRejectionCode): boolean {
  return (
    REJECTION_REASON_CATALOG.find((e) => e.code === code)?.blocksPublicTop5 ??
    true
  );
}
