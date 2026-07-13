/**
 * Offer / product URL validation for staging (strict; no auto-promotion).
 */

import { createHash } from "node:crypto";
import type { ParsedCatalogOffer, ParsedCatalogProduct } from "./types";

const SEARCH_PATH_HINTS = [
  "/search",
  "/srp/",
  "/np/search",
  "/display/search",
  "query=",
  "keyword=",
];

const CATEGORY_PATH_HINTS = [
  "/category/",
  "/categories/",
  "/collection/",
  "/collections/",
  "/shop/list",
  "/display/category",
];

export function isHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}

export function isLikelySearchOrCategoryUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (SEARCH_PATH_HINTS.some((h) => lower.includes(h))) return true;
  if (CATEGORY_PATH_HINTS.some((h) => lower.includes(h))) return true;
  return false;
}

export function parsePriceValue(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function contentHash(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

export type OfferValidationResult = {
  ok: boolean;
  status: ParsedCatalogOffer extends never ? never : "verified" | "invalid" | "needs_review";
  errors: string[];
};

export function validateStagingOffer(
  offer: ParsedCatalogOffer,
  options?: { requireInStock?: boolean }
): { ok: boolean; status: "verified" | "invalid" | "needs_review"; errors: string[] } {
  const errors: string[] = [];
  if (!offer.retailerNameRaw?.trim()) errors.push("missing_retailer");
  if (!offer.countryCode?.trim()) errors.push("missing_country");
  if (!offer.currency?.trim()) errors.push("missing_currency");
  if (offer.price == null || !Number.isFinite(offer.price) || offer.price <= 0) {
    errors.push("price_missing_or_zero");
  }
  if (!isHttpsUrl(offer.purchaseUrl)) errors.push("non_https_url");
  if (isLikelySearchOrCategoryUrl(offer.purchaseUrl)) {
    errors.push("search_or_category_url");
  }
  if (offer.membershipRequired) errors.push("membership_price");
  if (offer.couponRequired) errors.push("coupon_price");
  if (offer.inStock == null && options?.requireInStock !== false) {
    errors.push("stock_unknown");
  }
  if (offer.inStock === false) errors.push("out_of_stock");
  if (!offer.sourceVerified) errors.push("source_unverified");

  if (errors.includes("search_or_category_url") || errors.includes("non_https_url")) {
    return { ok: false, status: "invalid", errors };
  }
  if (errors.length === 0) return { ok: true, status: "verified", errors };
  if (errors.includes("price_missing_or_zero")) {
    return { ok: false, status: "invalid", errors };
  }
  return { ok: false, status: "needs_review", errors };
}

export function validateStagingProduct(product: ParsedCatalogProduct): {
  ok: boolean;
  status: "source_verified" | "needs_review" | "parsed";
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!product.brandRaw?.trim()) errors.push("missing_brand");
  if (!product.productNameRaw?.trim()) errors.push("missing_product_name");
  if (!product.officialProductUrl) errors.push("missing_official_url");
  else if (!isHttpsUrl(product.officialProductUrl)) errors.push("official_url_not_https");
  else if (isLikelySearchOrCategoryUrl(product.officialProductUrl)) {
    errors.push("official_url_is_search_or_category");
  }
  if (!product.categoryCanonical && !product.categoryRaw) {
    warnings.push("missing_category");
  }
  if (!product.imageUrls.length) warnings.push("missing_image");

  if (errors.length) {
    return { ok: false, status: "needs_review", errors, warnings };
  }
  if (product.sourceTier === 1 && product.officialProductUrl) {
    return { ok: true, status: "source_verified", errors, warnings };
  }
  return { ok: true, status: "parsed", errors, warnings };
}

export function normalizeCategoryAlias(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase().replace(/[\s\-]+/g, "_");
  const map: Record<string, string> = {
    cleanser: "cleanser",
    toner: "toner",
    essence: "essence",
    serum: "serum",
    ampoule: "ampoule",
    cream: "cream",
    lotion: "lotion",
    sunscreen: "sunscreen",
    sun_stick: "sun_stick",
    sunstick: "sun_stick",
    lip_balm: "lip_balm",
    lipbalm: "lip_balm",
    lipstick: "lipstick",
    lip_tint: "lip_tint",
    liptint: "lip_tint",
    foundation: "foundation",
    cushion: "cushion",
    mascara: "mascara",
    mask: "mask",
  };
  return map[t] ?? t;
}

export function parseSpfFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/\bSPF\s*(\d{1,2})\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}
