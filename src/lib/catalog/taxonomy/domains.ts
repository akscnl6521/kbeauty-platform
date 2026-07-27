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
  "beauty_devices",
  "oral_smile_beauty",
  "regulated_wellness",
  "professional_products",
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
  "beauty_storage",
  "tool_cleaner",
] as const;

export const BEAUTY_DEVICE_CATEGORIES = [
  "led_mask",
  "galvanic_device",
  "rf_device",
  "ultrasound_device",
  "microcurrent_device",
  "cleansing_device",
  "pore_suction_device",
  "skin_meter",
  "hair_dryer",
  "hair_iron",
  "hair_styler",
  "scalp_massager",
  "electric_shaver",
  "epilator",
  "nail_drill",
  "heated_lash_curler",
  "device_consumable",
] as const;

export const ORAL_SMILE_BEAUTY_CATEGORIES = [
  "whitening_toothpaste",
  "breath_care",
  "whitening_strip",
  "stain_care",
] as const;

/** Never eligible for an ordinary cosmetics recommendation without a separate gate. */
export const REGULATED_WELLNESS_CATEGORIES = [
  "inner_beauty",
  "beauty_supplement",
  "beauty_food",
  "color_contact_lens",
  "medical_device_candidate",
] as const;

export const PROFESSIONAL_PRODUCT_CATEGORIES = [
  "salon_chemical",
  "esthetic_professional_product",
  "professional_peel",
  "professional_hair_chemical",
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
  beauty_devices: BEAUTY_DEVICE_CATEGORIES,
  oral_smile_beauty: ORAL_SMILE_BEAUTY_CATEGORIES,
  regulated_wellness: REGULATED_WELLNESS_CATEGORIES,
  professional_products: PROFESSIONAL_PRODUCT_CATEGORIES,
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

/**
 * 얼굴 외 도메인의 실사용 별칭 (§44 단계 5.5 · 6.5).
 *
 * 정규 카테고리는 `scalp_shampoo`·`moisturizing_shampoo`처럼 세분화돼 있지만,
 * 공식 사이트 크롤과 기존 DB는 `shampoo`·`hair_treatment` 같은 평문을 쓴다.
 * 그대로 두면 두피·헤어·바디 제품이 전부 `other` 로 떨어져 도메인 필터
 * (`filterCandidatesForDomain`)에서 사라진다 — 즉 등록해도 추천에 안 뜬다.
 *
 * 정규 목록(`SCALP_CARE_CATEGORIES` 등)은 그대로 두고 조회 시점에만 흡수한다.
 * 목록을 늘리면 `categoriesForDomain`·관리자 필터의 의미가 함께 바뀐다.
 */
const LEGACY_DOMAIN_ALIASES = new Map<string, BeautyDomain>([
  // 헤어 — 일반 세정·트리트먼트는 hair_care
  ["shampoo", "hair_care"],
  ["hair_shampoo", "hair_care"],
  ["conditioner_rinse", "hair_care"],
  ["hair_treatment", "hair_care"],
  ["hair_pack", "hair_care"],
  ["hair_essence", "hair_care"],
  ["hair_ampoule", "hair_care"],
  ["hair_styling", "hair_care"],
  ["hair_gel", "hair_care"],

  // 두피 — 두피를 명시한 것만 scalp_care
  ["scalp_care", "scalp_care"],
  ["scalp_treatment", "scalp_care"],
  ["hair_tonic", "scalp_care"],
  ["scalp_shampoo_legacy", "scalp_care"],

  // 바디·핸드·풋
  ["body", "body_care"],
  ["body_care", "body_care"],
  ["bodywash", "body_care"],
  ["shower_gel", "body_care"],
  ["hand_care", "hand_foot_care"],
  ["foot_care", "hand_foot_care"],

  // 기존 DB 에 실제로 남아있는 공백·슬래시 표기
  ["lip care", "lip_care"],
  ["lip_care", "lip_care"],
  ["makeup/base", "base_makeup"],
  ["makeup_base", "base_makeup"],
  ["sun care", "sun_care"],
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
  const alias = LEGACY_DOMAIN_ALIASES.get(c);
  if (alias) return alias;
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
