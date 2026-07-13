/**
 * 카탈로그 감사·신뢰 상태 (표시/관리자 전용).
 * rankProducts·matchedIngredients·점수와 완전 분리.
 */

import { getCanonicalBrandName } from "@/lib/brand/displayBrandName";
import {
  parseSizeFromProductName,
  stripTrailingSizeFromProductName,
} from "@/lib/recommend/displayProductMeta";
import { resolveDisplaySizeLabel } from "@/lib/catalog/verifiedDisplayOverrides";
import { isOfferEligibleForCoreRecommendation } from "@/lib/recommend/productOffer";
import type { ProductOffer } from "@/lib/recommend/catalogTypes";
import type { ShippingCountry } from "@/lib/recommend/selectPurchaseLink";

/** 사용자·관리자 표시용 신뢰 상태 */
export type CatalogTrustStatus =
  | "verified_ready"
  | "product_verified_no_offer"
  | "offer_pending"
  | "product_info_incomplete"
  | "manual_review"
  | "duplicate_candidate";

export type CatalogAuditProductRow = {
  id: string;
  brand: string;
  name: string;
  nameKo: string | null;
  nameJa: string | null;
  category: string | null;
  active: boolean;
  verifiedAt: string | null;
  dataConfidence: string | null;
  keyIngredients: string[];
  skinConcern: unknown;
  imageUrl: string | null;
  slug: string | null;
  sourceUrl: string | null;
};

export type CatalogAuditOfferRow = {
  id: string;
  productId: string;
  retailerName: string;
  retailerCountry: string;
  shipsToCountries: string[];
  purchaseUrl: string;
  price: number | null;
  currency: string | null;
  stockStatus: string;
  verificationStatus: string;
  isOfficial: boolean | null;
  verifiedAt: string | null;
  active: boolean | null;
};

export type CatalogProductAuditItem = {
  id: string;
  brand: string;
  displayNameKo: string;
  displayNameEn: string;
  sizeLabel: string | null;
  category: string | null;
  status: CatalogTrustStatus;
  verifiedAt: string | null;
  hasKrStrictOffer: boolean;
  hasUsStrictOffer: boolean;
  hasJpStrictOffer: boolean;
  offerCount: number;
  krPrice: number | null;
  krRetailer: string | null;
  krStock: string | null;
  reviewReasons: string[];
  eligibilityFailures: string[];
  duplicateGroupKey: string | null;
  duplicatePeerIds: string[];
  queuePriority: 1 | 2 | 3;
};

export type CatalogAuditSummary = {
  generatedAt: string;
  totalProducts: number;
  activeProducts: number;
  verifiedProducts: number;
  unverifiedProducts: number;
  missingName: number;
  missingNameKo: number;
  missingBrand: number;
  missingIngredients: number;
  missingSkinConcern: number;
  missingImage: number;
  sizeParsable: number;
  sizeUnparsable: number;
  duplicateCandidateProducts: number;
  productsWithAnyOffer: number;
  strictKrOffers: number;
  strictUsOffers: number;
  strictJpOffers: number;
  byStatus: Record<CatalogTrustStatus, number>;
  country: {
    KR: { strictOffers: number; productsWithStrict: number };
    US: { strictOffers: number; productsWithStrict: number };
    JP: { strictOffers: number; productsWithStrict: number };
  };
};

export type CatalogAuditReport = {
  summary: CatalogAuditSummary;
  products: CatalogProductAuditItem[];
  duplicateGroups: Array<{
    key: string;
    productIds: string[];
    brand: string;
    nameKey: string;
    sizeLabel: string | null;
  }>;
  offerGaps: Array<{
    productId: string;
    brand: string;
    displayNameKo: string;
    status: CatalogTrustStatus;
    priority: 1 | 2 | 3;
    reasons: string[];
  }>;
};

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeNameKey(value: string): string {
  return collapse(value)
    .toLowerCase()
    .replace(/[,.'’+%]/g, "")
    .replace(/\s+/g, "");
}

function asOffer(row: CatalogAuditOfferRow): ProductOffer {
  const country = (row.retailerCountry || "GLOBAL").toUpperCase();
  const retailerCountry =
    country === "KR" || country === "US" || country === "JP" || country === "GLOBAL"
      ? country
      : "GLOBAL";
  const ships = Array.isArray(row.shipsToCountries)
    ? row.shipsToCountries.map(String)
    : [];
  const stock = String(row.stockStatus || "unknown").toLowerCase();
  const verification = String(row.verificationStatus || "unverified").toLowerCase();
  return {
    id: String(row.id),
    productId: String(row.productId),
    retailerName: row.retailerName || "",
    retailerCountry: retailerCountry as ProductOffer["retailerCountry"],
    shipsToCountries: ships.filter((c) =>
      ["KR", "US", "JP"].includes(c.toUpperCase())
    ) as ProductOffer["shipsToCountries"],
    purchaseUrl: row.purchaseUrl || "",
    price: row.price == null ? undefined : Number(row.price),
    currency: (row.currency as ProductOffer["currency"]) || undefined,
    stockStatus:
      stock === "in_stock" || stock === "out_of_stock" || stock === "unknown"
        ? stock
        : "unknown",
    verificationStatus:
      verification === "verified" ||
      verification === "unverified" ||
      verification === "invalid" ||
      verification === "unavailable"
        ? verification
        : "unverified",
    isOfficial: row.isOfficial === true,
    verifiedAt: row.verifiedAt || undefined,
    active: row.active !== false,
  };
}

export function explainOfferEligibilityFailures(
  offer: ProductOffer,
  shippingCountry: ShippingCountry
): string[] {
  const fails: string[] = [];
  if (offer.active === false) fails.push("inactive");
  if (offer.verificationStatus !== "verified") {
    fails.push(`verification=${offer.verificationStatus}`);
  }
  if (!offer.verifiedAt?.trim()) fails.push("missing verified_at");
  if (offer.price == null || !Number.isFinite(offer.price) || offer.price <= 0) {
    fails.push("price_missing_or_zero");
  }
  if (!offer.currency) fails.push("currency_missing");
  else if (
    (shippingCountry === "KR" && offer.currency !== "KRW") ||
    (shippingCountry === "US" && offer.currency !== "USD") ||
    (shippingCountry === "JP" && offer.currency !== "JPY")
  ) {
    fails.push(`currency_mismatch=${offer.currency}`);
  }
  if (!offer.purchaseUrl?.startsWith("https://")) fails.push("non_https_url");
  if (!offer.shipsToCountries.includes(shippingCountry)) {
    fails.push(`ships_to_missing_${shippingCountry}`);
  }
  if (offer.retailerCountry !== shippingCountry) {
    fails.push(`retailer_country=${offer.retailerCountry}`);
  }
  if (shippingCountry === "KR" && offer.stockStatus !== "in_stock") {
    fails.push(`stock=${offer.stockStatus}`);
  }
  return fails;
}

function isProductInfoIncomplete(p: CatalogAuditProductRow): boolean {
  const name = collapse(p.name || "");
  const brand = collapse(p.brand || "");
  if (!name || !brand) return true;
  if (!Array.isArray(p.keyIngredients) || p.keyIngredients.length === 0) {
    return true;
  }
  return false;
}

function buildDuplicateGroups(
  products: CatalogAuditProductRow[]
): CatalogAuditReport["duplicateGroups"] {
  const map = new Map<
    string,
    { brand: string; nameKey: string; sizeLabel: string | null; ids: string[] }
  >();

  for (const p of products) {
    const brand = getCanonicalBrandName(p.brand) || collapse(p.brand);
    const nameForKey =
      stripTrailingSizeFromProductName(p.name) ||
      stripTrailingSizeFromProductName(p.nameKo) ||
      p.name;
    const size =
      parseSizeFromProductName(p.nameKo)?.label ??
      parseSizeFromProductName(p.name)?.label ??
      null;
    const key = `${normalizeNameKey(brand)}|${normalizeNameKey(nameForKey)}|${size ?? ""}`;
    const cur = map.get(key) ?? {
      brand,
      nameKey: normalizeNameKey(nameForKey),
      sizeLabel: size,
      ids: [],
    };
    cur.ids.push(String(p.id));
    map.set(key, cur);
  }

  const groups: CatalogAuditReport["duplicateGroups"] = [];
  for (const [key, g] of map) {
    if (g.ids.length < 2) continue;
    groups.push({
      key,
      productIds: g.ids,
      brand: g.brand,
      nameKey: g.nameKey,
      sizeLabel: g.sizeLabel,
    });
  }
  return groups;
}

export function catalogTrustStatusLabelKo(status: CatalogTrustStatus): string {
  switch (status) {
    case "verified_ready":
      return "제품 및 판매처 확인 완료";
    case "product_verified_no_offer":
      return "제품 정보 확인됨 · 판매처 확인 중";
    case "offer_pending":
      return "판매처 확인 중";
    case "product_info_incomplete":
      return "제품 정보 확인 중";
    case "duplicate_candidate":
      return "중복 후보(검토 필요)";
    default:
      return "제품 정보 확인 중";
  }
}

/** 사용자 화면에 노출 가능한 신뢰 문구 (manual/duplicate는 완화) */
export function catalogTrustStatusUserLabelKo(
  status: CatalogTrustStatus
): string | null {
  if (status === "verified_ready") return "제품 및 판매처 확인 완료";
  if (status === "product_verified_no_offer") {
    return "제품 정보 확인됨 · 판매처 확인 중";
  }
  if (status === "offer_pending") return "판매처 확인 중";
  if (status === "product_info_incomplete") return "제품 정보 확인 중";
  return null;
}

export function buildCatalogAuditReport(
  products: CatalogAuditProductRow[],
  offers: CatalogAuditOfferRow[]
): CatalogAuditReport {
  const offersByProduct = new Map<string, ProductOffer[]>();
  for (const raw of offers) {
    const offer = asOffer(raw);
    const list = offersByProduct.get(offer.productId) ?? [];
    list.push(offer);
    offersByProduct.set(offer.productId, list);
  }

  const duplicateGroups = buildDuplicateGroups(products);
  const dupMap = new Map<string, { key: string; peers: string[] }>();
  for (const g of duplicateGroups) {
    for (const id of g.productIds) {
      dupMap.set(id, {
        key: g.key,
        peers: g.productIds.filter((x) => x !== id),
      });
    }
  }

  let missingName = 0;
  let missingNameKo = 0;
  let missingBrand = 0;
  let missingIngredients = 0;
  let missingSkinConcern = 0;
  let missingImage = 0;
  let sizeParsable = 0;
  let verifiedProducts = 0;
  let activeProducts = 0;
  let productsWithAnyOffer = 0;
  let strictKrOffers = 0;
  let strictUsOffers = 0;
  let strictJpOffers = 0;
  const productsWithStrict = { KR: new Set<string>(), US: new Set<string>(), JP: new Set<string>() };

  const byStatus: Record<CatalogTrustStatus, number> = {
    verified_ready: 0,
    product_verified_no_offer: 0,
    offer_pending: 0,
    product_info_incomplete: 0,
    manual_review: 0,
    duplicate_candidate: 0,
  };

  const audited: CatalogProductAuditItem[] = [];

  for (const p of products) {
    const id = String(p.id);
    if (p.active !== false) activeProducts += 1;
    if (p.verifiedAt) verifiedProducts += 1;
    if (!collapse(p.name || "")) missingName += 1;
    if (!collapse(p.nameKo || "")) missingNameKo += 1;
    if (!collapse(p.brand || "")) missingBrand += 1;
    if (!p.keyIngredients?.length) missingIngredients += 1;
    if (p.skinConcern == null) missingSkinConcern += 1;
    if (!collapse(p.imageUrl || "")) missingImage += 1;

    const sizeLabel = resolveDisplaySizeLabel({
      productId: id,
      name: p.name,
      nameKo: p.nameKo,
    });
    if (sizeLabel) sizeParsable += 1;

    const productOffers = offersByProduct.get(id) ?? [];
    if (productOffers.length > 0) productsWithAnyOffer += 1;

    const krEligible = productOffers.filter((o) =>
      isOfferEligibleForCoreRecommendation(o, "KR")
    );
    const usEligible = productOffers.filter((o) =>
      isOfferEligibleForCoreRecommendation(o, "US")
    );
    const jpEligible = productOffers.filter((o) =>
      isOfferEligibleForCoreRecommendation(o, "JP")
    );
    strictKrOffers += krEligible.length;
    strictUsOffers += usEligible.length;
    strictJpOffers += jpEligible.length;
    if (krEligible.length) productsWithStrict.KR.add(id);
    if (usEligible.length) productsWithStrict.US.add(id);
    if (jpEligible.length) productsWithStrict.JP.add(id);

    const reviewReasons: string[] = [];
    const eligibilityFailures: string[] = [];
    for (const o of productOffers) {
      const fails = explainOfferEligibilityFailures(o, "KR");
      if (fails.length) {
        eligibilityFailures.push(
          `${o.retailerName || o.id}: ${fails.join(", ")}`
        );
      }
    }

    let status: CatalogTrustStatus;
    if (isProductInfoIncomplete(p)) {
      status = "product_info_incomplete";
      reviewReasons.push("missing_name_brand_or_ingredients");
    } else if (krEligible.length > 0 || usEligible.length > 0 || jpEligible.length > 0) {
      status = "verified_ready";
    } else if (p.verifiedAt) {
      status = "product_verified_no_offer";
      reviewReasons.push("product_verified_but_no_strict_offer");
    } else if (productOffers.length > 0) {
      status = "offer_pending";
      reviewReasons.push("offers_exist_but_not_strict_verified");
    } else if (dupMap.has(id)) {
      status = "duplicate_candidate";
      reviewReasons.push("duplicate_name_size_group");
    } else {
      status = "manual_review";
      reviewReasons.push("needs_official_source_and_offer");
    }

    // 중복은 플래그로 유지 (status가 verified여도 peer 기록)
    const dup = dupMap.get(id) ?? null;
    if (dup && status === "manual_review") {
      status = "duplicate_candidate";
    }

    byStatus[status] += 1;

    let queuePriority: 1 | 2 | 3 = 3;
    if (status === "product_verified_no_offer") queuePriority = 1;
    else if (
      status === "offer_pending" ||
      (status === "manual_review" &&
        p.keyIngredients.length > 0 &&
        collapse(p.name) &&
        collapse(p.brand))
    ) {
      queuePriority = 2;
    }

    audited.push({
      id,
      brand: getCanonicalBrandName(p.brand) || p.brand,
      displayNameKo:
        stripTrailingSizeFromProductName(p.nameKo) ||
        stripTrailingSizeFromProductName(p.name) ||
        "제품명 확인 중",
      displayNameEn:
        stripTrailingSizeFromProductName(p.name) ||
        stripTrailingSizeFromProductName(p.nameKo) ||
        "Product name pending verification",
      sizeLabel,
      category: p.category,
      status,
      verifiedAt: p.verifiedAt,
      hasKrStrictOffer: krEligible.length > 0,
      hasUsStrictOffer: usEligible.length > 0,
      hasJpStrictOffer: jpEligible.length > 0,
      offerCount: productOffers.length,
      krPrice: krEligible[0]?.price ?? null,
      krRetailer: krEligible[0]?.retailerName ?? null,
      krStock: krEligible[0]?.stockStatus ?? null,
      reviewReasons,
      eligibilityFailures,
      duplicateGroupKey: dup?.key ?? null,
      duplicatePeerIds: dup?.peers ?? [],
      queuePriority,
    });
  }

  const offerGaps = audited
    .filter((p) => p.status !== "verified_ready")
    .sort((a, b) => a.queuePriority - b.queuePriority || a.id.localeCompare(b.id))
    .map((p) => ({
      productId: p.id,
      brand: p.brand,
      displayNameKo: p.displayNameKo,
      status: p.status,
      priority: p.queuePriority,
      reasons: [...p.reviewReasons, ...p.eligibilityFailures.slice(0, 3)],
    }));

  const summary: CatalogAuditSummary = {
    generatedAt: new Date().toISOString(),
    totalProducts: products.length,
    activeProducts,
    verifiedProducts,
    unverifiedProducts: products.length - verifiedProducts,
    missingName,
    missingNameKo,
    missingBrand,
    missingIngredients,
    missingSkinConcern,
    missingImage,
    sizeParsable,
    sizeUnparsable: products.length - sizeParsable,
    duplicateCandidateProducts: duplicateGroups.reduce(
      (n, g) => n + g.productIds.length,
      0
    ),
    productsWithAnyOffer,
    strictKrOffers,
    strictUsOffers,
    strictJpOffers,
    byStatus,
    country: {
      KR: {
        strictOffers: strictKrOffers,
        productsWithStrict: productsWithStrict.KR.size,
      },
      US: {
        strictOffers: strictUsOffers,
        productsWithStrict: productsWithStrict.US.size,
      },
      JP: {
        strictOffers: strictJpOffers,
        productsWithStrict: productsWithStrict.JP.size,
      },
    },
  };

  return { summary, products: audited, duplicateGroups, offerGaps };
}

export function catalogAuditToCsv(
  rows: Array<Record<string, string | number | boolean | null | undefined>>
): string {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]!);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [
    keys.join(","),
    ...rows.map((r) => keys.map((k) => esc(r[k])).join(",")),
  ].join("\n");
}
