/**
 * Category-specific required / recommended fields for staging validation.
 */

import type { BeautyDomain } from "./domains";
import { beautyDomainForCategory } from "./domains";

export type FieldRequirement = "required" | "recommended" | "optional";

export type CategoryFieldSpec = {
  domain: BeautyDomain;
  fields: Record<string, FieldRequirement>;
};

const COMMON = {
  product_name: "required" as const,
  category: "required" as const,
  size: "recommended" as const,
  official_url: "required" as const,
  official_ingredients: "required" as const,
  image: "recommended" as const,
};

export function fieldSpecForCategory(
  category: string | null | undefined
): CategoryFieldSpec {
  const domain = beautyDomainForCategory(category);
  const fields: Record<string, FieldRequirement> = { ...COMMON };

  switch (domain) {
    case "sun_care":
      Object.assign(fields, {
        spf: "required",
        pa: "recommended",
        product_country: "recommended",
        uv_filters: "recommended",
        water_resistance_claim_source: "recommended",
        image: "recommended",
      });
      break;
    case "lip_care":
      Object.assign(fields, {
        clear_or_tinted: "recommended",
        spf_claim: "optional",
        image: "recommended",
      });
      break;
    case "lip_color":
    case "base_makeup":
    case "color_makeup":
    case "eye_makeup":
      Object.assign(fields, {
        shade_variants: "required",
        finish: "recommended",
        opacity_or_coverage: "recommended",
        swatch_images: "recommended",
        ingredient_scope: "required",
        image: "required",
      });
      break;
    case "scalp_care":
      Object.assign(fields, {
        scalp_type_claims: "recommended",
        cleansing_category: "recommended",
        anti_dandruff_actives: "optional",
        functional_claims: "optional",
      });
      break;
    case "hair_care":
      Object.assign(fields, {
        hair_type_concern: "recommended",
        color_safe_claim: "optional",
        heat_protection_claim: "optional",
      });
      break;
    case "body_care":
      Object.assign(fields, {
        fragrance: "optional",
        size: "required",
      });
      break;
    default:
      break;
  }

  return { domain, fields };
}

export function missingRequiredFields(
  category: string | null | undefined,
  present: Record<string, boolean>
): string[] {
  const spec = fieldSpecForCategory(category);
  const missing: string[] = [];
  for (const [field, req] of Object.entries(spec.fields)) {
    if (req === "required" && !present[field]) missing.push(field);
  }
  return missing;
}
