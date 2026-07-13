/**
 * Alert recommended actions (admin-link centered, no PowerShell/SQL).
 */

import type { OperationsAlertCode } from "@/lib/admin/operations/types";

export type AlertGuidance = {
  definition: string;
  impact: string;
  operatorSteps: string[];
  autoRetry: boolean;
  adminLinks: Array<{ href: string; label: string }>;
};

const GUIDANCE: Record<OperationsAlertCode, AlertGuidance> = {
  WORKER_NO_RECENT_RUN: {
    definition: "설정된 시간 동안 정상 배치 실행이 없습니다.",
    impact: "신규 후보·draft·offer 수집이 멈출 수 있습니다.",
    operatorSteps: [
      "Pipeline 콘솔에서 최근 배치·heartbeat 확인",
      "설정에서 paused 여부 확인",
      "다음 스케줄 실행 대기 또는 관리자 수동 dry_run 시작",
    ],
    autoRetry: true,
    adminLinks: [
      { href: "/admin/pipeline", label: "Pipeline" },
      { href: "/admin/pipeline/settings", label: "설정" },
    ],
  },
  WORKER_HEARTBEAT_STALE: {
    definition: "running 배치의 heartbeat가 오래되었습니다.",
    impact: "작업이 중단되었거나 lock이 고착되었을 수 있습니다.",
    operatorSteps: [
      "Pipeline 배치 상세에서 lock/heartbeat 확인",
      "자동 복구가 stale lock을 해제하는지 다음 실행 확인",
    ],
    autoRetry: true,
    adminLinks: [{ href: "/admin/pipeline", label: "Pipeline" }],
  },
  BATCH_FAILURE_RATE_HIGH: {
    definition: "최근 배치 실패율이 기준을 초과했습니다.",
    impact: "수집·검증 처리량이 저하됩니다.",
    operatorSteps: [
      "실패한 배치 notes/safe_error 확인",
      "needs_review 브랜드·제품 큐 확인",
    ],
    autoRetry: true,
    adminLinks: [
      { href: "/admin/pipeline", label: "Pipeline" },
      { href: "/admin/verification", label: "Verification" },
    ],
  },
  JOBS_RETRY_BACKLOG: {
    definition: "retry_wait 작업이 기준을 초과했습니다.",
    impact: "재시도 적체로 처리 지연이 발생합니다.",
    operatorSteps: ["Pipeline에서 retry 상태 확인", "다음 스케줄 자동 재시도 대기"],
    autoRetry: true,
    adminLinks: [{ href: "/admin/pipeline", label: "Pipeline" }],
  },
  JOBS_STUCK: {
    definition: "running/queued 작업이 제한 시간을 초과했습니다.",
    impact: "배치 진행이 멈출 수 있습니다.",
    operatorSteps: ["stale job 자동 재큐잉 여부 확인", "배치 상세 확인"],
    autoRetry: true,
    adminLinks: [{ href: "/admin/pipeline", label: "Pipeline" }],
  },
  OFFICIAL_SITE_RESOLUTION_LOW: {
    definition: "공식 사이트 확인률이 기준 미달입니다.",
    impact: "제품 URL 수집·draft 품질이 떨어집니다.",
    operatorSteps: ["Brands needs_review 확인", "공식 도메인 후보 검토"],
    autoRetry: false,
    adminLinks: [{ href: "/admin/brands", label: "Brands" }],
  },
  CRAWL_BLOCKED_HIGH: {
    definition: "blocked 브랜드 비율이 높습니다.",
    impact: "해당 브랜드 자동 수집이 제한됩니다.",
    operatorSteps: ["Brands blocked 목록 확인", "차단 사유 검토"],
    autoRetry: false,
    adminLinks: [{ href: "/admin/brands", label: "Brands" }],
  },
  CANDIDATE_CREATION_ZERO: {
    definition: "URL은 있으나 후보 생성이 장기간 0입니다.",
    impact: "카탈로그 확장이 멈춥니다.",
    operatorSteps: [
      "Pipeline 설정 allowCandidateInsert 확인",
      "Discovery 목록 확인",
    ],
    autoRetry: false,
    adminLinks: [
      { href: "/admin/discovery", label: "Discovery" },
      { href: "/admin/pipeline/settings", label: "설정" },
    ],
  },
  DRAFT_CREATION_ZERO: {
    definition: "후보는 있으나 draft 생성이 0입니다.",
    impact: "제품 활성화·추천 풀이 늘지 않습니다.",
    operatorSteps: ["draft 게이트/품질 점수 확인", "Products 목록에서 draft 확인"],
    autoRetry: false,
    adminLinks: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/pipeline/settings", label: "설정" },
    ],
  },
  INGREDIENT_EXTRACTION_LOW: {
    definition: "공식 전성분 확보율이 낮습니다.",
    impact: "안전 필터·추천 자격이 제한됩니다.",
    operatorSteps: ["Verification ingredients 큐 확인", "제품 상세 전성분 상태 확인"],
    autoRetry: false,
    adminLinks: [
      { href: "/admin/verification", label: "Verification" },
      { href: "/admin/products", label: "Products" },
    ],
  },
  INGREDIENT_MATCH_LOW: {
    definition: "INCI 매칭률이 기준 미달입니다.",
    impact: "구조화 성분·알레르기 필터 정확도가 떨어집니다.",
    operatorSteps: ["Ingredients alias/unmatched 검토"],
    autoRetry: false,
    adminLinks: [{ href: "/admin/ingredients", label: "Ingredients" }],
  },
  UNMATCHED_INGREDIENTS_HIGH: {
    definition: "unmatched 성분 비율이 과다합니다.",
    impact: "제품 자동 검증이 needs_review로 밀립니다.",
    operatorSteps: ["Ingredients 매칭·alias 검토", "Verification ingredients 큐"],
    autoRetry: false,
    adminLinks: [
      { href: "/admin/ingredients", label: "Ingredients" },
      { href: "/admin/verification", label: "Verification" },
    ],
  },
  VERIFIED_OFFER_LOW: {
    definition: "verified offer 수가 기준 미달입니다.",
    impact: "제품 활성화·Top5 추천이 어렵습니다.",
    operatorSteps: ["Offers needs_review/stale 확인"],
    autoRetry: false,
    adminLinks: [{ href: "/admin/offers", label: "Offers" }],
  },
  OFFERS_STALE_HIGH: {
    definition: "stale offer 비율이 과다합니다.",
    impact: "가격·재고 신뢰도가 떨어집니다.",
    operatorSteps: ["Offers freshness 필터 확인", "다음 재검증 스케줄 대기"],
    autoRetry: true,
    adminLinks: [{ href: "/admin/offers", label: "Offers" }],
  },
  SHIPPING_COVERAGE_LOW: {
    definition: "주요 국가 배송 확인률이 부족합니다.",
    impact: "국가별 추천 커버리지가 좁아집니다.",
    operatorSteps: ["Offers shipping 미확인 항목 검토"],
    autoRetry: false,
    adminLinks: [{ href: "/admin/offers", label: "Offers" }],
  },
  RECOMMENDATION_CATALOG_LOW: {
    definition: "recommendation eligible 제품이 부족합니다.",
    impact: "Top5를 채우지 못하거나 빈 결과를 반환합니다(패딩 없음).",
    operatorSteps: [
      "Products verified/active 확인",
      "Offers·Ingredients 게이트 확인",
    ],
    autoRetry: false,
    adminLinks: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/offers", label: "Offers" },
      { href: "/admin/operations", label: "운영센터" },
    ],
  },
  CATEGORY_COVERAGE_LOW: {
    definition: "특정 카테고리/루틴 단계 제품이 부족합니다.",
    impact: "일부 피부고민·루틴 추천이 약해집니다.",
    operatorSteps: ["Products 카테고리 분포 확인", "Discovery 우선 수집 브랜드 확인"],
    autoRetry: false,
    adminLinks: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/discovery", label: "Discovery" },
    ],
  },
  REVIEW_BACKLOG_HIGH: {
    definition: "pending/needs_review 적체가 기준을 초과했습니다.",
    impact: "사람 검토 병목이 커집니다.",
    operatorSteps: ["Verification 우선순위 필터로 처리"],
    autoRetry: false,
    adminLinks: [{ href: "/admin/verification", label: "Verification" }],
  },
  REVIEW_ITEM_TOO_OLD: {
    definition: "가장 오래된 검토 건이 기준을 초과했습니다.",
    impact: "장기간 미해결 품질 이슈가 남습니다.",
    operatorSteps: ["Verification 오래된 항목부터 처리"],
    autoRetry: false,
    adminLinks: [{ href: "/admin/verification", label: "Verification" }],
  },
  SAFETY_REVIEW_PENDING: {
    definition: "safety 관련 높은 우선순위 검토가 남아 있습니다.",
    impact: "안전성 관련 제품이 추천에 들어가면 안 됩니다.",
    operatorSteps: ["Verification safety 필터로 우선 처리"],
    autoRetry: false,
    adminLinks: [{ href: "/admin/verification", label: "Verification" }],
  },
  PIPELINE_DATA_WRITE_STOPPED: {
    definition: "배치는 실행되지만 candidate/quality 결과 쓰기가 장기간 없습니다.",
    impact: "겉으로는 실행되지만 카탈로그가 늘지 않습니다.",
    operatorSteps: [
      "Pipeline mode·allowCandidateInsert 확인",
      "최근 배치 progress 확인",
    ],
    autoRetry: false,
    adminLinks: [
      { href: "/admin/pipeline", label: "Pipeline" },
      { href: "/admin/pipeline/settings", label: "설정" },
    ],
  },
};

export function getAlertGuidance(code: OperationsAlertCode): AlertGuidance {
  return GUIDANCE[code];
}
