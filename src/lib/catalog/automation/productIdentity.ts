import type { ParsedCatalogProduct } from "./types";

export type ProductIdentity = {
  brandKey: string;
  nameKey: string;
  sizeValue: number | null;
  sizeUnit: string | null;
  gtin: string | null;
  sku: string | null;
};

export type ProductIdentityMatch =
  | { kind: "exact_duplicate"; confidence: 1; reasons: string[] }
  | { kind: "same_product_different_size"; confidence: number; reasons: string[] }
  | { kind: "renewal_suspect"; confidence: number; reasons: string[] }
  | { kind: "distinct"; confidence: number; reasons: string[] };

const NOISE_TOKENS = new Set([
  "new",
  "renewal",
  "renewed",
  "reformulated",
  "리뉴얼",
  "신형",
  "신제품",
  "공식",
  "official",
]);

const UNIT_MAP: Record<string, string> = {
  milliliter: "ml",
  milliliters: "ml",
  ml: "ml",
  gram: "g",
  grams: "g",
  g: "g",
  ounce: "oz",
  ounces: "oz",
  oz: "oz",
};

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token && !NOISE_TOKENS.has(token))
    .join(" ");
}

function normalizeIdentifier(value: string | null | undefined): string | null {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return normalized || null;
}

function normalizeSize(value: number | undefined, unit: string | undefined): {
  value: number | null;
  unit: string | null;
} {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return { value: null, unit: null };
  }
  const normalizedUnit = UNIT_MAP[normalizeText(unit)] ?? normalizeText(unit) ?? null;
  return { value: Number(value), unit: normalizedUnit || null };
}

export function buildProductIdentity(product: ParsedCatalogProduct): ProductIdentity {
  const size = normalizeSize(product.sizeValue, product.sizeUnit);
  return {
    brandKey: normalizeText(product.brandCanonical || product.brandRaw),
    nameKey: normalizeText(product.productNameEn || product.productNameKo || product.productNameRaw),
    sizeValue: size.value,
    sizeUnit: size.unit,
    gtin: normalizeIdentifier(product.gtin || product.barcode),
    sku: normalizeIdentifier(product.sku),
  };
}

function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const left = new Set(a.split(" "));
  const right = new Set(b.split(" "));
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

function sameSize(a: ProductIdentity, b: ProductIdentity): boolean {
  return (
    a.sizeValue != null &&
    b.sizeValue != null &&
    a.sizeUnit != null &&
    b.sizeUnit != null &&
    a.sizeUnit === b.sizeUnit &&
    Math.abs(a.sizeValue - b.sizeValue) < 0.001
  );
}

export function compareProductIdentity(
  leftProduct: ParsedCatalogProduct,
  rightProduct: ParsedCatalogProduct
): ProductIdentityMatch {
  const left = buildProductIdentity(leftProduct);
  const right = buildProductIdentity(rightProduct);
  const reasons: string[] = [];

  if (left.gtin && right.gtin && left.gtin === right.gtin) {
    return { kind: "exact_duplicate", confidence: 1, reasons: ["same_gtin"] };
  }
  if (left.sku && right.sku && left.sku === right.sku && left.brandKey === right.brandKey) {
    return { kind: "exact_duplicate", confidence: 1, reasons: ["same_brand_sku"] };
  }

  const brandSame = Boolean(left.brandKey && left.brandKey === right.brandKey);
  const nameSimilarity = tokenSimilarity(left.nameKey, right.nameKey);
  if (brandSame) reasons.push("same_brand");
  if (nameSimilarity >= 0.9) reasons.push("name_near_exact");
  else if (nameSimilarity >= 0.65) reasons.push("name_similar");

  if (brandSame && nameSimilarity >= 0.9 && sameSize(left, right)) {
    return {
      kind: "exact_duplicate",
      confidence: 0.98,
      reasons: [...reasons, "same_size"],
    };
  }

  if (
    brandSame &&
    nameSimilarity >= 0.9 &&
    left.sizeValue != null &&
    right.sizeValue != null &&
    left.sizeUnit === right.sizeUnit &&
    !sameSize(left, right)
  ) {
    return {
      kind: "same_product_different_size",
      confidence: 0.95,
      reasons: [...reasons, "different_size"],
    };
  }

  if (brandSame && nameSimilarity >= 0.65) {
    return {
      kind: "renewal_suspect",
      confidence: Math.min(0.94, 0.6 + nameSimilarity * 0.35),
      reasons: [...reasons, sameSize(left, right) ? "same_size" : "size_changed_or_unknown"],
    };
  }

  return {
    kind: "distinct",
    confidence: Math.max(0.5, 1 - nameSimilarity),
    reasons: brandSame ? [...reasons, "name_difference"] : ["different_brand"],
  };
}
