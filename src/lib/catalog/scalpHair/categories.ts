/**
 * Scalp / hair category helpers — backed by canonical beauty taxonomy.
 * Never mixed into face skincare rankProducts candidate pools.
 */

import {
  HAIR_CARE_CATEGORIES,
  HAIR_LOSS_SUPPORT_CATEGORIES,
  SCALP_CARE_CATEGORIES,
  beautyDomainForCategory,
  normalizeBeautyCategory,
  toLegacyCatalogDomain,
  type BeautyDomain,
  type LegacyCatalogDomain,
} from "@/lib/catalog/taxonomy";

export {
  SCALP_CARE_CATEGORIES,
  HAIR_CARE_CATEGORIES,
  HAIR_LOSS_SUPPORT_CATEGORIES,
};

export type ScalpCareCategory = (typeof SCALP_CARE_CATEGORIES)[number];
export type HairCareCategory = (typeof HAIR_CARE_CATEGORIES)[number];
export type HairLossSupportCategory =
  (typeof HAIR_LOSS_SUPPORT_CATEGORIES)[number];

/** @deprecated Prefer BeautyDomain from taxonomy */
export type CatalogDomain = LegacyCatalogDomain;

export function catalogDomainForCategory(
  category: string | null | undefined
): CatalogDomain {
  return toLegacyCatalogDomain(beautyDomainForCategory(category));
}

export function beautyDomainForScalpHairCategory(
  category: string | null | undefined
): BeautyDomain {
  return beautyDomainForCategory(category);
}

/**
 * Alias → canonical. Ambiguous hair-loss marketing terms stay needs_review.
 */
export function normalizeScalpHairCategoryAlias(
  raw: string | null | undefined
): {
  category: string | null;
  needsReview: boolean;
  reason?: string;
} {
  const n = normalizeBeautyCategory(raw);
  const domain = n.domain;
  const isScalpHair =
    domain === "scalp_care" ||
    domain === "hair_care" ||
    domain === "hair_loss_support" ||
    n.reason === "generic_shampoo_needs_scalp_or_hair_intent" ||
    n.reason === "hair_loss_marketing_requires_official_claim";

  if (!isScalpHair && !n.needsReview) {
    // Not a scalp/hair alias — leave to general taxonomy
    return { category: null, needsReview: false };
  }

  if (n.needsReview && !n.category) {
    return {
      category: null,
      needsReview: true,
      reason: n.reason,
    };
  }

  if (
    n.category &&
    (domain === "scalp_care" ||
      domain === "hair_care" ||
      domain === "hair_loss_support")
  ) {
    return { category: n.category, needsReview: false };
  }

  return { category: null, needsReview: false };
}

/** Volume / “두피 강화” marketing is never hair-loss treatment. */
export function isHairLossTreatmentMisclassification(
  category: string | null | undefined,
  marketingText?: string | null
): boolean {
  const text = String(marketingText ?? "").toLowerCase();
  if (category === "volume_shampoo" && /탈모|발모|치료/.test(text)) {
    return true;
  }
  if (/두피\s*강화/.test(text) && /발모|치료|완치/.test(text)) {
    return true;
  }
  return false;
}
