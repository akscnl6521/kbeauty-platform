/**
 * Scalp/hair ingredient evidence candidates (not diagnoses, not concentration).
 */

export type ScalpHairIngredientFunction =
  | "cleansing"
  | "scalp_soothing"
  | "sebum_control_support"
  | "moisturizing"
  | "conditioning"
  | "anti_dandruff_active"
  | "exfoliating"
  | "film_forming"
  | "color_protection"
  | "breakage_support"
  | "volume_appearance"
  | "fragrance"
  | "cooling_agent"
  | "other";

export type ScalpHairIngredientHint = {
  canonicalKey: string;
  functions: ScalpHairIngredientFunction[];
  cautionTags: string[];
  regulatoryReview: boolean;
  medicinalExclude: boolean;
};

const HINTS: ScalpHairIngredientHint[] = [
  {
    canonicalKey: "sodium_lauryl_sulfate",
    functions: ["cleansing"],
    cautionTags: ["surfactant_candidate"],
    regulatoryReview: false,
    medicinalExclude: false,
  },
  {
    canonicalKey: "sodium_laureth_sulfate",
    functions: ["cleansing"],
    cautionTags: ["surfactant_candidate"],
    regulatoryReview: false,
    medicinalExclude: false,
  },
  {
    canonicalKey: "alcohol_denat",
    functions: ["other"],
    cautionTags: ["alcohol_denat_candidate"],
    regulatoryReview: false,
    medicinalExclude: false,
  },
  {
    canonicalKey: "parfum",
    functions: ["fragrance"],
    cautionTags: ["fragrance"],
    regulatoryReview: false,
    medicinalExclude: false,
  },
  {
    canonicalKey: "menthol",
    functions: ["cooling_agent"],
    cautionTags: ["menthol"],
    regulatoryReview: false,
    medicinalExclude: false,
  },
  {
    canonicalKey: "salicylic_acid",
    functions: ["exfoliating"],
    cautionTags: ["exfoliant_caution"],
    regulatoryReview: false,
    medicinalExclude: false,
  },
  {
    canonicalKey: "piroctone_olamine",
    functions: ["anti_dandruff_active"],
    cautionTags: [],
    regulatoryReview: false,
    medicinalExclude: false,
  },
  {
    canonicalKey: "zinc_pca",
    functions: ["sebum_control_support"],
    cautionTags: [],
    regulatoryReview: false,
    medicinalExclude: false,
  },
  {
    canonicalKey: "panthenol",
    functions: ["conditioning", "scalp_soothing"],
    cautionTags: [],
    regulatoryReview: false,
    medicinalExclude: false,
  },
  {
    canonicalKey: "glycerin",
    functions: ["moisturizing"],
    cautionTags: [],
    regulatoryReview: false,
    medicinalExclude: false,
  },
  {
    canonicalKey: "betaine",
    functions: ["moisturizing"],
    cautionTags: [],
    regulatoryReview: false,
    medicinalExclude: false,
  },
  {
    canonicalKey: "ketoconazole",
    functions: ["other"],
    cautionTags: ["medicinal_candidate"],
    regulatoryReview: true,
    medicinalExclude: true,
  },
  {
    canonicalKey: "zinc_pyrithione",
    functions: ["anti_dandruff_active"],
    cautionTags: ["country_regulation_varies"],
    regulatoryReview: true,
    medicinalExclude: false,
  },
];

const BY_KEY = new Map(HINTS.map((h) => [h.canonicalKey, h]));

export function lookupScalpHairIngredientHint(
  canonicalKey: string | null | undefined
): ScalpHairIngredientHint | null {
  if (!canonicalKey) return null;
  return BY_KEY.get(canonicalKey) ?? null;
}

export function classifyScalpHairIngredientTokens(
  tokens: Array<{ canonicalKey?: string | null; ingredientRaw: string }>
): {
  surfactants: string[];
  fragranceOrMenthol: string[];
  antiDandruff: string[];
  scalpSupport: string[];
  regulatoryReview: string[];
  medicinalExclude: string[];
  unknownPreserved: string[];
} {
  const surfactants: string[] = [];
  const fragranceOrMenthol: string[] = [];
  const antiDandruff: string[] = [];
  const scalpSupport: string[] = [];
  const regulatoryReview: string[] = [];
  const medicinalExclude: string[] = [];
  const unknownPreserved: string[] = [];

  for (const t of tokens) {
    const key = t.canonicalKey ?? "";
    const hint = lookupScalpHairIngredientHint(key);
    if (!hint) {
      unknownPreserved.push(t.ingredientRaw);
      continue;
    }
    if (hint.functions.includes("cleansing")) surfactants.push(t.ingredientRaw);
    if (
      hint.functions.includes("fragrance") ||
      hint.functions.includes("cooling_agent")
    ) {
      fragranceOrMenthol.push(t.ingredientRaw);
    }
    if (hint.functions.includes("anti_dandruff_active")) {
      antiDandruff.push(t.ingredientRaw);
    }
    if (
      hint.functions.includes("scalp_soothing") ||
      hint.functions.includes("sebum_control_support") ||
      hint.functions.includes("moisturizing")
    ) {
      scalpSupport.push(t.ingredientRaw);
    }
    if (hint.regulatoryReview) regulatoryReview.push(t.ingredientRaw);
    if (hint.medicinalExclude) medicinalExclude.push(t.ingredientRaw);
  }

  return {
    surfactants,
    fragranceOrMenthol,
    antiDandruff,
    scalpSupport,
    regulatoryReview,
    medicinalExclude,
    unknownPreserved,
  };
}
