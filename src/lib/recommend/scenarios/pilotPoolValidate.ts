/**
 * Pure validators for offline scenario Top10 pilot pool JSON.
 * No DB / network / multiSource.
 */

export const PILOT_READINESS_STATES = [
  "trend_candidate",
  "catalog_ready",
  "ingredient_candidate",
  "recommendation_ready",
  "review_required",
  "unavailable",
] as const;

export type PilotReadiness = (typeof PILOT_READINESS_STATES)[number];

export const PILOT_ROLE_TAGS = [
  "popular",
  "safety",
  "rising",
  "value",
  "emerging",
] as const;

export type PilotRoleTag = (typeof PILOT_ROLE_TAGS)[number];

export type PilotCandidate = {
  productIdentity: string;
  brand: string;
  normalizedProductName: string;
  category: string;
  scenarioFit: unknown;
  roleTags: string[];
  trendEvidence: unknown;
  ingredientEvidence: unknown;
  imageEvidence: unknown;
  offerEvidence: unknown;
  sourceUrls: unknown;
  sourceTrust: unknown;
  dataFreshness: unknown;
  cautionIngredients: unknown;
  readiness: string;
  rejectionReason: string | null;
  affiliateOrAdInScore?: boolean;
};

export type PilotPoolFile = {
  scenarioId: string;
  brandCapDefault?: number;
  affiliateOrAdInScore?: boolean;
  candidates: PilotCandidate[];
  metrics?: unknown;
};

const REQUIRED_CANDIDATE_KEYS = [
  "productIdentity",
  "brand",
  "normalizedProductName",
  "category",
  "scenarioFit",
  "roleTags",
  "trendEvidence",
  "ingredientEvidence",
  "imageEvidence",
  "offerEvidence",
  "sourceUrls",
  "sourceTrust",
  "dataFreshness",
  "cautionIngredients",
  "readiness",
  "rejectionReason",
] as const;

export type PoolShapeResult = {
  ok: boolean;
  errors: string[];
};

export function validatePoolShape(pool: unknown): PoolShapeResult {
  const errors: string[] = [];
  if (!pool || typeof pool !== "object") {
    return { ok: false, errors: ["pool must be an object"] };
  }
  const p = pool as PilotPoolFile;
  if (typeof p.scenarioId !== "string" || !p.scenarioId.trim()) {
    errors.push("scenarioId required");
  }
  if (!Array.isArray(p.candidates)) {
    errors.push("candidates must be an array");
    return { ok: false, errors };
  }

  const usable = p.candidates.filter((c) => c?.readiness !== "unavailable");
  if (usable.length !== 10) {
    errors.push(
      `expected exactly 10 non-unavailable candidates, got ${usable.length}`
    );
  }

  for (let i = 0; i < p.candidates.length; i++) {
    const c = p.candidates[i];
    if (!c || typeof c !== "object") {
      errors.push(`candidate[${i}] not an object`);
      continue;
    }
    for (const key of REQUIRED_CANDIDATE_KEYS) {
      if (!(key in c)) errors.push(`candidate[${i}] missing ${key}`);
    }
    if (!Array.isArray(c.roleTags) || c.roleTags.length === 0) {
      errors.push(`candidate[${i}] roleTags must be non-empty array`);
    } else {
      for (const tag of c.roleTags) {
        if (!(PILOT_ROLE_TAGS as readonly string[]).includes(tag)) {
          errors.push(`candidate[${i}] invalid roleTag ${tag}`);
        }
      }
    }
    if (typeof c.productIdentity !== "string" || !c.productIdentity.trim()) {
      errors.push(`candidate[${i}] productIdentity required`);
    }
    if (typeof c.brand !== "string" || !c.brand.trim()) {
      errors.push(`candidate[${i}] brand required`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export type PoolMetrics = {
  poolSize: number;
  readinessCounts: Record<PilotReadiness, number>;
  recommendationReadyCount: number;
  distinctBrands: number;
  brandCounts: Record<string, number>;
  distinctRoleTags: string[];
  identities: string[];
};

export function computePoolMetrics(
  candidates: readonly PilotCandidate[]
): PoolMetrics {
  const usable = candidates.filter((c) => c.readiness !== "unavailable");
  const readinessCounts = Object.fromEntries(
    PILOT_READINESS_STATES.map((r) => [r, 0])
  ) as Record<PilotReadiness, number>;
  const brandCounts: Record<string, number> = {};
  const roleSet = new Set<string>();
  for (const c of usable) {
    if ((PILOT_READINESS_STATES as readonly string[]).includes(c.readiness)) {
      readinessCounts[c.readiness as PilotReadiness] += 1;
    }
    const brandKey = c.brand.trim().toLowerCase();
    brandCounts[brandKey] = (brandCounts[brandKey] ?? 0) + 1;
    for (const t of c.roleTags ?? []) roleSet.add(t);
  }
  return {
    poolSize: usable.length,
    readinessCounts,
    recommendationReadyCount: readinessCounts.recommendation_ready,
    distinctBrands: Object.keys(brandCounts).length,
    brandCounts,
    distinctRoleTags: [...roleSet].sort(),
    identities: usable.map((c) => c.productIdentity),
  };
}

export type BrandCapResult = { ok: boolean; violations: string[] };

export function assertBrandCap(
  candidates: readonly PilotCandidate[],
  cap = 2
): BrandCapResult {
  const usable = candidates.filter((c) => c.readiness !== "unavailable");
  const counts: Record<string, number> = {};
  const violations: string[] = [];
  for (const c of usable) {
    const key = c.brand.trim().toLowerCase();
    counts[key] = (counts[key] ?? 0) + 1;
    if (counts[key] > cap) {
      violations.push(`${c.brand} count ${counts[key]} > cap ${cap}`);
    }
  }
  return { ok: violations.length === 0, violations };
}

export type AffiliateAssertResult = { ok: boolean; offenders: string[] };

export function assertNoAffiliateInScore(
  candidates: readonly PilotCandidate[],
  poolAffiliateFlag?: boolean
): AffiliateAssertResult {
  const offenders: string[] = [];
  if (poolAffiliateFlag === true) {
    offenders.push("pool.affiliateOrAdInScore === true");
  }
  for (const c of candidates) {
    if (c.affiliateOrAdInScore === true) {
      offenders.push(c.productIdentity);
    }
  }
  return { ok: offenders.length === 0, offenders };
}

export type ReadinessEnumResult = { ok: boolean; invalid: string[] };

export function assertReadinessEnum(
  candidates: readonly PilotCandidate[]
): ReadinessEnumResult {
  const invalid: string[] = [];
  for (const c of candidates) {
    if (!(PILOT_READINESS_STATES as readonly string[]).includes(c.readiness)) {
      invalid.push(`${c.productIdentity}:${c.readiness}`);
    }
  }
  return { ok: invalid.length === 0, invalid };
}
