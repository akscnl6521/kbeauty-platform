/**
 * Category alias → canonical + confidence.
 * Low confidence / ambiguous marketing → needs_review (no forced category).
 */

import {
  beautyDomainForCategory,
  isKnownCanonicalCategory,
  type BeautyDomain,
} from "./domains";

export type CategoryNormalizeResult = {
  category: string | null;
  domain: BeautyDomain | null;
  needsReview: boolean;
  confidence: "high" | "medium" | "low";
  reason?: string;
  aliasSource?: string;
};

function token(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")
    .replace(/&/g, "and");
}

/** Direct aliases (high confidence when unique). */
const ALIAS_MAP: Record<string, string> = {
  cleansing_oil: "cleansing_oil",
  oil_cleanser: "cleansing_oil",
  cleansing_balm: "cleansing_balm",
  balm_cleanser: "cleansing_balm",
  cleansing_water: "cleansing_water",
  micellar_water: "cleansing_water",
  cleansing_milk: "cleansing_milk",
  foam_cleanser: "foam_cleanser",
  foaming_cleanser: "foam_cleanser",
  gel_cleanser: "gel_cleanser",
  powder_cleanser: "powder_cleanser",
  cleanser: "foam_cleanser",
  face_wash: "foam_cleanser",
  exfoliator: "exfoliator",
  peeling_gel: "peeling_gel",
  toner: "toner",
  toner_pad: "toner_pad",
  essence: "essence",
  serum: "serum",
  ampoule: "ampoule",
  facial_mist: "facial_mist",
  face_mist: "facial_mist",
  lotion: "lotion",
  emulsion: "emulsion",
  cream: "cream",
  moisturizer: "cream",
  gel_cream: "gel_cream",
  face_oil: "face_oil",
  facial_oil: "face_oil",
  eye_cream: "eye_cream",
  eye_serum: "eye_serum",
  spot_care: "spot_care",
  spot_treatment: "spot_care",
  wash_off_mask: "wash_off_mask",
  sheet_mask: "sheet_mask",
  sleeping_mask: "sleeping_mask",
  hydrogel_mask: "hydrogel_mask",
  modeling_mask: "modeling_mask",

  sunscreen: "sunscreen",
  sun_cream: "sun_cream",
  suncream: "sun_cream",
  sun_lotion: "sun_lotion",
  sun_gel: "sun_gel",
  sun_stick: "sun_stick",
  sunstick: "sun_stick",
  sun_cushion: "sun_cushion",
  sun_spray: "sun_spray",
  tone_up_sunscreen: "tone_up_sunscreen",
  after_sun: "after_sun",

  lip_balm: "lip_balm",
  lipbalm: "lip_balm",
  tinted_lip_balm: "tinted_lip_balm",
  lip_mask: "lip_mask",
  lip_scrub: "lip_scrub",
  lip_oil: "lip_oil",
  lip_treatment: "lip_treatment",
  lipstick: "lipstick",
  lip_tint: "lip_tint",
  liptint: "lip_tint",
  lip_gloss: "lip_gloss",
  lipgloss: "lip_gloss",
  lip_lacquer: "lip_lacquer",
  lip_liner: "lip_liner",
  lip_palette: "lip_palette",

  primer: "primer",
  makeup_base: "makeup_base",
  tone_up_base: "tone_up_base",
  bb_cream: "bb_cream",
  cc_cream: "cc_cream",
  foundation: "foundation",
  cushion: "cushion",
  cushion_foundation: "cushion",
  concealer: "concealer",
  corrector: "corrector",
  loose_powder: "loose_powder",
  pressed_powder: "pressed_powder",
  setting_spray: "setting_spray",
  fixing_spray: "fixing_spray",
  blush: "blush",
  blusher: "blush",
  cream_blush: "cream_blush",
  liquid_blush: "liquid_blush",
  highlighter: "highlighter",
  contour: "contour",
  bronzer: "bronzer",
  face_palette: "face_palette",
  eyeshadow: "eyeshadow",
  eyeshadow_palette: "eyeshadow_palette",
  eyeliner: "eyeliner",
  mascara: "mascara",
  eye_primer: "eye_primer",
  glitter: "glitter",
  brow_pencil: "brow_pencil",
  brow: "brow_pencil",
  brow_powder: "brow_powder",
  brow_mascara: "brow_mascara",
  brow_gel: "brow_gel",

  dry_scalp_shampoo: "dry_scalp_shampoo",
  oily_scalp_shampoo: "oily_scalp_shampoo",
  sensitive_scalp_shampoo: "sensitive_scalp_shampoo",
  anti_dandruff: "anti_dandruff_shampoo",
  anti_dandruff_shampoo: "anti_dandruff_shampoo",
  dandruff_shampoo: "anti_dandruff_shampoo",
  clarifying_shampoo: "clarifying_shampoo",
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
  curl_shampoo: "curl_shampoo",
  conditioner: "conditioner",
  hair_conditioner: "conditioner",
  rinse: "rinse",
  treatment: "treatment",
  hair_mask: "hair_mask",
  leave_in: "leave_in_treatment",
  leave_in_treatment: "leave_in_treatment",
  hair_oil: "hair_oil",
  hair_serum: "hair_serum",
  heat_protectant: "heat_protectant",
  curl_care: "curl_care",
  anti_frizz: "anti_frizz",
  styling_cream: "styling_cream",
  styling_product: "styling_cream",
  hair_spray: "hair_spray",
  hairspray: "hair_spray",
  hair_wax: "hair_wax",
  volume_appearance_support: "volume_appearance_support",
  breakage_support: "breakage_support",
  scalp_soothing_support: "scalp_soothing_support",
  scalp_cleansing_support: "scalp_cleansing_support",
  functional_hair_loss_shampoo: "functional_hair_loss_shampoo",

  body_wash: "body_wash",
  bodywash: "body_wash",
  body_scrub: "body_scrub",
  body_lotion: "body_lotion",
  body_cream: "body_cream",
  body_butter: "body_butter",
  body_oil: "body_oil",
  body_mist: "body_mist",
  deodorant: "deodorant",
  hand_cream: "hand_cream",
  hand_mask: "hand_mask",
  foot_cream: "foot_cream",
  foot_mask: "foot_mask",
  foot_scrub: "foot_scrub",
  shaving_foam: "shaving_foam",
  after_shave: "after_shave",
  beard_oil: "beard_oil",
  baby_lotion: "baby_lotion",
  kids_sunscreen: "kids_sunscreen",
  nail_polish: "nail_polish",
  cuticle_oil: "cuticle_oil",
  perfume: "perfume",
  eau_de_parfum: "eau_de_parfum",
  eau_de_toilette: "eau_de_toilette",
  hair_mist: "hair_mist",
  makeup_brush: "makeup_brush",
  sponge: "sponge",
  beauty_blender: "sponge",
};

export function normalizeBeautyCategory(
  raw: string | null | undefined
): CategoryNormalizeResult {
  if (!raw?.trim()) {
    return {
      category: null,
      domain: null,
      needsReview: false,
      confidence: "low",
      reason: "empty",
    };
  }

  const t = token(raw);

  if (
    t.includes("hair_loss") ||
    t.includes("thinning_hair") ||
    t.includes("anti_hair_loss") ||
    t.includes("탈모")
  ) {
    return {
      category: null,
      domain: null,
      needsReview: true,
      confidence: "low",
      reason: "hair_loss_marketing_requires_official_claim",
      aliasSource: "policy",
    };
  }

  if (t === "shampoo" || t === "hair_wash" || t === "hair_shampoo") {
    return {
      category: null,
      domain: null,
      needsReview: true,
      confidence: "low",
      reason: "generic_shampoo_needs_scalp_or_hair_intent",
      aliasSource: "policy",
    };
  }

  if (t === "tone_up" || t === "toneup") {
    return {
      category: null,
      domain: null,
      needsReview: true,
      confidence: "low",
      reason: "tone_up_ambiguous_sun_vs_base",
      aliasSource: "policy",
    };
  }

  if (t === "mask") {
    return {
      category: null,
      domain: null,
      needsReview: true,
      confidence: "low",
      reason: "mask_ambiguous_face_vs_hair_vs_sheet",
      aliasSource: "policy",
    };
  }

  if (t.includes("volume") && t.includes("shampoo")) {
    return {
      category: "volume_shampoo",
      domain: "hair_care",
      needsReview: false,
      confidence: "high",
      aliasSource: "alias",
    };
  }

  if (ALIAS_MAP[t]) {
    const category = ALIAS_MAP[t];
    return {
      category,
      domain: beautyDomainForCategory(category),
      needsReview: false,
      confidence: "high",
      aliasSource: "alias",
    };
  }

  if (isKnownCanonicalCategory(t)) {
    return {
      category: t,
      domain: beautyDomainForCategory(t),
      needsReview: false,
      confidence: "high",
      aliasSource: "canonical",
    };
  }

  return {
    category: null,
    domain: null,
    needsReview: true,
    confidence: "low",
    reason: "unknown_category",
    aliasSource: "fallback",
  };
}
