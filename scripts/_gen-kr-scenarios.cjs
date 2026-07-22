"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SCENARIOS_DIR = path.join(ROOT, "src", "lib", "recommend", "scenarios");
const SCRIPTS_DIR = path.join(ROOT, "scripts");

function ko(codePoints) {
  return String.fromCodePoint(...codePoints);
}

const DEFAULT_EVIDENCE = {
  identityConfirmed: true,
  ingredientsOrTrustedEvidence: true,
  imageRequired: true,
  minOffers: 1,
  safetyFilterApplicable: true,
  noCriticalSourceConflict: true,
};

const POOL_CONSTANTS = {
  candidatePoolSize: 10,
  finalRecommendationMin: 3,
  finalRecommendationMax: 5,
  brandCapDefault: 2,
  brandCapMaxWithEvidence: 3,
  marketPriority: "KR",
  status: "active",
};

function scenario(def) {
  return {
    ...POOL_CONSTANTS,
    requiredProductEvidence: { ...DEFAULT_EVIDENCE },
    ...def,
  };
}

function buildScenarios() {
  return [
    // redness_sensitive (5)
    scenario({
      scenarioId: "kr-redness-sensitive-cream",
      displayNameKo: ko([0xbbfc, 0xac10, 0xb7, 0xd64d, 0xc870, 0x20, 0xb7, 0x20, 0xc9c4, 0xc815, 0x20, 0xd06c, 0xb9bc]),
      primaryConcern: "redness",
      secondaryConcerns: ["sensitivity"],
      productCategory: "cream",
      bodyArea: "face",
      sensitivityLevel: "high",
      prohibitedOrCautionIngredients: ["Fragrance", "Alcohol Denat", "Menthol", "Retinol", "Salicylic Acid"],
      expectedBenefitScope: "soothing moisturize assist",
      cosmeticLimitations: "not medical treatment; cosmetic soothing only",
      dermatologistEscalationConditions: ["pain", "oozing", "spreading_rash", "persistent_burning"],
      priorityArea: "redness_sensitive",
    }),
    scenario({
      scenarioId: "kr-redness-soothing-serum",
      displayNameKo: ko([0xd64d, 0xc870, 0x20, 0xb7, 0x20, 0xc800, 0xc790, 0xadf9, 0x20, 0xc9c4, 0xc815, 0x20, 0xc138, 0xb7, 0xbc]),
      primaryConcern: "redness",
      secondaryConcerns: ["sensitivity", "barrier"],
      productCategory: "serum",
      bodyArea: "face",
      sensitivityLevel: "high",
      prohibitedOrCautionIngredients: ["Fragrance", "Essential Oils", "Alcohol Denat", "Menthol"],
      expectedBenefitScope: "calm visible redness",
      cosmeticLimitations: "does not treat rosacea diagnosis",
      dermatologistEscalationConditions: ["swelling", "heat_pain", "capillary_burst"],
      priorityArea: "redness_sensitive",
    }),
    scenario({
      scenarioId: "kr-redness-gentle-cleanser",
      displayNameKo: ko([0xbbfc, 0xac10, 0x20, 0xd53c, 0xbd80, 0x20, 0xb7, 0x20, 0xc21c, 0xd55c, 0x20, 0xd074, 0xb818, 0xc800]),
      primaryConcern: "sensitivity",
      secondaryConcerns: ["redness"],
      productCategory: "cleanser",
      bodyArea: "face",
      sensitivityLevel: "high",
      prohibitedOrCautionIngredients: ["SLS", "Fragrance", "Alcohol Denat"],
      expectedBenefitScope: "gentle cleanse without stripping",
      cosmeticLimitations: "rinse-off only",
      dermatologistEscalationConditions: ["post_wash_stinging", "contact_dermatitis"],
      priorityArea: "redness_sensitive",
    }),
    scenario({
      scenarioId: "kr-redness-toner-pad",
      displayNameKo: ko([0xbd89, 0xc740, 0xae30, 0x20, 0xb7, 0x20, 0xc9c4, 0xc815, 0x20, 0xd1a0, 0xb108, 0x20, 0xd328, 0xb4dc]),
      primaryConcern: "redness",
      secondaryConcerns: ["sensitivity"],
      productCategory: "toner_pad",
      bodyArea: "face",
      sensitivityLevel: "moderate",
      prohibitedOrCautionIngredients: ["Fragrance", "Alcohol Denat", "Witch Hazel"],
      expectedBenefitScope: "cooling pad for flush",
      cosmeticLimitations: "avoid over-exfoliation",
      dermatologistEscalationConditions: ["pad_irritation", "worsening_redness"],
      priorityArea: "redness_sensitive",
    }),
    scenario({
      scenarioId: "kr-redness-calming-mist",
      displayNameKo: ko([0xc5f4, 0xac10, 0xb7, 0xd64d, 0xc870, 0x20, 0xb7, 0x20, 0xc9c4, 0xc815, 0x20, 0xbbf8, 0xc2a4, 0xd2b8]),
      primaryConcern: "redness",
      secondaryConcerns: ["sensitivity", "dryness"],
      productCategory: "mist",
      bodyArea: "face",
      sensitivityLevel: "moderate",
      prohibitedOrCautionIngredients: ["Fragrance", "Peppermint", "Alcohol Denat"],
      expectedBenefitScope: "instant cooling mist",
      cosmeticLimitations: "temporary relief only",
      dermatologistEscalationConditions: ["mist_stings", "persistent_flush"],
      priorityArea: "redness_sensitive",
    }),

    // dry_barrier (5)
    scenario({
      scenarioId: "kr-dryness-barrier-cream",
      displayNameKo: ko([0xac74, 0xc870, 0xb7, 0xc7a5, 0xbc29, 0x20, 0xb7, 0x20, 0xbcf4, 0xc2b5, 0x20, 0xd06c, 0xb9bc]),
      primaryConcern: "dryness",
      secondaryConcerns: ["barrier", "sensitivity"],
      productCategory: "cream",
      bodyArea: "face",
      sensitivityLevel: "moderate",
      prohibitedOrCautionIngredients: ["High Alcohol", "Strong Fragrance"],
      expectedBenefitScope: "barrier moisture seal",
      cosmeticLimitations: "not for open wounds",
      dermatologistEscalationConditions: ["cracking_bleeding", "eczema_flare"],
      priorityArea: "dry_barrier",
    }),
    scenario({
      scenarioId: "kr-dryness-barrier-essence",
      displayNameKo: ko([0xc7a5, 0xbc29, 0x20, 0xac15, 0xd654, 0x20, 0xb7, 0x20, 0xbcf4, 0xc2b5, 0x20, 0xc5d0, 0xc13c, 0xc2a4]),
      primaryConcern: "barrier",
      secondaryConcerns: ["dryness"],
      productCategory: "essence",
      bodyArea: "face",
      sensitivityLevel: "moderate",
      prohibitedOrCautionIngredients: ["Alcohol Denat", "Menthol"],
      expectedBenefitScope: "hydrating barrier layer",
      cosmeticLimitations: "layer with moisturizer",
      dermatologistEscalationConditions: ["peeling_pain", "barrier_failure"],
      priorityArea: "dry_barrier",
    }),
    scenario({
      scenarioId: "kr-dryness-hydrating-toner",
      displayNameKo: ko([0xac74, 0xc870, 0xd568, 0x20, 0xb7, 0x20, 0xc218, 0xbd84, 0x20, 0xd1a0, 0xb108]),
      primaryConcern: "dryness",
      secondaryConcerns: ["barrier"],
      productCategory: "toner",
      bodyArea: "face",
      sensitivityLevel: "low",
      prohibitedOrCautionIngredients: ["Alcohol Denat", "Astringents"],
      expectedBenefitScope: "hydration prep step",
      cosmeticLimitations: "not a standalone moisturizer",
      dermatologistEscalationConditions: ["severe_tightness", "fissures"],
      priorityArea: "dry_barrier",
    }),
    scenario({
      scenarioId: "kr-dryness-cream-moderate",
      displayNameKo: ko([0xc911, 0xac74, 0xc131, 0x20, 0xb7, 0x20, 0xb370, 0xc77c, 0xb9ac, 0x20, 0xd06c, 0xb9bc]),
      primaryConcern: "dryness",
      secondaryConcerns: ["sensitivity"],
      productCategory: "moisturizer",
      bodyArea: "face",
      sensitivityLevel: "moderate",
      prohibitedOrCautionIngredients: ["Heavy Fragrance", "Essential Oils"],
      expectedBenefitScope: "daily moisture balance",
      cosmeticLimitations: "adjust for climate",
      dermatologistEscalationConditions: ["no_improvement_4_weeks"],
      priorityArea: "dry_barrier",
    }),
    scenario({
      scenarioId: "kr-dryness-mask",
      displayNameKo: ko([0xac74, 0xc870, 0xb7, 0xb2f9, 0xae40, 0x20, 0xb7, 0x20, 0xc218, 0xbd84, 0x20, 0xb9c8, 0xc2a4, 0xd06c]),
      primaryConcern: "dryness",
      secondaryConcerns: ["barrier"],
      productCategory: "mask",
      bodyArea: "face",
      sensitivityLevel: "low",
      prohibitedOrCautionIngredients: ["Fragrance", "Strong Acids"],
      expectedBenefitScope: "intensive hydration mask",
      cosmeticLimitations: "1-2x weekly max",
      dermatologistEscalationConditions: ["mask_burn", "allergic_reaction"],
      priorityArea: "dry_barrier",
    }),

    // acne_sebum (5)
    scenario({
      scenarioId: "kr-acne-sebum-cleanser",
      displayNameKo: ko([0xc5ec, 0xb4dc, 0xb7, 0xd53c, 0xc9c0, 0x20, 0xb7, 0x20, 0xd074, 0xb818, 0xc800]),
      primaryConcern: "acne",
      secondaryConcerns: ["pores"],
      productCategory: "cleanser",
      bodyArea: "face",
      sensitivityLevel: "moderate",
      prohibitedOrCautionIngredients: ["Heavy Oils", "Comedogenic Waxes"],
      expectedBenefitScope: "oil control cleanse",
      cosmeticLimitations: "not antibiotic substitute",
      dermatologistEscalationConditions: ["cystic_acne", "nodular_pain"],
      priorityArea: "acne_sebum",
    }),
    scenario({
      scenarioId: "kr-acne-spot-treatment",
      displayNameKo: ko([0xd2b8, 0xb7ec, 0xbe14, 0x20, 0xb7, 0x20, 0xc2a4, 0xd32f, 0x20, 0xcf00, 0xc5b4]),
      primaryConcern: "acne",
      secondaryConcerns: ["pores"],
      productCategory: "spot_treatment",
      bodyArea: "face",
      sensitivityLevel: "moderate",
      prohibitedOrCautionIngredients: ["Undiluted Essential Oils"],
      expectedBenefitScope: "localized blemish care",
      cosmeticLimitations: "spot use only",
      dermatologistEscalationConditions: ["deep_cyst", "spreading_infection"],
      priorityArea: "acne_sebum",
    }),
    scenario({
      scenarioId: "kr-acne-serum",
      displayNameKo: ko([0xc5ec, 0xb4dc, 0xb7, 0x20, 0xc138, 0xb7, 0xbc]),
      primaryConcern: "acne",
      secondaryConcerns: ["pores", "pigmentation"],
      productCategory: "serum",
      bodyArea: "face",
      sensitivityLevel: "moderate",
      prohibitedOrCautionIngredients: ["Heavy Silicones", "Fragrance"],
      expectedBenefitScope: "blemish control serum",
      cosmeticLimitations: "introduce gradually",
      dermatologistEscalationConditions: ["severe_inflammatory_acne"],
      priorityArea: "acne_sebum",
    }),
    scenario({
      scenarioId: "kr-acne-pores-toner",
      displayNameKo: ko([0xbaa8, 0xacf5, 0xb7, 0xd53c, 0xc9c0, 0x20, 0xb7, 0x20, 0xd1a0, 0xb108]),
      primaryConcern: "pores",
      secondaryConcerns: ["acne"],
      productCategory: "toner",
      bodyArea: "face",
      sensitivityLevel: "moderate",
      prohibitedOrCautionIngredients: ["High Alcohol", "Aggressive Acids"],
      expectedBenefitScope: "pore refining prep",
      cosmeticLimitations: "cannot shrink pores permanently",
      dermatologistEscalationConditions: ["toner_burn", "breakout_worsening"],
      priorityArea: "acne_sebum",
    }),
    scenario({
      scenarioId: "kr-acne-mattifying-emulsion",
      displayNameKo: ko([0xc720, 0xbd84, 0xb7, 0xd2b8, 0xb7ec, 0xbe14, 0x20, 0xb7, 0x20, 0xc5d0, 0xba54, 0xb860]),
      primaryConcern: "acne",
      secondaryConcerns: ["pores"],
      productCategory: "emulsion",
      bodyArea: "face",
      sensitivityLevel: "low",
      prohibitedOrCautionIngredients: ["Heavy Oils", "Coconut Oil"],
      expectedBenefitScope: "light sebum balance",
      cosmeticLimitations: "not for very dry skin",
      dermatologistEscalationConditions: ["dehydrated_oily_combo"],
      priorityArea: "acne_sebum",
    }),

    // uv_suncare (5)
    scenario({
      scenarioId: "kr-uv-sunscreen-face",
      displayNameKo: ko([0xc5bc, 0xad74, 0x20, 0xb7, 0x20, 0xb370, 0xc77c, 0xb9ac, 0x20, 0xc120, 0xd06c, 0xd06c, 0xb9bc]),
      primaryConcern: "uv",
      secondaryConcerns: ["pigmentation", "antiaging"],
      productCategory: "sunscreen",
      bodyArea: "face",
      sensitivityLevel: "moderate",
      prohibitedOrCautionIngredients: ["Known Photoallergens"],
      expectedBenefitScope: "daily UV protection",
      cosmeticLimitations: "reapply outdoors",
      dermatologistEscalationConditions: ["sunburn_blister", "mole_change"],
      priorityArea: "uv_suncare",
    }),
    scenario({
      scenarioId: "kr-uv-sunscreen-sensitive",
      displayNameKo: ko([0xbbfc, 0xac10, 0x20, 0xd53c, 0xbd80, 0x20, 0xb7, 0x20, 0xc21c, 0xd55c, 0x20, 0xc120, 0xd06c, 0xd06c, 0xb9bc]),
      primaryConcern: "uv",
      secondaryConcerns: ["sensitivity", "redness"],
      productCategory: "sunscreen",
      bodyArea: "face",
      sensitivityLevel: "high",
      prohibitedOrCautionIngredients: ["Fragrance", "Alcohol Denat", "Chemical Filters if stinging"],
      expectedBenefitScope: "gentle UV shield",
      cosmeticLimitations: "patch test recommended",
      dermatologistEscalationConditions: ["spf_sting", "photo_dermatitis"],
      priorityArea: "uv_suncare",
    }),
    scenario({
      scenarioId: "kr-uv-antiaging-sunscreen",
      displayNameKo: ko([0xad11, 0xb178, 0xd654, 0x20, 0xb7, 0x20, 0x53, 0x50, 0x46, 0x20, 0xcf00, 0xc5b4]),
      primaryConcern: "uv",
      secondaryConcerns: ["antiaging", "pigmentation"],
      productCategory: "sunscreen",
      bodyArea: "face",
      sensitivityLevel: "low",
      prohibitedOrCautionIngredients: ["Tanning Accelerators"],
      expectedBenefitScope: "photoaging prevention",
      cosmeticLimitations: "SPF not anti-wrinkle treatment alone",
      dermatologistEscalationConditions: ["rapid_pigment_spread"],
      priorityArea: "uv_suncare",
    }),
    scenario({
      scenarioId: "kr-dryness-hydrating-sunscreen",
      displayNameKo: ko([0xac74, 0xc870, 0x20, 0xd53c, 0xbd80, 0x20, 0xb7, 0x20, 0xbcf4, 0xc2b5, 0x20, 0xc120, 0xd06c, 0xd06c, 0xb9bc]),
      primaryConcern: "uv",
      secondaryConcerns: ["dryness", "barrier"],
      productCategory: "sunscreen",
      bodyArea: "face",
      sensitivityLevel: "moderate",
      prohibitedOrCautionIngredients: ["Mattifying Powders", "High Alcohol"],
      expectedBenefitScope: "moisturizing SPF",
      cosmeticLimitations: "may feel rich for oily skin",
      dermatologistEscalationConditions: ["spf_dryness_cracks"],
      priorityArea: "uv_suncare",
    }),
    scenario({
      scenarioId: "kr-uv-mist-spf",
      displayNameKo: ko([0xc57c, 0xc678, 0x20, 0xb7, 0x20, 0xc120, 0x20, 0xbbf8, 0xc2a4, 0xd2b8]),
      primaryConcern: "uv",
      secondaryConcerns: ["pigmentation"],
      productCategory: "mist",
      bodyArea: "face",
      sensitivityLevel: "low",
      prohibitedOrCautionIngredients: ["Inhalation Irritants"],
      expectedBenefitScope: "SPF touch-up mist",
      cosmeticLimitations: "not primary sunscreen alone",
      dermatologistEscalationConditions: ["outdoor_burn_despite_mist"],
      priorityArea: "uv_suncare",
    }),

    // aging_firmness (5)
    scenario({
      scenarioId: "kr-aging-firmness-serum",
      displayNameKo: ko([0xd0c4, 0xb825, 0x20, 0xb7, 0x20, 0xc548, 0xd2f0, 0xc5d0, 0xc774, 0xc9d5, 0x20, 0xc138, 0xb7, 0xbc]),
      primaryConcern: "antiaging",
      secondaryConcerns: ["dryness", "pigmentation"],
      productCategory: "serum",
      bodyArea: "face",
      sensitivityLevel: "moderate",
      prohibitedOrCautionIngredients: ["High Retinol without tolerance"],
      expectedBenefitScope: "firmness support serum",
      cosmeticLimitations: "gradual results only",
      dermatologistEscalationConditions: ["retinol_burn", "sudden_sagging"],
      priorityArea: "aging_firmness",
    }),
    scenario({
      scenarioId: "kr-aging-firmness-ampoule",
      displayNameKo: ko([0xc8fc, 0xb984, 0xb7, 0xd0c4, 0xb825, 0x20, 0xb7, 0x20, 0xc555, 0xd50c]),
      primaryConcern: "antiaging",
      secondaryConcerns: ["dryness"],
      productCategory: "ampoule",
      bodyArea: "face",
      sensitivityLevel: "moderate",
      prohibitedOrCautionIngredients: ["Undiluted Acids"],
      expectedBenefitScope: "intensive firming ampoule",
      cosmeticLimitations: "course not cure",
      dermatologistEscalationConditions: ["ampoule_irritation"],
      priorityArea: "aging_firmness",
    }),
    scenario({
      scenarioId: "kr-aging-eye-cream",
      displayNameKo: ko([0xb208, 0xac00, 0x20, 0xb7, 0x20, 0xc544, 0xc774, 0xd06c, 0xb9bc]),
      primaryConcern: "antiaging",
      secondaryConcerns: ["dryness"],
      productCategory: "eye_cream",
      bodyArea: "eye_area",
      sensitivityLevel: "high",
      prohibitedOrCautionIngredients: ["Retinol high dose", "Fragrance"],
      expectedBenefitScope: "eye area moisture and fine lines",
      cosmeticLimitations: "avoid eye mucosa",
      dermatologistEscalationConditions: ["eye_swelling", "vision_changes"],
      priorityArea: "aging_firmness",
    }),
    scenario({
      scenarioId: "kr-aging-neck-cream",
      displayNameKo: ko([0xbAA9, 0xc8fc, 0xb984, 0x20, 0xb7, 0x20, 0xd06c, 0xb9bc]),
      primaryConcern: "antiaging",
      secondaryConcerns: ["dryness"],
      productCategory: "cream",
      bodyArea: "neck",
      sensitivityLevel: "moderate",
      prohibitedOrCautionIngredients: ["Heavy Fragrance"],
      expectedBenefitScope: "neck line moisture",
      cosmeticLimitations: "cannot reverse deep bands alone",
      dermatologistEscalationConditions: ["neck_rash", "rapid_texture_change"],
      priorityArea: "aging_firmness",
    }),
    scenario({
      scenarioId: "kr-aging-essence",
      displayNameKo: ko([0xb178, 0xd654, 0xb29c, 0xc9c0, 0x20, 0xb7, 0x20, 0xc5d0, 0xc13c, 0xc2a4]),
      primaryConcern: "antiaging",
      secondaryConcerns: ["pigmentation", "dryness"],
      productCategory: "essence",
      bodyArea: "face",
      sensitivityLevel: "low",
      prohibitedOrCautionIngredients: ["Aggressive Peels"],
      expectedBenefitScope: "antiaging hydration base",
      cosmeticLimitations: "combine with SPF",
      dermatologistEscalationConditions: ["essence_sting"],
      priorityArea: "aging_firmness",
    }),

    // eye_neck (5)
    scenario({
      scenarioId: "kr-eye-wrinkle-cream",
      displayNameKo: ko([0xb208, 0xac00, 0x20, 0xc8fc, 0xb984, 0x20, 0xb7, 0x20, 0xc544, 0xc774, 0xd06c, 0xb9bc]),
      primaryConcern: "antiaging",
      secondaryConcerns: ["dryness", "sensitivity"],
      productCategory: "eye_cream",
      bodyArea: "eye_area",
      sensitivityLevel: "high",
      prohibitedOrCautionIngredients: ["Fragrance", "Strong Retinoids"],
      expectedBenefitScope: "eye wrinkle moisture",
      cosmeticLimitations: "pea-sized amount only",
      dermatologistEscalationConditions: ["milialar_reaction", "eye_puffiness_severe"],
      priorityArea: "eye_neck",
    }),
    scenario({
      scenarioId: "kr-eye-dark-circle-serum",
      displayNameKo: ko([0xb2e4, 0xd06c, 0xc11c, 0xd074, 0x20, 0xb7, 0x20, 0xc544, 0xc774, 0x20, 0xc138, 0xb7, 0xbc]),
      primaryConcern: "pigmentation",
      secondaryConcerns: ["antiaging"],
      productCategory: "serum",
      bodyArea: "eye_area",
      sensitivityLevel: "high",
      prohibitedOrCautionIngredients: ["High Vitamin C without buffer"],
      expectedBenefitScope: "under-eye tone assist",
      cosmeticLimitations: "genetic circles limited effect",
      dermatologistEscalationConditions: ["hyperpigment_spread"],
      priorityArea: "eye_neck",
    }),
    scenario({
      scenarioId: "kr-neck-firming-cream",
      displayNameKo: ko([0xbAA9, 0x20, 0xb7, 0x20, 0xd0c4, 0xb825, 0x20, 0xd06c, 0xb9bc]),
      primaryConcern: "antiaging",
      secondaryConcerns: ["dryness"],
      productCategory: "cream",
      bodyArea: "neck",
      sensitivityLevel: "moderate",
      prohibitedOrCautionIngredients: ["Heavy Fragrance"],
      expectedBenefitScope: "neck firming moisture",
      cosmeticLimitations: "massage gently upward",
      dermatologistEscalationConditions: ["neck_dermatitis"],
      priorityArea: "eye_neck",
    }),
    scenario({
      scenarioId: "kr-neck-serum",
      displayNameKo: ko([0xbAA9, 0xc8fc, 0xb984, 0x20, 0xb7, 0x20, 0xc138, 0xb7, 0xbc]),
      primaryConcern: "antiaging",
      secondaryConcerns: ["dryness"],
      productCategory: "serum",
      bodyArea: "neck",
      sensitivityLevel: "moderate",
      prohibitedOrCautionIngredients: ["Undiluted Acids"],
      expectedBenefitScope: "neck line serum",
      cosmeticLimitations: "layer with cream",
      dermatologistEscalationConditions: ["serum_irritation_neck"],
      priorityArea: "eye_neck",
    }),
    scenario({
      scenarioId: "kr-eye-neck-multi-cream",
      displayNameKo: ko([0xb208, 0xac00, 0xb7, 0xbAA9, 0x20, 0xb7, 0x20, 0xba40, 0xd2f0, 0x20, 0xd06c, 0xb9bc]),
      primaryConcern: "antiaging",
      secondaryConcerns: ["dryness", "sensitivity"],
      productCategory: "cream",
      bodyArea: "eye_area",
      sensitivityLevel: "high",
      prohibitedOrCautionIngredients: ["Fragrance", "Essential Oils"],
      expectedBenefitScope: "eye and neck dual care",
      cosmeticLimitations: "avoid direct eye contact",
      dermatologistEscalationConditions: ["multi_area_irritation"],
      priorityArea: "eye_neck",
    }),
  ];
}

function writeUtf8(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function generateKrCoreScenariosTs() {
  return `import raw from "./krCoreScenarios.json";
import type { RecommendationScenario } from "./types";

/** Curated KR recommendation scenarios (generated). Not a Cartesian product. */
export const KR_CORE_SCENARIOS: readonly RecommendationScenario[] =
  raw as RecommendationScenario[];

export function getScenarioById(
  scenarioId: string
): RecommendationScenario | undefined {
  return KR_CORE_SCENARIOS.find((s) => s.scenarioId === scenarioId);
}

export function listActiveKrScenarios(): RecommendationScenario[] {
  return KR_CORE_SCENARIOS.filter((s) => s.status === "active");
}
`;
}

function generateMatchScenarioTs() {
  return `import { toCanonicalConcern } from "../concernAliases";
import { KR_CORE_SCENARIOS } from "./krCoreScenarios";
import type { RecommendationScenario, ScenarioMatchInput } from "./types";

const BLOCKED_MANAGEMENT_LEVELS = new Set(["expert_first", "urgent_check"]);

export function isPoolEntryBlockedByManagementLevel(
  managementLevel?: string | null
): boolean {
  if (!managementLevel) return false;
  return BLOCKED_MANAGEMENT_LEVELS.has(managementLevel.trim());
}

function normalizeCategory(value?: string | null): string | null {
  if (!value) return null;
  const t = value.trim().toLowerCase();
  return t || null;
}

function normalizeBodyArea(value?: string | null): string {
  const t = (value ?? "face").trim().toLowerCase();
  return t || "face";
}

function normalizeSensitivity(
  value?: ScenarioMatchInput["sensitivityLevel"]
): string {
  const t = (value ?? "moderate").toString().trim().toLowerCase();
  if (t === "low" || t === "moderate" || t === "high") return t;
  return "moderate";
}

/**
 * Match a curated scenario by primaryConcern + productCategory + sensitivity + bodyArea.
 * Does NOT enumerate a Cartesian product of all axes.
 */
export function matchScenario(
  input: ScenarioMatchInput,
  scenarios: readonly RecommendationScenario[] = KR_CORE_SCENARIOS
): RecommendationScenario | null {
  if (isPoolEntryBlockedByManagementLevel(input.managementLevel)) {
    return null;
  }

  const concern = toCanonicalConcern(input.primaryConcern);
  if (!concern) return null;

  const category = normalizeCategory(input.productCategory);
  const bodyArea = normalizeBodyArea(input.bodyArea);
  const sensitivity = normalizeSensitivity(input.sensitivityLevel);

  for (const scenario of scenarios) {
    if (scenario.status !== "active") continue;
    if (scenario.primaryConcern !== concern) continue;
    if (category && scenario.productCategory !== category) continue;
    if (scenario.bodyArea !== bodyArea) continue;
    if (scenario.sensitivityLevel !== sensitivity) continue;
    return scenario;
  }

  return null;
}

export function matchScenarioOrFallback(
  input: ScenarioMatchInput,
  scenarios: readonly RecommendationScenario[] = KR_CORE_SCENARIOS
): RecommendationScenario | null {
  const exact = matchScenario(input, scenarios);
  if (exact) return exact;

  if (isPoolEntryBlockedByManagementLevel(input.managementLevel)) {
    return null;
  }

  const concern = toCanonicalConcern(input.primaryConcern);
  if (!concern) return null;
  const category = normalizeCategory(input.productCategory);
  const bodyArea = normalizeBodyArea(input.bodyArea);

  return (
    scenarios.find(
      (s) =>
        s.status === "active" &&
        s.primaryConcern === concern &&
        (!category || s.productCategory === category) &&
        s.bodyArea === bodyArea
    ) ?? null
  );
}
`;
}

function generateRankingModifiersTs() {
  return `import type { ScenarioRankingModifiers } from "./types";

export type RankableCandidate = {
  id: string;
  brand: string;
  price?: number | null;
  stockKnownInStock?: boolean;
  matchedAvoidIngredients?: string[];
  score: number;
};

/**
 * User axes re-rank within an existing scenario pool only.
 * They never create a new candidate pool.
 */
export function applyScenarioRankingModifiers<T extends RankableCandidate>(
  ranked: readonly T[],
  modifiers: ScenarioRankingModifiers = {}
): T[] {
  const avoid = new Set(
    (modifiers.avoidIngredients ?? [])
      .concat(modifiers.allergies ?? [])
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
  );

  const preferInStock =
    modifiers.purchaseAvailability === "in_stock_preferred";

  const scored = ranked.map((item) => {
    let delta = 0;

    if (preferInStock && item.stockKnownInStock === false) {
      delta -= 25;
    }
    if (preferInStock && item.stockKnownInStock === true) {
      delta += 5;
    }

    const hits = (item.matchedAvoidIngredients ?? []).filter((ing) =>
      avoid.has(ing.toLowerCase())
    );
    if (hits.length > 0) {
      delta -= 40 * hits.length;
    }

    if (modifiers.budgetRange === "low" && typeof item.price === "number") {
      delta += item.price <= 30000 ? 8 : -8;
    }
    if (modifiers.budgetRange === "high" && typeof item.price === "number") {
      delta += item.price >= 50000 ? 8 : 0;
    }

    return { item, adjusted: item.score + delta };
  });

  scored.sort((a, b) => b.adjusted - a.adjusted || b.item.score - a.item.score);
  return scored.map((row) => row.item);
}

export function rankingModifiersChangePool(): false {
  return false;
}
`;
}

function generatePoolRulesTs() {
  return `import {
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
`;
}

function generateGapAnalysisTs() {
  return `import { toCanonicalConcern } from "../concernAliases";
import { KR_CORE_SCENARIOS } from "./krCoreScenarios";
import type {
  ProductReadinessState,
  RecommendationScenario,
} from "./types";

export type BackupProductRow = {
  id?: number | string;
  active?: boolean | null;
  brand?: string | null;
  category?: string | null;
  verified_at?: string | null;
  full_ingredients?: string[] | null;
  key_ingredients?: string[] | null;
  skin_concern?: string | string[] | null;
  usage_area?: string | null;
  name?: string | null;
};

export type CatalogGapEvidence = {
  imageUnknown: boolean;
  offerUnknown: boolean;
  minOffersMet: boolean;
};

export type ScenarioCatalogGap = {
  scenarioId: string;
  priorityArea: RecommendationScenario["priorityArea"];
  matchedProductIds: string[];
  recommendationReadyCount: number;
  evidenceGaps: string[];
};

const INGREDIENT_CONCERN_HINTS: Readonly<Record<string, string[]>> = {
  niacinamide: ["redness", "pigmentation", "pores"],
  panthenol: ["redness", "dryness", "barrier"],
  centella: ["redness", "sensitivity", "barrier"],
  "snail secretion filtrate": ["dryness", "barrier"],
  "hyaluronic acid": ["dryness", "barrier"],
  "sodium hyaluronate": ["dryness", "barrier"],
  "salicylic acid": ["acne", "pores"],
  retinol: ["antiaging", "acne"],
  "ascorbic acid": ["pigmentation", "antiaging"],
  peptides: ["antiaging"],
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function inferConcernsFromProduct(row: BackupProductRow): string[] {
  const out = new Set<string>();

  const rawConcern = row.skin_concern;
  if (Array.isArray(rawConcern)) {
    for (const c of rawConcern) {
      const canon = toCanonicalConcern(c);
      if (canon) out.add(canon);
    }
  } else if (typeof rawConcern === "string") {
    const canon = toCanonicalConcern(rawConcern);
    if (canon) out.add(canon);
  }

  const ingredients = [
    ...(row.full_ingredients ?? []),
    ...(row.key_ingredients ?? []),
  ];
  for (const ing of ingredients) {
    const key = normalizeToken(ing);
    for (const [hint, concerns] of Object.entries(INGREDIENT_CONCERN_HINTS)) {
      if (key.includes(hint)) {
        for (const c of concerns) out.add(c);
      }
    }
  }

  const category = normalizeToken(row.category ?? "");
  if (category === "sunscreen") out.add("uv");
  if (category === "eye_cream") out.add("antiaging");

  return [...out];
}

function mapUsageArea(value?: string | null): string {
  const t = normalizeToken(value ?? "face");
  if (t.includes("eye")) return "eye_area";
  if (t.includes("neck")) return "neck";
  return t || "face";
}

export function estimateProductReadiness(
  row: BackupProductRow,
  offerCount = 0
): { state: ProductReadinessState; evidence: CatalogGapEvidence } {
  const ingredients = row.full_ingredients ?? [];
  const hasCategory = Boolean(row.category && row.category.trim());
  const active = row.active === true;
  const verified = Boolean(row.verified_at);

  const evidence: CatalogGapEvidence = {
    imageUnknown: true,
    offerUnknown: offerCount === 0,
    minOffersMet: offerCount >= 1,
  };

  const gaps: string[] = [];
  if (evidence.imageUnknown) gaps.push("image_unverified_in_backup");
  if (evidence.offerUnknown) gaps.push("offer_count_unknown_or_zero");

  if (!active) {
    return { state: "unavailable", evidence };
  }
  if (!verified) {
    return { state: "review_required", evidence };
  }
  if (!hasCategory) {
    return { state: "catalog_ready", evidence };
  }
  if (ingredients.length < 5) {
    return { state: "ingredient_candidate", evidence };
  }

  if (evidence.imageUnknown || !evidence.minOffersMet) {
    return { state: "review_required", evidence };
  }

  return { state: "recommendation_ready", evidence };
}

export function mapProductToScenarioIds(row: BackupProductRow): string[] {
  const concerns = inferConcernsFromProduct(row);
  const category = normalizeToken(row.category ?? "");
  const bodyArea = mapUsageArea(row.usage_area);

  const ids: string[] = [];
  for (const scenario of KR_CORE_SCENARIOS) {
    if (scenario.status !== "active") continue;
    if (!concerns.includes(scenario.primaryConcern)) continue;
    if (category && scenario.productCategory !== category) continue;
    if (scenario.bodyArea !== bodyArea && bodyArea !== "face") continue;
    ids.push(scenario.scenarioId);
  }

  return ids;
}

export function analyzeScenarioCatalogGaps(
  products: readonly BackupProductRow[],
  offerCountsByProductId: Readonly<Record<string, number>> = {}
): ScenarioCatalogGap[] {
  const byScenario = new Map<string, ScenarioCatalogGap>();

  for (const scenario of KR_CORE_SCENARIOS) {
    byScenario.set(scenario.scenarioId, {
      scenarioId: scenario.scenarioId,
      priorityArea: scenario.priorityArea,
      matchedProductIds: [],
      recommendationReadyCount: 0,
      evidenceGaps: [],
    });
  }

  for (const row of products) {
    const productId = String(row.id ?? "");
    const scenarioIds = mapProductToScenarioIds(row);
    const offerCount = offerCountsByProductId[productId] ?? 0;
    const readiness = estimateProductReadiness(row, offerCount);

    for (const scenarioId of scenarioIds) {
      const entry = byScenario.get(scenarioId);
      if (!entry) continue;
      if (productId) entry.matchedProductIds.push(productId);
      if (readiness.state === "recommendation_ready") {
        entry.recommendationReadyCount += 1;
      }
      if (readiness.evidence.imageUnknown) {
        entry.evidenceGaps.push("image_unknown_from_backup");
      }
      if (readiness.evidence.offerUnknown) {
        entry.evidenceGaps.push("offer_unknown_from_backup");
      }
    }
  }

  return [...byScenario.values()].map((entry) => ({
    ...entry,
    matchedProductIds: [...new Set(entry.matchedProductIds)],
    evidenceGaps: [...new Set(entry.evidenceGaps)],
  }));
}
`;
}

function generateIndexTs() {
  return `export * from "./types";
export * from "./krCoreScenarios";
export * from "./matchScenario";
export * from "./rankingModifiers";
export * from "./poolRules";
export * from "./gapAnalysis";
`;
}

function generateSelftestTs() {
  return `import assert from "node:assert/strict";
import {
  AFFILIATE_SCORE_FORBIDDEN,
  applyBrandCap,
  checkRoleCoverage,
  DEFAULT_BRAND_CAP,
  MAX_BRAND_CAP_WITH_EVIDENCE,
  resolveBrandCap,
} from "../src/lib/recommend/scenarios/poolRules";
import { KR_CORE_SCENARIOS } from "../src/lib/recommend/scenarios/krCoreScenarios";
import {
  isPoolEntryBlockedByManagementLevel,
  matchScenario,
} from "../src/lib/recommend/scenarios/matchScenario";
import { rankingModifiersChangePool } from "../src/lib/recommend/scenarios/rankingModifiers";

function cartesianUpperBound(): number {
  return (
    9 * 14 * 6 * 3
  );
}

{
  const count = KR_CORE_SCENARIOS.length;
  assert.ok(count >= 25 && count <= 35, \`expected 25-35 scenarios, got \${count}\`);

  const ids = KR_CORE_SCENARIOS.map((s) => s.scenarioId);
  assert.equal(new Set(ids).size, ids.length, "scenario ids must be unique");

  assert.ok(count < 50, "curated set must stay under 50");
  assert.ok(count < cartesianUpperBound(), "must not be cartesian explosion");
}

{
  assert.equal(isPoolEntryBlockedByManagementLevel("urgent_check"), true);
  assert.equal(isPoolEntryBlockedByManagementLevel("expert_first"), true);
  assert.equal(isPoolEntryBlockedByManagementLevel("cosmetic_care"), false);

  const blocked = matchScenario({
    primaryConcern: "redness",
    productCategory: "cream",
    bodyArea: "face",
    sensitivityLevel: "high",
    managementLevel: "urgent_check",
  });
  assert.equal(blocked, null, "urgent_check must block pool entry");
}

{
  const matched = matchScenario({
    primaryConcern: "redness",
    productCategory: "cream",
    bodyArea: "face",
    sensitivityLevel: "high",
  });
  assert.ok(matched, "expected redness cream scenario");
  assert.equal(matched?.scenarioId, "kr-redness-sensitive-cream");
}

{
  assert.equal(DEFAULT_BRAND_CAP, 2);
  assert.equal(MAX_BRAND_CAP_WITH_EVIDENCE, 3);
  assert.equal(AFFILIATE_SCORE_FORBIDDEN, true);

  const sample = [
    { brand: "A", id: "1" },
    { brand: "A", id: "2" },
    { brand: "A", id: "3" },
    { brand: "B", id: "4" },
  ];
  const capped = applyBrandCap(sample, DEFAULT_BRAND_CAP);
  assert.equal(capped.length, 3);
  assert.equal(capped.filter((x) => x.brand === "A").length, 2);

  const scenario = KR_CORE_SCENARIOS[0];
  assert.equal(resolveBrandCap(scenario, false), 2);
  assert.equal(resolveBrandCap(scenario, true), 3);
}

{
  const weak = checkRoleCoverage(["popular"]);
  assert.equal(weak.ok, false);

  const ok = checkRoleCoverage(["popular", "safety", "value"]);
  assert.equal(ok.ok, true);
  assert.ok(ok.distinctCount >= 2);
}

assert.equal(rankingModifiersChangePool(), false);

console.log("recommendation scenario selftest: ok");
`;
}

function generateAnalyzeGapScriptTs() {
  return `/**
 * Offline catalog gap analysis against backup JSON (no network / DB writes).
 * Run: npx --yes tsx scripts/analyze-scenario-catalog-gap.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  analyzeScenarioCatalogGaps,
  type BackupProductRow,
} from "../src/lib/recommend/scenarios/gapAnalysis";

const ROOT = path.resolve(__dirname, "..");
const BACKUP_DIR = path.join(ROOT, "data", "backups", "2026-07-14-catalog");
const PRODUCTS_PATH = path.join(BACKUP_DIR, "products.json");
const OFFERS_PATH = path.join(BACKUP_DIR, "product-offers.json");

type BackupTableFile<T> = {
  rows?: T[];
};

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function buildOfferCounts(
  offers: Array<{ product_id?: number | string; active?: boolean | null }>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const offer of offers) {
    if (offer.active === false) continue;
    const key = String(offer.product_id ?? "");
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function main(): void {
  const productsFile = readJson<BackupTableFile<BackupProductRow>>(PRODUCTS_PATH);
  if (!productsFile?.rows?.length) {
    throw new Error(\`No product rows at \${PRODUCTS_PATH}\`);
  }

  const offersFile = readJson<BackupTableFile<{ product_id?: number | string; active?: boolean | null }>>(
    OFFERS_PATH
  );
  const offerCounts = offersFile?.rows
    ? buildOfferCounts(offersFile.rows)
    : {};

  const gaps = analyzeScenarioCatalogGaps(productsFile.rows, offerCounts);

  const summary = {
    productCount: productsFile.rows.length,
    offerRows: offersFile?.rows?.length ?? 0,
    scenarioCount: gaps.length,
    scenariosWithReadyProducts: gaps.filter((g) => g.recommendationReadyCount > 0)
      .length,
    gaps,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main();
`;
}

function main() {
  const scenarios = buildScenarios();
  if (scenarios.length !== 30) {
    throw new Error(`Expected 30 scenarios, got ${scenarios.length}`);
  }

  const jsonPath = path.join(SCENARIOS_DIR, "krCoreScenarios.json");
  writeUtf8(jsonPath, `${JSON.stringify(scenarios, null, 2)}\n`);

  const files = [
    [path.join(SCENARIOS_DIR, "krCoreScenarios.ts"), generateKrCoreScenariosTs()],
    [path.join(SCENARIOS_DIR, "matchScenario.ts"), generateMatchScenarioTs()],
    [path.join(SCENARIOS_DIR, "rankingModifiers.ts"), generateRankingModifiersTs()],
    [path.join(SCENARIOS_DIR, "poolRules.ts"), generatePoolRulesTs()],
    [path.join(SCENARIOS_DIR, "gapAnalysis.ts"), generateGapAnalysisTs()],
    [path.join(SCENARIOS_DIR, "index.ts"), generateIndexTs()],
    [
      path.join(SCRIPTS_DIR, "recommendation-scenario-selftest.ts"),
      generateSelftestTs(),
    ],
    [
      path.join(SCRIPTS_DIR, "analyze-scenario-catalog-gap.ts"),
      generateAnalyzeGapScriptTs(),
    ],
  ];

  for (const [filePath, content] of files) {
    writeUtf8(filePath, content);
  }

  console.log(
    JSON.stringify({
      ok: true,
      scenarioCount: scenarios.length,
      written: files.map(([p]) => path.relative(ROOT, p)).concat(path.relative(ROOT, jsonPath)),
    })
  );
}

if (require.main === module) {
  main();
}

module.exports = { buildScenarios, main };
