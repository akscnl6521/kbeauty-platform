import {
  CANDIDATE_ROLES,
  type CandidateRole,
  type RecommendationScenario,
} from "./types";

/** Affiliate/commercial score must never influence scenario pool selection. */
export const AFFILIATE_SCORE_FORBIDDEN = true as const;

export const DEFAULT_BRAND_CAP = 2;
export const MAX_BRAND_CAP_WITH_EVIDENCE = 3;

export function resolveBrandCap(
  scenario: Pick<
    RecommendationScenario,
    "brandCapDefault" | "brandCapMaxWithEvidence"
  >,
  hasStrongEvidence = false
): number {
  return hasStrongEvidence
    ? scenario.brandCapMaxWithEvidence
    : scenario.brandCapDefault;
}

export function applyBrandCap<T extends { brand: string }>(
  ranked: readonly T[],
  cap: number = DEFAULT_BRAND_CAP
): T[] {
  const counts = new Map<string, number>();
  const out: T[] = [];
  for (const item of ranked) {
    const key = item.brand.trim().toLowerCase();
    const used = counts.get(key) ?? 0;
    if (used >= cap) continue;
    counts.set(key, used + 1);
    out.push(item);
  }
  return out;
}

export type RoleCoverageResult = {
  ok: boolean;
  distinctCount: number;
  missing: CandidateRole[];
};

/**
 * Checks role diversity, not exact per-role counts.
 * Pass when at least minDistinct roles are represented.
 */
export function checkRoleCoverage(
  rolesPresent: readonly CandidateRole[],
  minDistinct = 2
): RoleCoverageResult {
  const distinct = new Set(rolesPresent);
  const missing = CANDIDATE_ROLES.filter((role) => !distinct.has(role));
  return {
    ok: distinct.size >= minDistinct,
    distinctCount: distinct.size,
    missing,
  };
}

export function assertAffiliateScoreNotUsed(scoreSource?: string): boolean {
  if (!scoreSource) return true;
  return !/affiliate|commission|sponsored/i.test(scoreSource);
}
