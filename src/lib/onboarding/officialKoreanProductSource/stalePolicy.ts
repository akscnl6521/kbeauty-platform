/**
 * Stale / refresh policy for official Korean product candidates (P3-T01).
 * Offer/price: 30d refresh · product meta/INCI: 90d refresh · 180d stale block.
 */

import {
  OFFER_REFRESH_MAX_AGE_DAYS,
  PRODUCT_REFRESH_MAX_AGE_DAYS,
  PRODUCT_STALE_MAX_AGE_DAYS,
} from "./constants";
import type {
  OfficialKrProductCandidate,
  StaleRefreshDecision,
} from "./types";

export function ageDaysFrom(
  iso: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  return Math.floor((now.getTime() - parsed) / 86_400_000);
}

export function evaluateStaleRefresh(
  candidate: OfficialKrProductCandidate,
  now: Date = new Date(),
): StaleRefreshDecision {
  const age = ageDaysFrom(candidate.fields.sourceVerifiedAt, now);
  if (age == null) {
    return {
      candidateId: candidate.candidateId,
      ageDays: null,
      maxAgeDays: PRODUCT_STALE_MAX_AGE_DAYS,
      action: "mark_stale",
      reasonKo: "출처 확인 시각이 없어 만료로 표시합니다.",
    };
  }
  if (age > PRODUCT_STALE_MAX_AGE_DAYS) {
    return {
      candidateId: candidate.candidateId,
      ageDays: age,
      maxAgeDays: PRODUCT_STALE_MAX_AGE_DAYS,
      action: "block_publish",
      reasonKo: `근거 ${age}일 경과(>${PRODUCT_STALE_MAX_AGE_DAYS}일) — 게시 차단·만료.`,
    };
  }
  // Prefer offer-level refresh when any offer is present.
  const hasOffer = candidate.offers.length > 0;
  const refreshMax = hasOffer
    ? OFFER_REFRESH_MAX_AGE_DAYS
    : PRODUCT_REFRESH_MAX_AGE_DAYS;
  if (age > refreshMax) {
    return {
      candidateId: candidate.candidateId,
      ageDays: age,
      maxAgeDays: refreshMax,
      action: "queue_refresh",
      reasonKo: hasOffer
        ? `가격·재고 근거 ${age}일 경과(>${OFFER_REFRESH_MAX_AGE_DAYS}일) — 재확인 큐.`
        : `제품 메타 근거 ${age}일 경과(>${PRODUCT_REFRESH_MAX_AGE_DAYS}일) — 재확인 큐.`,
    };
  }
  return {
    candidateId: candidate.candidateId,
    ageDays: age,
    maxAgeDays: refreshMax,
    action: "fresh",
    reasonKo: "출처 확인이 유효 기간 내입니다.",
  };
}

export function applyStalePolicy(
  candidates: OfficialKrProductCandidate[],
  now: Date = new Date(),
): {
  candidates: OfficialKrProductCandidate[];
  decisions: StaleRefreshDecision[];
} {
  const decisions: StaleRefreshDecision[] = [];
  const out = candidates.map((c) => {
    if (
      c.status === "filtered_out" ||
      c.status === "duplicate" ||
      c.status === "blocked_policy"
    ) {
      return c;
    }
    const decision = evaluateStaleRefresh(c, now);
    decisions.push(decision);
    if (
      decision.action === "block_publish" ||
      decision.action === "mark_stale"
    ) {
      return {
        ...c,
        status: "stale" as const,
        filterReasons: [...c.filterReasons, "stale_beyond_max_age"],
        reviewReasons: [...c.reviewReasons, "stale_beyond_refresh_window"],
      };
    }
    if (decision.action === "queue_refresh") {
      return {
        ...c,
        status: "needs_refresh" as const,
        filterReasons: [...c.filterReasons, "refresh_due"],
        reviewReasons: [...c.reviewReasons, "refresh_due"],
      };
    }
    return c;
  });
  return { candidates: out, decisions };
}
