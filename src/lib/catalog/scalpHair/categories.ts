/**
 * Scalp / hair catalog category taxonomy (canonical).
 * Never mixed into face skincare rankProducts candidate pools.
 */

export const SCALP_CARE_CATEGORIES = [
  "scalp_shampoo",
  "dry_scalp_shampoo",
  "oily_scalp_shampoo",
  "sensitive_scalp_shampoo",
  "anti_dandruff_shampoo",
  "scalp_scaler",
  "scalp_scrub",
  "scalp_tonic",
  "scalp_essence",
  "scalp_serum",
  "scalp_mist",
  "scalp_mask",
] as const;

export const HAIR_CARE_CATEGORIES = [
  "moisturizing_shampoo",
  "damage_repair_shampoo",
  "color_care_shampoo",
  "volume_shampoo",
  "clarifying_shampoo",
  "conditioner",
  "treatment",
  "hair_mask",
  "leave_in_treatment",
  "hair_oil",
  "hair_serum",
  "heat_protectant",
  "curl_care",
  "styling_product",
] as const;

export const HAIR_LOSS_SUPPORT_CATEGORIES = [
  "functional_hair_loss_shampoo",
  "scalp_cleansing_support",
  "scalp_soothing_support",
  "breakage_support",
  "volume_appearance_support",
] as const;

export type ScalpCareCategory = (typeof SCALP_CARE_CATEGORIES)[number];
export type HairCareCategory = (typeof HAIR_CARE_CATEGORIES)[number];
export type HairLossSupportCategory =
  (typeof HAIR_LOSS_SUPPORT_CATEGORIES)[number];

export type CatalogDomain =
  | "face"
  | "scalp"
  | "hair"
  | "hair_loss_support"
  | "color_makeup"
  | "unknown";

const SCALP_SET = new Set<string>(SCALP_CARE_CATEGORIES);
const HAIR_SET = new Set<string>(HAIR_CARE_CATEGORIES);
const HLS_SET = new Set<string>(HAIR_LOSS_SUPPORT_CATEGORIES);

export function catalogDomainForCategory(
  category: string | null | undefined
): CatalogDomain {
  const c = String(category ?? "").trim().toLowerCase();
  if (!c) return "unknown";
  if (SCALP_SET.has(c)) return "scalp";
  if (HAIR_SET.has(c)) return "hair";
  if (HLS_SET.has(c)) return "hair_loss_support";
  if (
    ["lipstick", "lip_tint", "foundation", "cushion", "mascara"].includes(c)
  ) {
    return "color_makeup";
  }
  return "face";
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
  if (!raw?.trim()) return { category: null, needsReview: false };
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")
    .replace(/&/g, "and");

  const map: Record<string, string> = {
    dry_scalp_shampoo: "dry_scalp_shampoo",
    oily_scalp_shampoo: "oily_scalp_shampoo",
    sensitive_scalp_shampoo: "sensitive_scalp_shampoo",
    anti_dandruff: "anti_dandruff_shampoo",
    anti_dandruff_shampoo: "anti_dandruff_shampoo",
    dandruff_shampoo: "anti_dandruff_shampoo",
    scalp_scaler: "scalp_scaler",
    scalp_scaling: "scalp_scaler",
    scalp_scrub: "scalp_scrub",
    scalp_tonic: "scalp_tonic",
    hair_tonic: "scalp_tonic",
    scalp_essence: "scalp_essence",
    scalp_serum: "scalp_serum",
    scalp_mist: "scalp_mist",
    scalp_mask: "scalp_mask",
    scalp_shampoo: "scalp_shampoo",
    moisturizing_shampoo: "moisturizing_shampoo",
    damage_repair_shampoo: "damage_repair_shampoo",
    color_care_shampoo: "color_care_shampoo",
    volume_shampoo: "volume_shampoo",
    clarifying_shampoo: "clarifying_shampoo",
    conditioner: "conditioner",
    hair_conditioner: "conditioner",
    treatment: "treatment",
    hair_mask: "hair_mask",
    leave_in: "leave_in_treatment",
    leave_in_treatment: "leave_in_treatment",
    hair_oil: "hair_oil",
    hair_serum: "hair_serum",
    heat_protectant: "heat_protectant",
    curl_care: "curl_care",
    styling: "styling_product",
    styling_product: "styling_product",
    volume_appearance_support: "volume_appearance_support",
    breakage_support: "breakage_support",
    scalp_soothing_support: "scalp_soothing_support",
    scalp_cleansing_support: "scalp_cleansing_support",
    functional_hair_loss_shampoo: "functional_hair_loss_shampoo",
  };

  if (map[t]) {
    return { category: map[t], needsReview: false };
  }

  // Marketing terms that must not auto-confirm functional hair-loss shampoo
  if (
    t.includes("hair_loss") ||
    t.includes("thinning_hair") ||
    t.includes("anti_hair_loss") ||
    t.includes("탈모")
  ) {
    return {
      category: null,
      needsReview: true,
      reason: "hair_loss_marketing_requires_official_claim",
    };
  }

  if (t === "shampoo" || t === "hair_wash" || t === "hair_shampoo") {
    return {
      category: null,
      needsReview: true,
      reason: "generic_shampoo_needs_scalp_or_hair_intent",
    };
  }

  if (t.includes("volume") && t.includes("shampoo")) {
    return { category: "volume_shampoo", needsReview: false };
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
