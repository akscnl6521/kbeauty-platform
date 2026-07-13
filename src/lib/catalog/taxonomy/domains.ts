/**
 * Canonical beauty catalog domains and categories.
 * Recommendation candidate pools must never mix across domains.
 */

export const BEAUTY_DOMAINS = [
  "face_skincare",
  "sun_care",
  "lip_care",
  "lip_color",
  "base_makeup",
  "color_makeup",
  "eye_makeup",
  "brow_makeup",
  "scalp_care",
  "hair_care",
  "hair_loss_support",
  "body_care",
  "hand_foot_care",
  "shaving_care",
  "baby_kids",
  "nail_care",
  "fragrance",
  "beauty_tools",
  "other",
] as const;

export type BeautyDomain = (typeof BEAUTY_DOMAINS)[number];

/** @deprecated Prefer BeautyDomain. Maps legacy admin filter values. */
export type LegacyCatalogDomain =
  | "face"
  | "scalp"
  | "hair"
  | "hair_loss_support"
  | "color_makeup"
  | "unknown";

export const FACE_SKINCARE_CATEGORIES = [
  "cleansing_oil",
  "cleansing_balm",
  "cleansing_water",
  "cleansing_milk",
  "foam_cleanser",
  "gel_cleanser",
  "powder_cleanser",
  "exfoliator",
  "peeling_gel",
  "toner",
  "toner_pad",
  "essence",
  "serum",
  "ampoule",
  "facial_mist",
  "lotion",
  "emulsion",
  "cream",
  "gel_cream",
  "face_oil",
  "eye_cream",
  "eye_serum",
  "spot_care",
  "wash_off_mask",
  "sheet_mask",
  "sleeping_mask",
  "hydrogel_mask",
  "modeling_mask",
] as const;

export const SUN_CARE_CATEGORIES = [
  "sunscreen",
  "sun_lotion",
  "sun_gel",
  "sun_cream",
  "sun_stick",
  "sun_cushion",
  "sun_spray",
  "tone_up_sunscreen",
  "after_sun",
] as const;

export const LIP_CARE_CATEGORIES = [
  "lip_balm",
  "tinted_lip_balm",
  "lip_mask",
  "lip_scrub",
  "lip_oil",
  "lip_treatment",
] as const;

export const LIP_COLOR_CATEGORIES = [
  "lipstick",
  "lip_tint",
  "lip_gloss",
  "lip_lacquer",
  "lip_liner",
  "lip_palette",
] as const;

export const BASE_MAKEUP_CATEGORIES = [
  "primer",
  "makeup_base",
  "tone_up_base",
  "bb_cream",
  "cc_cream",
  "foundation",
  "cushion",
  "concealer",
  "corrector",
  "loose_powder",
  "pressed_powder",
  "setting_spray",
  "fixing_spray",
] as const;

export const COLOR_MAKEUP_CATEGORIES = [
  "blush",
  "cream_blush",
  "liquid_blush",
  "highlighter",
  "contour",
  "bronzer",
  "face_palette",
] as const;

export const EYE_MAKEUP_CATEGORIES = [
  "eyeshadow",
  "eyeshadow_palette",
  "eyeliner",
  "mascara",
  "eye_primer",
  "glitter",
] as const;

export const BROW_MAKEUP_CATEGORIES = [
  "brow_pencil",
  "brow_powder",
  "brow_mascara",
  "brow_gel",
] as const;

export const SCALP_CARE_CATEGORIES = [
  "scalp_shampoo",
  "oily_scalp_shampoo",
  "dry_scalp_shampoo",
  "sensitive_scalp_shampoo",
  "anti_dandruff_shampoo",
  "clarifying_shampoo",
  "scalp_scaler",
  "scalp_scrub",
  "scalp_tonic",
  "scalp_serum",
  "scalp_essence",
  "scalp_mist",
  "scalp_mask",
] as const;

export const HAIR_CARE_CATEGORIES = [
  "moisturizing_shampoo",
  "damage_repair_shampoo",
  "color_care_shampoo",
  "volume_shampoo",
  "curl_shampoo",
  "conditioner",
  "rinse",
  "treatment",
  "hair_mask",
  "leave_in_treatment",
  "hair_oil",
  "hair_serum",
  "heat_protectant",
  "curl_care",
  "anti_frizz",
  "styling_cream",
  "hair_spray",
  "hair_wax",
] as const;

export const HAIR_LOSS_SUPPORT_CATEGORIES = [
  "functional_hair_loss_shampoo",
  "scalp_cleansing_support",
  "scalp_soothing_support",
  "breakage_support",
  "volume_appearance_support",
] as const;

export const BODY_CARE_CATEGORIES = [
  "body_wash",
  "body_scrub",
  "body_lotion",
  "body_cream",
  "body_butter",
  "body_oil",
  "body_mist",
  "deodorant",
  "intimate_wash",
] as const;

export const HAND_FOOT_CARE_CATEGORIES = [
  "hand_wash",
  "hand_cream",
  "hand_mask",
  "foot_cream",
  "foot_mask",
  "foot_scrub",
] as const;

export const SHAVING_CARE_CATEGORIES = [
  "shaving_foam",
  "shaving_gel",
  "after_shave",
  "beard_oil",
  "beard_wash",
] as const;

export const BABY_KIDS_CATEGORIES = [
  "baby_wash",
  "baby_lotion",
  "baby_cream",
  "kids_sunscreen",
  "kids_shampoo",
] as const;

export const NAIL_CARE_CATEGORIES = [
  "nail_polish",
  "gel_nail",
  "base_coat",
  "top_coat",
  "nail_treatment",
  "cuticle_oil",
  "nail_remover",
] as const;

export const FRAGRANCE_CATEGORIES = [
  "perfume",
  "eau_de_parfum",
  "eau_de_toilette",
  "body_fragrance",
  "hair_mist",
] as const;

export const BEAUTY_TOOLS_CATEGORIES = [
  "cleansing_tool",
  "makeup_brush",
  "makeup_puff",
  "sponge",
  "eyelash_curler",
  "hair_brush",
  "scalp_brush",
  "beauty_device",
] as const;

export const DOMAIN_CATEGORIES: Record<BeautyDomain, readonly string[]> = {
  face_skincare: FACE_SKINCARE_CATEGORIES,
  sun_care: SUN_CARE_CATEGORIES,
  lip_care: LIP_CARE_CATEGORIES,
  lip_color: LIP_COLOR_CATEGORIES,
  base_makeup: BASE_MAKEUP_CATEGORIES,
  color_makeup: COLOR_MAKEUP_CATEGORIES,
  eye_makeup: EYE_MAKEUP_CATEGORIES,
  brow_makeup: BROW_MAKEUP_CATEGORIES,
  scalp_care: SCALP_CARE_CATEGORIES,
  hair_care: HAIR_CARE_CATEGORIES,
  hair_loss_support: HAIR_LOSS_SUPPORT_CATEGORIES,
  body_care: BODY_CARE_CATEGORIES,
  hand_foot_care: HAND_FOOT_CARE_CATEGORIES,
  shaving_care: SHAVING_CARE_CATEGORIES,
  baby_kids: BABY_KIDS_CATEGORIES,
  nail_care: NAIL_CARE_CATEGORIES,
  fragrance: FRAGRANCE_CATEGORIES,
  beauty_tools: BEAUTY_TOOLS_CATEGORIES,
  other: [],
};

const CATEGORY_TO_DOMAIN = new Map<string, BeautyDomain>();
for (const domain of BEAUTY_DOMAINS) {
  for (const cat of DOMAIN_CATEGORIES[domain]) {
    CATEGORY_TO_DOMAIN.set(cat, domain);
  }
}

/** Legacy face aliases still seen in DB (map to face_skincare until remapped). */
const LEGACY_FACE_ALIASES = new Set([
  "cleanser",
  "foam",
  "gel_cleanser_legacy",
  "makeup_remover",
  "mask",
  "moisturizer",
  "moisturizer_cream",
]);

export function beautyDomainForCategory(
  category: string | null | undefined
): BeautyDomain {
  const c = String(category ?? "")
    .trim()
    .toLowerCase();
  if (!c) return "other";
  const hit = CATEGORY_TO_DOMAIN.get(c);
  if (hit) return hit;
  if (LEGACY_FACE_ALIASES.has(c)) return "face_skincare";
  return "other";
}

export function categoriesForDomain(domain: BeautyDomain): readonly string[] {
  return DOMAIN_CATEGORIES[domain] ?? [];
}

export function isKnownCanonicalCategory(category: string): boolean {
  return CATEGORY_TO_DOMAIN.has(category.trim().toLowerCase());
}

/**
 * Map new domains to legacy admin filter buckets used before this sprint.
 */
export function toLegacyCatalogDomain(
  domain: BeautyDomain
): LegacyCatalogDomain {
  switch (domain) {
    case "face_skincare":
    case "sun_care":
    case "lip_care":
      return "face";
    case "lip_color":
    case "base_makeup":
    case "color_makeup":
    case "eye_makeup":
    case "brow_makeup":
      return "color_makeup";
    case "scalp_care":
      return "scalp";
    case "hair_care":
      return "hair";
    case "hair_loss_support":
      return "hair_loss_support";
    default:
      return "unknown";
  }
}

export function expandLegacyDomainFilter(
  legacyOrNew: string
): BeautyDomain[] | null {
  const t = legacyOrNew.trim().toLowerCase();
  if (!t) return null;
  if ((BEAUTY_DOMAINS as readonly string[]).includes(t)) {
    return [t as BeautyDomain];
  }
  if (t === "face") return ["face_skincare", "sun_care", "lip_care"];
  if (t === "scalp") return ["scalp_care"];
  if (t === "hair") return ["hair_care"];
  if (t === "color_makeup") {
    return ["lip_color", "base_makeup", "color_makeup", "eye_makeup", "brow_makeup"];
  }
  return null;
}

/**
 * Men's grooming is audience metadata, not a product category domain.
 */
export type TargetAudience =
  | "unisex"
  | "women"
  | "men"
  | "teen"
  | "kids"
  | "baby"
  | "unknown";
