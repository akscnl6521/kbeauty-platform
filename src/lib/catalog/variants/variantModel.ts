/**
 * Product variant model (shade / size / scent / pack / formula).
 * Shade-specific ingredients must not be merged into a single INCI list.
 */

export type VariantType = "shade" | "size" | "scent" | "pack" | "formula";

export type IngredientScope =
  | "common"
  | "variant_specific"
  | "may_contain"
  | "unknown";

export type CatalogProductVariantDraft = {
  variantType: VariantType;
  variantKey: string;
  shadeName?: string | null;
  shadeNameKo?: string | null;
  shadeCode?: string | null;
  /** Auxiliary only — never treat as official brand color. */
  colorHex?: string | null;
  undertoneTags: string[];
  depthTags: string[];
  finish?: string | null;
  availability?: string | null;
  officialVariantUrl?: string | null;
  ingredientScope: IngredientScope;
  hasSwatchImage: boolean;
  warnings: string[];
};

export function buildVariantKey(
  type: VariantType,
  parts: { shadeCode?: string | null; shadeName?: string | null; size?: string | null }
): string {
  const raw =
    type === "size"
      ? parts.size ?? "unknown_size"
      : parts.shadeCode || parts.shadeName || "unknown_shade";
  return `${type}:${String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s\/]+/g, "_")}`;
}

export function validateShadeVariant(input: {
  shadeName?: string | null;
  shadeCode?: string | null;
  hasSwatchImage?: boolean;
  ingredientScope?: IngredientScope;
  colorHex?: string | null;
}): CatalogProductVariantDraft {
  const warnings: string[] = [];
  const shadeName = input.shadeName?.trim() || null;
  const shadeCode = input.shadeCode?.trim() || null;
  if (!shadeName && !shadeCode) {
    warnings.push("missing_shade_identity");
  }
  if (!input.hasSwatchImage) {
    warnings.push("missing_swatch_image");
  }
  if (input.colorHex && !/^#?[0-9a-fA-F]{6}$/.test(input.colorHex)) {
    warnings.push("invalid_color_hex_auxiliary");
  }
  const scope = input.ingredientScope ?? "unknown";
  if (scope === "unknown") {
    warnings.push("ingredient_scope_unknown");
  }

  return {
    variantType: "shade",
    variantKey: buildVariantKey("shade", { shadeCode, shadeName }),
    shadeName,
    shadeCode,
    colorHex: input.colorHex ?? null,
    undertoneTags: [],
    depthTags: [],
    ingredientScope: scope,
    hasSwatchImage: Boolean(input.hasSwatchImage),
    warnings,
  };
}

export function validateSizeVariant(input: {
  sizeLabel?: string | null;
  sizeValue?: number | null;
  sizeUnit?: string | null;
}): CatalogProductVariantDraft {
  const warnings: string[] = [];
  const size =
    input.sizeLabel?.trim() ||
    (input.sizeValue != null
      ? `${input.sizeValue}${input.sizeUnit ?? ""}`
      : null);
  if (!size) warnings.push("missing_size");
  return {
    variantType: "size",
    variantKey: buildVariantKey("size", { size }),
    ingredientScope: "common",
    undertoneTags: [],
    depthTags: [],
    hasSwatchImage: false,
    warnings,
  };
}

/**
 * Never merge variant-specific + may_contain into one flat INCI string.
 */
export function preserveIngredientScopes(sections: {
  common?: string[];
  variantSpecific?: string[];
  mayContain?: string[];
}): {
  common: string[];
  variantSpecific: string[];
  mayContain: string[];
  mergedForbidden: true;
} {
  return {
    common: [...(sections.common ?? [])],
    variantSpecific: [...(sections.variantSpecific ?? [])],
    mayContain: [...(sections.mayContain ?? [])],
    mergedForbidden: true,
  };
}

export function colorDomainNeedsVariants(domain: string): boolean {
  return [
    "lip_color",
    "base_makeup",
    "color_makeup",
    "eye_makeup",
    "brow_makeup",
  ].includes(domain);
}
