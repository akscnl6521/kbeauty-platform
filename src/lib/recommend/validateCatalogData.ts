/**
 * 한국 제품·Offer 관리자 입력 검증.
 * 추천 점수·안전 필터와 분리. 잘못된 데이터가 후보에 들어가기 전 검출용.
 */

import type {
  DataConfidence,
  KoreanProductInput,
  KoreanProductOfferInput,
  ProductStatus,
  RetailerType,
  StockStatus,
} from "./catalogTypes";
import { findDuplicateProducts } from "./findDuplicateProducts";
import type { DuplicateScanResult } from "./findDuplicateProducts";
import type {
  LinkVerificationStatus,
  OfferCurrency,
  RetailerCountry,
  ShippingCountry,
} from "./selectPurchaseLink";

export type CatalogValidationSeverity = "error" | "warning" | "info";

export type CatalogValidationIssue = {
  code: string;
  severity: CatalogValidationSeverity;
  entity: "product" | "offer" | "cross";
  id?: string;
  field?: string;
  message: string;
};

export type CatalogValidationReport = {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  issues: CatalogValidationIssue[];
  duplicates: DuplicateScanResult;
  /** KR verified 핵심 추천 조건 충족 offer 수 */
  krVerifiedEligibleOfferCount: number;
  /** sample / unverified 제품 수 (핵심 추천 제외 대상) */
  sampleOrUnverifiedProductCount: number;
};

const PRODUCT_STATUSES: readonly ProductStatus[] = [
  "active",
  "draft",
  "sample",
  "discontinued",
];

const DATA_CONFIDENCES: readonly DataConfidence[] = [
  "high",
  "medium",
  "low",
  "unverified",
];

const RETAILER_TYPES: readonly RetailerType[] = [
  "official",
  "marketplace",
  "drugstore",
  "department",
  "other",
];

const STOCK_STATUSES: readonly StockStatus[] = [
  "in_stock",
  "out_of_stock",
  "unknown",
];

const VERIFICATION_STATUSES: readonly LinkVerificationStatus[] = [
  "verified",
  "unverified",
  "invalid",
  "unavailable",
];

const RETAILER_COUNTRIES: readonly RetailerCountry[] = [
  "KR",
  "US",
  "JP",
  "GLOBAL",
];

const CURRENCIES: readonly OfferCurrency[] = ["KRW", "USD", "JPY"];

function collapse(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function isHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function isIsoDateLike(value: string): boolean {
  if (!value) return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

function push(
  issues: CatalogValidationIssue[],
  issue: CatalogValidationIssue
): void {
  issues.push(issue);
}

/** 제품이 sample / unverified 이면 핵심 추천 투입 금지 */
export function isSampleOrUnverifiedProduct(
  product: Pick<KoreanProductInput, "productStatus" | "dataConfidence">
): boolean {
  return (
    product.productStatus === "sample" ||
    product.productStatus === "draft" ||
    product.dataConfidence === "unverified"
  );
}

/**
 * 한국 verified offer (핵심 추천) 조건.
 * productOffer.isOfferEligibleForCoreRecommendation(..., "KR") 와 동일 기준.
 */
export function meetsKoreanVerifiedOfferRules(
  offer: KoreanProductOfferInput
): boolean {
  if (offer.active === false) return false;
  if (offer.retailerCountry !== "KR") return false;
  if (!offer.shipsToCountries?.includes("KR")) return false;
  if (offer.currency !== "KRW") return false;
  if (offer.price == null || !Number.isFinite(offer.price) || offer.price <= 0) {
    return false;
  }
  if (offer.stockStatus !== "in_stock") return false;
  if (offer.verificationStatus !== "verified") return false;
  if (!offer.purchaseUrl || !isHttpsUrl(offer.purchaseUrl)) return false;
  if (!offer.verifiedAt || !collapse(offer.verifiedAt)) return false;
  return true;
}

export function validateKoreanProduct(
  product: KoreanProductInput,
  index?: number
): CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  const id = collapse(product.productId) || `row:${index ?? "?"}`;
  const prefix = `product[${id}]`;

  if (!collapse(product.productId)) {
    push(issues, {
      code: "PRODUCT_ID_MISSING",
      severity: "error",
      entity: "product",
      field: "productId",
      message: `${prefix}: productId 누락`,
    });
  }

  if (!collapse(product.canonicalBrandName)) {
    push(issues, {
      code: "CANONICAL_BRAND_MISSING",
      severity: "error",
      entity: "product",
      id,
      field: "canonicalBrandName",
      message: `${prefix}: canonicalBrandName 누락 (브랜드 번역 금지, 공식명 필수)`,
    });
  }

  if (!collapse(product.productNameKo) && !collapse(product.productNameEn)) {
    push(issues, {
      code: "PRODUCT_NAME_MISSING",
      severity: "error",
      entity: "product",
      id,
      field: "productNameKo",
      message: `${prefix}: productNameKo 또는 productNameEn 중 하나 필요`,
    });
  }

  if (!collapse(product.category)) {
    push(issues, {
      code: "CATEGORY_MISSING",
      severity: "warning",
      entity: "product",
      id,
      field: "category",
      message: `${prefix}: category 누락`,
    });
  }

  if (!collapse(product.sourceUrl)) {
    push(issues, {
      code: "SOURCE_URL_MISSING",
      severity: "error",
      entity: "product",
      id,
      field: "sourceUrl",
      message: `${prefix}: sourceUrl 누락`,
    });
  } else if (!isHttpsUrl(product.sourceUrl)) {
    push(issues, {
      code: "SOURCE_URL_INVALID",
      severity: "error",
      entity: "product",
      id,
      field: "sourceUrl",
      message: `${prefix}: sourceUrl 은 https URL 이어야 함`,
    });
  }

  if (
    product.productStatus &&
    !PRODUCT_STATUSES.includes(product.productStatus)
  ) {
    push(issues, {
      code: "PRODUCT_STATUS_INVALID",
      severity: "error",
      entity: "product",
      id,
      field: "productStatus",
      message: `${prefix}: productStatus 값 오류 (${product.productStatus})`,
    });
  }

  if (
    product.dataConfidence &&
    !DATA_CONFIDENCES.includes(product.dataConfidence)
  ) {
    push(issues, {
      code: "DATA_CONFIDENCE_INVALID",
      severity: "error",
      entity: "product",
      id,
      field: "dataConfidence",
      message: `${prefix}: dataConfidence 값 오류 (${product.dataConfidence})`,
    });
  }

  if (!product.productStatus) {
    push(issues, {
      code: "PRODUCT_STATUS_MISSING",
      severity: "error",
      entity: "product",
      id,
      field: "productStatus",
      message: `${prefix}: productStatus 누락`,
    });
  }

  if (!product.dataConfidence) {
    push(issues, {
      code: "DATA_CONFIDENCE_MISSING",
      severity: "error",
      entity: "product",
      id,
      field: "dataConfidence",
      message: `${prefix}: dataConfidence 누락`,
    });
  }

  if (
    product.productStatus === "active" &&
    product.dataConfidence === "high" &&
    !collapse(product.verifiedAt)
  ) {
    push(issues, {
      code: "PRODUCT_VERIFIED_AT_MISSING",
      severity: "error",
      entity: "product",
      id,
      field: "verifiedAt",
      message: `${prefix}: active+high 제품은 verifiedAt 필수`,
    });
  }

  if (product.verifiedAt && !isIsoDateLike(product.verifiedAt)) {
    push(issues, {
      code: "PRODUCT_VERIFIED_AT_INVALID",
      severity: "warning",
      entity: "product",
      id,
      field: "verifiedAt",
      message: `${prefix}: verifiedAt 날짜 형식 확인 필요`,
    });
  }

  if (isSampleOrUnverifiedProduct(product)) {
    push(issues, {
      code: "SAMPLE_OR_UNVERIFIED_PRODUCT",
      severity: "info",
      entity: "product",
      id,
      message: `${prefix}: sample/draft/unverified — 핵심 추천에 사용하지 않음`,
    });
  }

  return issues;
}

export function validateKoreanProductOffer(
  offer: KoreanProductOfferInput,
  index?: number
): CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  const id = collapse(offer.offerId) || `row:${index ?? "?"}`;
  const prefix = `offer[${id}]`;

  if (!collapse(offer.offerId)) {
    push(issues, {
      code: "OFFER_ID_MISSING",
      severity: "error",
      entity: "offer",
      field: "offerId",
      message: `${prefix}: offerId 누락`,
    });
  }

  if (!collapse(offer.productId)) {
    push(issues, {
      code: "OFFER_PRODUCT_ID_MISSING",
      severity: "error",
      entity: "offer",
      id,
      field: "productId",
      message: `${prefix}: productId 누락 (고아 offer)`,
    });
  }

  if (!collapse(offer.retailerName)) {
    push(issues, {
      code: "RETAILER_NAME_MISSING",
      severity: "error",
      entity: "offer",
      id,
      field: "retailerName",
      message: `${prefix}: retailerName 누락`,
    });
  }

  if (!offer.retailerType || !RETAILER_TYPES.includes(offer.retailerType)) {
    push(issues, {
      code: "RETAILER_TYPE_INVALID",
      severity: "error",
      entity: "offer",
      id,
      field: "retailerType",
      message: `${prefix}: retailerType 누락 또는 오류`,
    });
  }

  if (
    !offer.retailerCountry ||
    !RETAILER_COUNTRIES.includes(offer.retailerCountry)
  ) {
    push(issues, {
      code: "RETAILER_COUNTRY_INVALID",
      severity: "error",
      entity: "offer",
      id,
      field: "retailerCountry",
      message: `${prefix}: retailerCountry 누락 또는 오류`,
    });
  }

  // 한국 1단계 템플릿: KR 외는 경고 (금지 아님 — 다국가 확장용)
  if (offer.retailerCountry && offer.retailerCountry !== "KR") {
    push(issues, {
      code: "RETAILER_COUNTRY_NOT_KR",
      severity: "warning",
      entity: "offer",
      id,
      field: "retailerCountry",
      message: `${prefix}: 한국 1단계 입력인데 retailerCountry=${offer.retailerCountry}`,
    });
  }

  if (!Array.isArray(offer.shipsToCountries) || offer.shipsToCountries.length === 0) {
    push(issues, {
      code: "SHIPS_TO_MISSING",
      severity: "error",
      entity: "offer",
      id,
      field: "shipsToCountries",
      message: `${prefix}: shipsToCountries 누락`,
    });
  } else if (
    offer.retailerCountry === "KR" &&
    !offer.shipsToCountries.includes("KR")
  ) {
    push(issues, {
      code: "SHIPS_TO_MISSING_KR",
      severity: "error",
      entity: "offer",
      id,
      field: "shipsToCountries",
      message: `${prefix}: KR 판매처인데 shipsToCountries에 KR 없음`,
    });
  }

  if (!collapse(offer.purchaseUrl)) {
    push(issues, {
      code: "PURCHASE_URL_MISSING",
      severity: "error",
      entity: "offer",
      id,
      field: "purchaseUrl",
      message: `${prefix}: purchaseUrl 누락`,
    });
  } else if (!isHttpsUrl(offer.purchaseUrl)) {
    push(issues, {
      code: "PURCHASE_URL_NOT_HTTPS",
      severity: "error",
      entity: "offer",
      id,
      field: "purchaseUrl",
      message: `${prefix}: purchaseUrl 은 https 여야 함 (http/잘못된 URL 불가)`,
    });
  }

  if (offer.stockStatus == null) {
    push(issues, {
      code: "STOCK_STATUS_MISSING",
      severity: "error",
      entity: "offer",
      id,
      field: "stockStatus",
      message: `${prefix}: stockStatus 누락`,
    });
  } else if (!STOCK_STATUSES.includes(offer.stockStatus)) {
    push(issues, {
      code: "STOCK_STATUS_INVALID",
      severity: "error",
      entity: "offer",
      id,
      field: "stockStatus",
      message: `${prefix}: stockStatus 값 오류`,
    });
  }

  if (offer.verificationStatus == null) {
    push(issues, {
      code: "VERIFICATION_STATUS_MISSING",
      severity: "error",
      entity: "offer",
      id,
      field: "verificationStatus",
      message: `${prefix}: verificationStatus 누락`,
    });
  } else if (!VERIFICATION_STATUSES.includes(offer.verificationStatus)) {
    push(issues, {
      code: "VERIFICATION_STATUS_INVALID",
      severity: "error",
      entity: "offer",
      id,
      field: "verificationStatus",
      message: `${prefix}: verificationStatus 값 오류`,
    });
  }

  if (offer.price != null) {
    if (!Number.isFinite(offer.price) || offer.price <= 0) {
      push(issues, {
        code: "PRICE_NON_POSITIVE",
        severity: "error",
        entity: "offer",
        id,
        field: "price",
        message: `${prefix}: price 는 0 초과여야 함`,
      });
    }
  }

  if (offer.currency != null && !CURRENCIES.includes(offer.currency)) {
    push(issues, {
      code: "CURRENCY_INVALID",
      severity: "error",
      entity: "offer",
      id,
      field: "currency",
      message: `${prefix}: currency 값 오류`,
    });
  }

  if (offer.retailerCountry === "KR") {
    if (offer.currency != null && offer.currency !== "KRW") {
      push(issues, {
        code: "CURRENCY_NOT_KRW",
        severity: "error",
        entity: "offer",
        id,
        field: "currency",
        message: `${prefix}: KR 판매처는 currency=KRW 필수 (현재 ${offer.currency})`,
      });
    }
  }

  if (offer.verificationStatus === "verified") {
    if (offer.price == null || offer.price <= 0) {
      push(issues, {
        code: "VERIFIED_PRICE_MISSING",
        severity: "error",
        entity: "offer",
        id,
        field: "price",
        message: `${prefix}: verified offer 는 price > 0 필수 (임의 가격 금지 — 실측만)`,
      });
    }
    if (!offer.currency) {
      push(issues, {
        code: "VERIFIED_CURRENCY_MISSING",
        severity: "error",
        entity: "offer",
        id,
        field: "currency",
        message: `${prefix}: verified offer 는 currency 필수`,
      });
    }
    const verifiedAt = collapse(offer.verifiedAt);
    if (!verifiedAt) {
      push(issues, {
        code: "VERIFIED_AT_MISSING",
        severity: "error",
        entity: "offer",
        id,
        field: "verifiedAt",
        message: `${prefix}: verifiedAt 누락`,
      });
    } else if (!isIsoDateLike(verifiedAt)) {
      push(issues, {
        code: "VERIFIED_AT_INVALID",
        severity: "warning",
        entity: "offer",
        id,
        field: "verifiedAt",
        message: `${prefix}: verifiedAt 날짜 형식 확인 필요`,
      });
    }
    if (offer.stockStatus !== "in_stock" && offer.retailerCountry === "KR") {
      push(issues, {
        code: "KR_VERIFIED_NOT_IN_STOCK",
        severity: "error",
        entity: "offer",
        id,
        field: "stockStatus",
        message: `${prefix}: KR verified 핵심 추천은 in_stock 만 허용`,
      });
    }
  }

  return issues;
}

function validateCrossRefs(
  products: readonly KoreanProductInput[],
  offers: readonly KoreanProductOfferInput[]
): CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  const productIds = new Set(
    products.map((p) => collapse(p.productId)).filter(Boolean)
  );
  const productById = new Map(
    products
      .filter((p) => collapse(p.productId))
      .map((p) => [collapse(p.productId), p] as const)
  );

  for (const offer of offers) {
    const pid = collapse(offer.productId);
    const oid = collapse(offer.offerId);
    if (!pid) continue;
    if (!productIds.has(pid)) {
      push(issues, {
        code: "ORPHAN_OFFER",
        severity: "error",
        entity: "cross",
        id: oid,
        field: "productId",
        message: `offer[${oid}]: productId=${pid} 에 대응하는 제품 없음`,
      });
      continue;
    }

    const product = productById.get(pid);
    if (
      product &&
      isSampleOrUnverifiedProduct(product) &&
      offer.verificationStatus === "verified"
    ) {
      push(issues, {
        code: "SAMPLE_PRODUCT_VERIFIED_OFFER",
        severity: "error",
        entity: "cross",
        id: oid,
        message: `offer[${oid}]: sample/unverified 제품에 verified offer 불가 — 핵심 추천 오염 방지`,
      });
    }
  }

  return issues;
}

/**
 * 제품 + offer 일괄 검증 (중복·URL·가격·통화·재고·KR verified 포함).
 */
export function validateCatalogData(
  products: readonly KoreanProductInput[],
  offers: readonly KoreanProductOfferInput[] = []
): CatalogValidationReport {
  const issues: CatalogValidationIssue[] = [];

  products.forEach((p, i) => {
    issues.push(...validateKoreanProduct(p, i));
  });
  offers.forEach((o, i) => {
    issues.push(...validateKoreanProductOffer(o, i));
  });
  issues.push(...validateCrossRefs(products, offers));

  const duplicates = findDuplicateProducts(products, offers);
  for (const d of duplicates.duplicateProductIds) {
    push(issues, {
      code: "DUPLICATE_PRODUCT_ID",
      severity: "error",
      entity: "product",
      id: d.id,
      field: "productId",
      message: `productId 중복: ${d.id} (${d.count}회)`,
    });
  }
  for (const d of duplicates.duplicateOfferIds) {
    push(issues, {
      code: "DUPLICATE_OFFER_ID",
      severity: "error",
      entity: "offer",
      id: d.id,
      field: "offerId",
      message: `offerId 중복: ${d.id} (${d.count}회)`,
    });
  }
  for (const g of duplicates.duplicateBrandProductNames) {
    push(issues, {
      code: "DUPLICATE_BRAND_PRODUCT_NAME",
      severity: "error",
      entity: "product",
      field: "canonicalBrandName",
      message: `동일 브랜드·제품명 중복: ${g.canonicalBrandName} / ${g.productNameKo || g.productNameEn} (${g.productIds.join(", ")})`,
    });
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return {
    ok: errorCount === 0,
    errorCount,
    warningCount,
    issues,
    duplicates,
    krVerifiedEligibleOfferCount: offers.filter(meetsKoreanVerifiedOfferRules)
      .length,
    sampleOrUnverifiedProductCount: products.filter(isSampleOrUnverifiedProduct)
      .length,
  };
}

/** CSV 셀: 파이프(|) 구분 배열 */
export function parsePipeList(value: string | null | undefined): string[] {
  if (value == null || !String(value).trim()) return [];
  return String(value)
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** CSV 셀: 불리언 (빈 값 → null) */
export function parseOptionalBoolean(
  value: string | null | undefined
): boolean | null {
  if (value == null || !String(value).trim()) return null;
  const v = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(v)) return true;
  if (["false", "0", "no", "n"].includes(v)) return false;
  return null;
}

export function parseOptionalNumber(
  value: string | null | undefined
): number | null {
  if (value == null || !String(value).trim()) return null;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * CSV 헤더 행 → KoreanProductInput (느슨한 파서).
 * 배열 필드는 `|` 구분.
 */
export function rowToKoreanProductInput(
  row: Record<string, string>
): KoreanProductInput {
  const get = (k: string) => collapse(row[k] ?? row[k.toLowerCase()]);
  return {
    productId: get("productId"),
    canonicalBrandName: get("canonicalBrandName"),
    productNameKo: get("productNameKo"),
    productNameEn: get("productNameEn"),
    category: get("category"),
    skinTypes: parsePipeList(row.skinTypes ?? row.skintypes),
    concerns: parsePipeList(row.concerns),
    keyIngredients: parsePipeList(row.keyIngredients ?? row.keyingredients),
    fullIngredients: parsePipeList(row.fullIngredients ?? row.fullingredients),
    fragranceFree: parseOptionalBoolean(row.fragranceFree ?? row.fragrancefree),
    alcoholFree: parseOptionalBoolean(row.alcoholFree ?? row.alcoholfree),
    productStatus: (get("productStatus") || "sample") as ProductStatus,
    dataConfidence: (get("dataConfidence") || "unverified") as DataConfidence,
    verifiedAt: get("verifiedAt") || null,
    sourceUrl: get("sourceUrl"),
  };
}

export function rowToKoreanProductOfferInput(
  row: Record<string, string>
): KoreanProductOfferInput {
  const get = (k: string) => collapse(row[k] ?? row[k.toLowerCase()]);
  const ships = parsePipeList(
    row.shipsToCountries ?? row.shipstocountries
  ) as ShippingCountry[];
  const activeRaw = parseOptionalBoolean(row.active);
  return {
    offerId: get("offerId"),
    productId: get("productId"),
    retailerName: get("retailerName"),
    retailerType: (get("retailerType") || "other") as RetailerType,
    retailerCountry: (get("retailerCountry") || "KR") as RetailerCountry,
    shipsToCountries: ships.length ? ships : (["KR"] as ShippingCountry[]),
    purchaseUrl: get("purchaseUrl"),
    price: parseOptionalNumber(row.price),
    currency: (get("currency") || null) as OfferCurrency | null,
    stockStatus: (get("stockStatus") || null) as StockStatus | null,
    verificationStatus: (get("verificationStatus") ||
      null) as LinkVerificationStatus | null,
    isOfficial: parseOptionalBoolean(row.isOfficial ?? row.isofficial),
    verifiedAt: get("verifiedAt") || null,
    lastCheckedAt: get("lastCheckedAt") || null,
    active: activeRaw,
  };
}
