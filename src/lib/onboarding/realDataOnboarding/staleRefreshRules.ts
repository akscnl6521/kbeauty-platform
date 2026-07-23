/**
 * Stale / refresh rules for product and clinic onboarding readiness.
 * Aligns with catalog + clinic refresh policies without claiming live ops.
 */

import type { OnboardingLane, StaleRefreshRule } from "./types";

export const STALE_REFRESH_RULES: readonly StaleRefreshRule[] = [
  {
    id: "product-official-page",
    lane: "korean_product",
    fieldGroup: "official_page",
    maxAgeDays: 30,
    onStale: "queue_refresh",
    priority: "normal",
    reasonKo: "공식 제품 페이지 재확인(30일).",
  },
  {
    id: "product-full-inci",
    lane: "korean_product",
    fieldGroup: "full_inci",
    maxAgeDays: 90,
    onStale: "needs_review",
    priority: "high",
    reasonKo: "전성분 근거가 오래되면 검수 필요.",
  },
  {
    id: "product-sale-offer",
    lane: "korean_product",
    fieldGroup: "sale_offer",
    maxAgeDays: 7,
    onStale: "queue_refresh",
    priority: "high",
    reasonKo: "판매·가격·재고는 단기 재확인(미발명).",
  },
  {
    id: "product-unconfirmed-official",
    lane: "korean_product",
    fieldGroup: "official_unconfirmed",
    maxAgeDays: 3,
    onStale: "block_publish",
    priority: "urgent",
    reasonKo: "공식 출처 미확인 시 게시 차단.",
  },
  {
    id: "clinic-evidence",
    lane: "clinic_professional",
    fieldGroup: "evidence",
    maxAgeDays: 180,
    onStale: "block_publish",
    priority: "high",
    reasonKo: "병원 근거 180일 초과 시 공개 차단.",
  },
  {
    id: "clinic-operating",
    lane: "clinic_professional",
    fieldGroup: "operating_status",
    maxAgeDays: 90,
    onStale: "needs_review",
    priority: "normal",
    reasonKo: "운영 상태·진료시간 재확인.",
  },
  {
    id: "clinic-partnership",
    lane: "clinic_professional",
    fieldGroup: "partnership",
    maxAgeDays: 60,
    onStale: "needs_review",
    priority: "high",
    reasonKo: "제휴 고지 재검증(Organic 분리 유지).",
  },
] as const;

export function rulesForLane(lane: OnboardingLane): StaleRefreshRule[] {
  return STALE_REFRESH_RULES.filter((rule) => rule.lane === lane);
}

export function ageDaysFrom(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  return Math.floor((now.getTime() - parsed) / 86_400_000);
}

export function evaluateStaleGroups(input: {
  lane: OnboardingLane;
  lastVerifiedAt: string | null;
  hasOfficialConfirmed: boolean;
  fieldGroupsPresent: string[];
  now?: Date;
}): {
  staleFieldGroups: string[];
  blockPublish: boolean;
  needsReview: boolean;
  queueRefresh: boolean;
  matchedRuleIds: string[];
} {
  const now = input.now ?? new Date();
  const age = ageDaysFrom(input.lastVerifiedAt, now);
  const staleFieldGroups: string[] = [];
  const matchedRuleIds: string[] = [];
  let blockPublish = false;
  let needsReview = false;
  let queueRefresh = false;

  for (const rule of rulesForLane(input.lane)) {
    const applies =
      input.fieldGroupsPresent.includes(rule.fieldGroup) ||
      (rule.fieldGroup === "official_unconfirmed" && !input.hasOfficialConfirmed) ||
      (rule.fieldGroup === "evidence" && input.fieldGroupsPresent.includes("evidence"));

    if (!applies && rule.fieldGroup !== "official_unconfirmed") continue;
    if (rule.fieldGroup === "official_unconfirmed" && input.hasOfficialConfirmed) {
      continue;
    }

    const isStale =
      age == null ||
      age > rule.maxAgeDays ||
      (rule.fieldGroup === "official_unconfirmed" && !input.hasOfficialConfirmed);

    if (!isStale) continue;

    staleFieldGroups.push(rule.fieldGroup);
    matchedRuleIds.push(rule.id);
    if (rule.onStale === "block_publish") blockPublish = true;
    if (rule.onStale === "needs_review") needsReview = true;
    if (rule.onStale === "queue_refresh") queueRefresh = true;
  }

  return {
    staleFieldGroups: [...new Set(staleFieldGroups)],
    blockPublish,
    needsReview,
    queueRefresh,
    matchedRuleIds,
  };
}
