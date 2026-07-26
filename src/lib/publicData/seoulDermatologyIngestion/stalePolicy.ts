/**
 * Stale / refresh policy for Seoul dermatology candidates (T07-02).
 * Aligns with clinic evidence 180d block / 90d refresh windows.
 */

import {
  CANDIDATE_REFRESH_MAX_AGE_DAYS,
  CANDIDATE_STALE_MAX_AGE_DAYS,
} from "./constants";
import type { SeoulDermatologyCandidate, StaleRefreshDecision } from "./types";

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
  candidate: SeoulDermatologyCandidate,
  now: Date = new Date(),
): StaleRefreshDecision {
  const age = ageDaysFrom(candidate.fields.sourceVerifiedAt, now);
  if (age == null) {
    return {
      candidateId: candidate.candidateId,
      ageDays: null,
      maxAgeDays: CANDIDATE_STALE_MAX_AGE_DAYS,
      action: "mark_stale",
      reasonKo: "출처 확인 시각이 없어 만료로 표시합니다.",
    };
  }
  if (age > CANDIDATE_STALE_MAX_AGE_DAYS) {
    return {
      candidateId: candidate.candidateId,
      ageDays: age,
      maxAgeDays: CANDIDATE_STALE_MAX_AGE_DAYS,
      action: "block_publish",
      reasonKo: `근거 ${age}일 경과(>${CANDIDATE_STALE_MAX_AGE_DAYS}일) — 게시 차단·만료.`,
    };
  }
  if (age > CANDIDATE_REFRESH_MAX_AGE_DAYS) {
    return {
      candidateId: candidate.candidateId,
      ageDays: age,
      maxAgeDays: CANDIDATE_REFRESH_MAX_AGE_DAYS,
      action: "queue_refresh",
      reasonKo: `근거 ${age}일 경과(>${CANDIDATE_REFRESH_MAX_AGE_DAYS}일) — 재확인 큐.`,
    };
  }
  return {
    candidateId: candidate.candidateId,
    ageDays: age,
    maxAgeDays: CANDIDATE_REFRESH_MAX_AGE_DAYS,
    action: "fresh",
    reasonKo: "출처 확인이 유효 기간 내입니다.",
  };
}

export function applyStalePolicy(
  candidates: SeoulDermatologyCandidate[],
  now: Date = new Date(),
): {
  candidates: SeoulDermatologyCandidate[];
  decisions: StaleRefreshDecision[];
} {
  const decisions: StaleRefreshDecision[] = [];
  const out = candidates.map((c) => {
    if (c.status === "filtered_out" || c.status === "duplicate") {
      return c;
    }
    const decision = evaluateStaleRefresh(c, now);
    decisions.push(decision);
    if (decision.action === "block_publish" || decision.action === "mark_stale") {
      return {
        ...c,
        status: "stale" as const,
        filterReasons: [...c.filterReasons, "stale_beyond_max_age"],
      };
    }
    if (decision.action === "queue_refresh") {
      return {
        ...c,
        status: "needs_refresh" as const,
        filterReasons: [...c.filterReasons, "refresh_due"],
      };
    }
    return { ...c, status: "candidate_ready" as const };
  });
  return { candidates: out, decisions };
}
