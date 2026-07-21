/**
 * Catalog quality status classifier for staging candidates (never auto-publish).
 */

export const CATALOG_QUALITY_STATUSES = [
  "staging_ready",
  "review_required",
  "source_unverified",
  "ingredient_incomplete",
  "image_missing",
  "offer_missing",
  "duplicate",
  "unavailable",
  "discontinued",
  "blocked_by_policy",
] as const;

export type CatalogQualityStatus = (typeof CATALOG_QUALITY_STATUSES)[number];

export type CatalogQualityInput = {
  blockedByPolicy?: boolean;
  isDuplicate?: boolean;
  discontinued?: boolean;
  unavailable?: boolean;
  sourceVerified?: boolean;
  hasIngredients?: boolean;
  hasImage?: boolean;
  hasOffer?: boolean;
  needsReview?: boolean;
  reasons?: string[];
};

/** First matching blocker by priority (most severe first). */
export const CATALOG_QUALITY_PRIORITY: CatalogQualityStatus[] = [
  "blocked_by_policy",
  "duplicate",
  "discontinued",
  "unavailable",
  "source_unverified",
  "ingredient_incomplete",
  "image_missing",
  "offer_missing",
  "review_required",
  "staging_ready",
];

export function classifyCatalogQualityStatus(
  input: CatalogQualityInput
): CatalogQualityStatus {
  if (input.blockedByPolicy) return "blocked_by_policy";
  if (input.isDuplicate) return "duplicate";
  if (input.discontinued) return "discontinued";
  if (input.unavailable) return "unavailable";
  if (input.sourceVerified === false) return "source_unverified";
  if (input.hasIngredients === false) return "ingredient_incomplete";
  if (input.hasImage === false) return "image_missing";
  if (input.hasOffer === false) return "offer_missing";
  if (input.needsReview) return "review_required";
  return "staging_ready";
}

export function isStagingReadyStatus(status: CatalogQualityStatus): boolean {
  return status === "staging_ready";
}

export function countByQualityStatus(
  statuses: CatalogQualityStatus[]
): Record<CatalogQualityStatus, number> {
  const out = Object.fromEntries(
    CATALOG_QUALITY_STATUSES.map((s) => [s, 0])
  ) as Record<CatalogQualityStatus, number>;
  for (const status of statuses) out[status] += 1;
  return out;
}

export function rateOf(
  count: number,
  total: number
): { count: number; total: number; ratePct: number } {
  const ratePct = total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
  return { count, total, ratePct };
}

export function computeCatalogQualityRates(input: {
  total: number;
  withIngredients: number;
  withImage: number;
  withOffer: number;
  stagingReady: number;
  duplicate: number;
  reviewOrBlocked: number;
}) {
  const { total } = input;
  return {
    ingredient: rateOf(input.withIngredients, total),
    image: rateOf(input.withImage, total),
    offer: rateOf(input.withOffer, total),
    stagingReady: rateOf(input.stagingReady, total),
    duplicate: rateOf(input.duplicate, total),
    reviewOrBlocked: rateOf(input.reviewOrBlocked, total),
  };
}
