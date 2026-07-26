/**
 * T07-04 constants — claim categories, stale policy, blocked access modes.
 */

import type {
  EvidenceAccessMode,
  SymptomClaimCategory,
} from "./types";

export const REQUIRED_CLAIM_CATEGORIES: readonly SymptomClaimCategory[] = [
  "acne",
  "rosacea_redness",
  "atopic_dermatitis",
  "pigmentation",
] as const;

export const CLAIM_CATEGORY_LABEL_KO: Record<SymptomClaimCategory, string> = {
  acne: "여드름",
  rosacea_redness: "주사/홍조",
  atopic_dermatitis: "아토피피부염",
  pigmentation: "색소침착",
};

/** Evidence older than this (days past staleAt or verifiedAt+window) needs re-review. */
export const DEFAULT_STALE_MAX_AGE_DAYS = 180;

export const BLOCKED_ACCESS_MODES: readonly EvidenceAccessMode[] = [
  "blocked_auth_required",
  "blocked_captcha",
  "blocked_restricted_crawl",
  "blocked_terms_risk_scrape",
  "blocked_paid_api",
] as const;

export const UNVERIFIED_UNPUBLISHED_NOTE_KO =
  "미검증·미승인 증상 전문 주장은 게시하지 않습니다. 공식 병원 페이지 또는 승인된 공개 근거만 매니페스트로 접수합니다.";

export const ORGANIC_SEPARATION_NOTE_KO =
  "Organic 검수 큐와 제휴·스폰서·수수료 관계는 분리합니다. 유료 관계가 Organic 적격 점수를 바꾸지 않으며, 유료 레인은 paid_relationship_review로만 표시됩니다.";

export const NO_CRAWL_NOTE_KO =
  "로그인 자동화·CAPTCHA 우회·제한 크롤·약관 위험 스크래핑은 금지합니다. 근거는 관리자가 매니페스트에 수동 입력합니다.";
