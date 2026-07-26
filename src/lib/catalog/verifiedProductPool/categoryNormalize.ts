/**
 * Category-specific normalization for verified pool expansion (P3-T02).
 * Covers skincare · makeup · hair/scalp · body · lip/eye.
 * Heuristic classification only — never invents INCI, price, or claims.
 */

import type {
  CategoryNormalizedFields,
  VerifiedPoolCategory,
  VerifiedPoolRawRecord,
} from "./types";

function normalizeText(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[()[\]{}]/g, "")
    .toLowerCase();
}

function normalizeVolume(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const compact = value.trim().toLowerCase().replace(/\s+/g, "");
  const m = compact.match(/^(\d+(?:\.\d+)?)(ml|g|oz|mg)?$/);
  if (!m) return compact;
  return `${m[1]}${m[2] ?? ""}`;
}

/**
 * Map raw category hints into one of the five pool categories.
 * Returns null when unsupported (nail/fragrance/device/tool etc.).
 */
export function resolvePoolCategory(
  categoryHint: string | null | undefined,
): VerifiedPoolCategory | null {
  const c = String(categoryHint ?? "").toLowerCase().trim();
  if (!c) return null;

  if (
    /serum|cream|toner|essence|ampoule|moisturizer|cleanser|skincare|마스크|세럼|크림|토너|앰플/.test(
      c,
    ) ||
    c === "face_skincare" ||
    c === "sun_care"
  ) {
    return "skincare";
  }

  if (
    /mascara|eyeliner|eyeshadow|lip_tint|lipstick|lip_gloss|lip_balm|lip|eye_makeup|립|마스카라|아이/.test(
      c,
    ) ||
    c === "lip_color" ||
    c === "lip_care" ||
    c === "eye_makeup"
  ) {
    return "lip_eye";
  }

  if (
    /cushion|foundation|bb|cc|base_makeup|concealer|프라이머|쿠션|파운데이션/.test(
      c,
    ) ||
    c === "base_makeup" ||
    c === "color_makeup" ||
    c === "makeup"
  ) {
    return "makeup";
  }

  if (
    /shampoo|scalp|conditioner|hair|두피|샴푸|헤어/.test(c) ||
    c === "scalp_care" ||
    c === "hair_care" ||
    c === "hair_scalp"
  ) {
    return "hair_scalp";
  }

  if (/body|lotion|wash|바디|로션/.test(c) || c === "body_care") {
    return "body";
  }

  return null;
}

export function normalizeCategoryFields(
  raw: VerifiedPoolRawRecord,
  poolCategory: VerifiedPoolCategory,
): CategoryNormalizedFields {
  const hint = raw.categoryHint?.trim() || null;
  return {
    poolCategory,
    canonicalCategory: hint ?? poolCategory,
    brandNormalized: normalizeText(raw.brandName),
    productNameNormalized: normalizeText(raw.productNameKo ?? raw.productNameEn),
    volumeNormalized: normalizeVolume(raw.volumeLabel),
    shadeOrColor: normalizeText(raw.shadeOrColor ?? null),
    finish: normalizeText(raw.finish ?? null),
    scalpOrHairHint:
      poolCategory === "hair_scalp"
        ? normalizeText(raw.scalpOrHairHint ?? hint)
        : null,
    bodyAreaHint:
      poolCategory === "body" ? normalizeText(raw.bodyAreaHint ?? hint) : null,
    eyeOrLipHint:
      poolCategory === "lip_eye"
        ? normalizeText(raw.eyeOrLipHint ?? hint)
        : null,
    makeupFamily:
      poolCategory === "makeup"
        ? normalizeText(raw.makeupFamily ?? hint)
        : null,
    rawCategoryHint: hint,
  };
}
