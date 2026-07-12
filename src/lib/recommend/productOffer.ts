import type {
  CatalogProduct,
  ProductOffer,
  StockStatus,
} from "./catalogTypes";
import { CORE_ALLOWED_STOCK } from "./catalogTypes";
import type {
  LegacyPurchaseLinkFields,
  LinkVerificationStatus,
  OfferCurrency,
  PurchaseLink,
  RetailerCountry,
  ShippingCountry,
} from "./selectPurchaseLink";
import {
  buildPurchaseLinksFromProduct,
  normalizeShippingCountry,
} from "./selectPurchaseLink";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t || undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
  return out.length ? out : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}

function parseStockStatus(value: unknown): StockStatus {
  const raw = String(value ?? "unknown")
    .trim()
    .toLowerCase();
  if (raw === "in_stock" || raw === "instock") return "in_stock";
  if (raw === "out_of_stock" || raw === "outofstock") return "out_of_stock";
  return "unknown";
}

function parseVerificationStatus(value: unknown): LinkVerificationStatus {
  const raw = String(value ?? "unverified")
    .trim()
    .toLowerCase();
  if (
    raw === "verified" ||
    raw === "unverified" ||
    raw === "invalid" ||
    raw === "unavailable"
  ) {
    return raw;
  }
  return "unverified";
}

function parseRetailerCountry(value: unknown): RetailerCountry {
  const raw = String(value ?? "GLOBAL")
    .trim()
    .toUpperCase();
  if (raw === "KR" || raw === "US" || raw === "JP" || raw === "GLOBAL") {
    return raw;
  }
  return "GLOBAL";
}

function parseCurrency(value: unknown): OfferCurrency | undefined {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (raw === "KRW" || raw === "USD" || raw === "JPY") return raw;
  return undefined;
}

function isHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function expectedCurrency(
  country: ShippingCountry
): OfferCurrency {
  if (country === "KR") return "KRW";
  if (country === "JP") return "JPY";
  return "USD";
}

/** DB / JSON 한 행 → ProductOffer */
export function normalizeProductOffer(raw: unknown): ProductOffer | null {
  if (!isRecord(raw)) return null;

  const id = asTrimmedString(raw.id) ?? asTrimmedString(raw.offer_id);
  const productId =
    asTrimmedString(raw.productId) ??
    asTrimmedString(raw.product_id) ??
    asTrimmedString(raw.productID);
  const retailerName =
    asTrimmedString(raw.retailerName) ??
    asTrimmedString(raw.retailer_name) ??
    asTrimmedString(raw.retailer);
  const purchaseUrl =
    asTrimmedString(raw.purchaseUrl) ??
    asTrimmedString(raw.purchase_url) ??
    asTrimmedString(raw.url);

  if (!id || !productId || !retailerName || !purchaseUrl) return null;

  const shipsRaw = raw.shipsToCountries ?? raw.ships_to_countries;
  const shipsToCountries = Array.isArray(shipsRaw)
    ? shipsRaw
        .map((c) => normalizeShippingCountry(String(c)))
        .filter((c): c is ShippingCountry => c != null)
    : [];

  const retailerCountry = parseRetailerCountry(
    raw.retailerCountry ?? raw.retailer_country
  );

  const price = asNumber(raw.price);
  const currency =
    parseCurrency(raw.currency) ??
    (retailerCountry === "KR"
      ? "KRW"
      : retailerCountry === "US"
        ? "USD"
        : retailerCountry === "JP"
          ? "JPY"
          : undefined);

  return {
    id,
    productId,
    retailerName,
    retailerCountry,
    shipsToCountries:
      shipsToCountries.length > 0
        ? shipsToCountries
        : retailerCountry === "GLOBAL"
          ? []
          : [retailerCountry as ShippingCountry],
    purchaseUrl,
    ...(price != null ? { price } : {}),
    ...(currency ? { currency } : {}),
    stockStatus: parseStockStatus(raw.stockStatus ?? raw.stock_status),
    verificationStatus: parseVerificationStatus(
      raw.verificationStatus ?? raw.verification_status
    ),
    ...(asBoolean(raw.isOfficial ?? raw.is_official) !== undefined
      ? { isOfficial: asBoolean(raw.isOfficial ?? raw.is_official) }
      : {}),
    ...(asBoolean(raw.active) !== undefined
      ? { active: asBoolean(raw.active) }
      : {}),
    ...(asTrimmedString(raw.retailerType ?? raw.retailer_type)
      ? {
          retailerType: asTrimmedString(
            raw.retailerType ?? raw.retailer_type
          ) as ProductOffer["retailerType"],
        }
      : {}),
    ...(asTrimmedString(raw.verifiedAt ?? raw.verified_at)
      ? { verifiedAt: asTrimmedString(raw.verifiedAt ?? raw.verified_at) }
      : {}),
    ...(asTrimmedString(raw.lastCheckedAt ?? raw.last_checked_at)
      ? {
          lastCheckedAt: asTrimmedString(
            raw.lastCheckedAt ?? raw.last_checked_at
          ),
        }
      : {}),
    // 리뷰 확장 — 점수 미반영, 저장만
    ...(asNumber(raw.rating) != null ? { rating: asNumber(raw.rating) } : {}),
    ...(asNumber(raw.reviewCount ?? raw.review_count) != null
      ? { reviewCount: asNumber(raw.reviewCount ?? raw.review_count) }
      : {}),
    ...(asTrimmedString(raw.source) ? { source: asTrimmedString(raw.source) } : {}),
    ...(asTrimmedString(raw.lastReviewSyncAt ?? raw.last_review_sync_at)
      ? {
          lastReviewSyncAt: asTrimmedString(
            raw.lastReviewSyncAt ?? raw.last_review_sync_at
          ),
        }
      : {}),
  };
}

/** 느슨한 제품 행 → CatalogProduct (선택 필드 포함) */
export function normalizeCatalogProduct(raw: unknown): CatalogProduct | null {
  if (!isRecord(raw)) return null;
  const id = asTrimmedString(raw.id);
  const brand = asTrimmedString(raw.brand) ?? "";
  const productName =
    asTrimmedString(raw.productName) ??
    asTrimmedString(raw.product_name) ??
    asTrimmedString(raw.name) ??
    asTrimmedString(raw.name_ko) ??
    "";
  if (!id || !productName) return null;

  return {
    id,
    brand,
    productName,
    ...(asTrimmedString(raw.category)
      ? { category: asTrimmedString(raw.category) }
      : {}),
    ...(asStringArray(raw.skinTypes ?? raw.skin_types)
      ? { skinTypes: asStringArray(raw.skinTypes ?? raw.skin_types) }
      : {}),
    ...(asStringArray(raw.concerns ?? raw.skin_concern)
      ? {
          concerns: Array.isArray(raw.concerns)
            ? asStringArray(raw.concerns)
            : asTrimmedString(raw.skin_concern)
              ? [asTrimmedString(raw.skin_concern)!]
              : undefined,
        }
      : {}),
    ...(asStringArray(raw.keyIngredients ?? raw.key_ingredients)
      ? {
          keyIngredients: asStringArray(
            raw.keyIngredients ?? raw.key_ingredients
          ),
        }
      : {}),
    ...(asStringArray(raw.fullIngredients ?? raw.full_ingredients)
      ? {
          fullIngredients: asStringArray(
            raw.fullIngredients ?? raw.full_ingredients
          ),
        }
      : {}),
    ...(asTrimmedString(raw.usageArea ?? raw.usage_area)
      ? { usageArea: asTrimmedString(raw.usageArea ?? raw.usage_area) }
      : {}),
    ...(asTrimmedString(raw.texture) ? { texture: asTrimmedString(raw.texture) } : {}),
    ...(asBoolean(raw.fragranceFree ?? raw.fragrance_free) !== undefined
      ? {
          fragranceFree: asBoolean(raw.fragranceFree ?? raw.fragrance_free),
        }
      : {}),
    ...(asBoolean(raw.alcoholFree ?? raw.alcohol_free) !== undefined
      ? { alcoholFree: asBoolean(raw.alcoholFree ?? raw.alcohol_free) }
      : {}),
    ...(asTrimmedString(raw.verifiedAt ?? raw.verified_at)
      ? { verifiedAt: asTrimmedString(raw.verifiedAt ?? raw.verified_at) }
      : {}),
    ...(asTrimmedString(raw.dataConfidence ?? raw.data_confidence)
      ? {
          dataConfidence: asTrimmedString(
            raw.dataConfidence ?? raw.data_confidence
          ) as CatalogProduct["dataConfidence"],
        }
      : {}),
    ...(asBoolean(raw.active) !== undefined
      ? { active: asBoolean(raw.active) }
      : {}),
  };
}

/** ProductOffer → 기존 PurchaseLink (표시·선택·캐시 재검증 로직 재사용) */
export function productOfferToPurchaseLink(offer: ProductOffer): PurchaseLink {
  return {
    retailerName: offer.retailerName,
    purchaseUrl: offer.purchaseUrl,
    retailerCountry: offer.retailerCountry,
    shipsToCountries: offer.shipsToCountries,
    verificationStatus: offer.verificationStatus,
    ...(offer.price != null ? { price: offer.price } : {}),
    ...(offer.currency ? { currency: offer.currency } : {}),
    ...(offer.verifiedAt ? { verifiedAt: offer.verifiedAt } : {}),
    ...(offer.isOfficial !== undefined ? { isOfficial: offer.isOfficial } : {}),
    stockStatus: offer.stockStatus,
    ...(offer.active !== undefined ? { active: offer.active } : {}),
    sourceField: `product_offers:${offer.id}`,
  };
}

/**
 * 핵심 추천용 offer 적격성.
 * - 공통: verified, verifiedAt, price > 0, 통화, https URL, 배송국 포함, 판매국=배송국, active !== false
 * - KR: retailerCountry=KR, KRW, in_stock 만 허용 (GLOBAL/US/JP·unknown 재고 제외)
 * - 레거시 purchase_links 변환분도 동일 조건을 통과해야 포함된다
 */
export function isOfferEligibleForCoreRecommendation(
  offer: ProductOffer,
  shippingCountry: ShippingCountry
): boolean {
  if (offer.active === false) return false;
  if (offer.verificationStatus !== "verified") return false;
  if (!offer.verifiedAt || !offer.verifiedAt.trim()) return false;
  if (offer.price == null || !Number.isFinite(offer.price) || offer.price <= 0) {
    return false;
  }
  if (!offer.currency) return false;
  if (offer.currency !== expectedCurrency(shippingCountry)) return false;
  if (!offer.purchaseUrl || !isHttpsUrl(offer.purchaseUrl)) return false;
  if (!offer.shipsToCountries.includes(shippingCountry)) return false;
  // 국가 일치 규칙: GLOBAL 및 타국 판매처는 해당 배송국 핵심 추천에서 제외
  if (offer.retailerCountry !== shippingCountry) return false;

  if (shippingCountry === "KR") {
    // 한국: 재고 unknown 제외, in_stock만 허용
    if (offer.stockStatus !== "in_stock") return false;
    return true;
  }

  // US / JP: in_stock 또는 unknown 허용
  if (!CORE_ALLOWED_STOCK.has(offer.stockStatus)) return false;
  return true;
}

/** PurchaseLink(+stock) → ProductOffer 형태 (레거시 변환) */
export function purchaseLinkToProductOffer(
  link: PurchaseLink,
  productId: string,
  index: number
): ProductOffer {
  const extended = link as PurchaseLink & {
    stockStatus?: StockStatus;
    active?: boolean;
  };
  return {
    id: `legacy_${productId}_${index}`,
    productId,
    retailerName: link.retailerName,
    retailerCountry: link.retailerCountry,
    shipsToCountries: link.shipsToCountries,
    purchaseUrl: link.purchaseUrl,
    ...(link.price != null ? { price: link.price } : {}),
    ...(link.currency ? { currency: link.currency } : {}),
    stockStatus: extended.stockStatus ?? "unknown",
    verificationStatus: link.verificationStatus,
    ...(link.isOfficial !== undefined ? { isOfficial: link.isOfficial } : {}),
    ...(link.verifiedAt ? { verifiedAt: link.verifiedAt } : {}),
    ...(extended.active !== undefined ? { active: extended.active } : {}),
  };
}

/**
 * 제품의 offer 목록 확보.
 * - CandidateProduct.offers 우선
 * - 없으면 purchase_links (캐시에 저장된 적격 offer 포함) / 레거시 URL → offer 변환
 */
export function resolveProductOffers(
  product: LegacyPurchaseLinkFields & {
    id?: string;
    offers?: ProductOffer[] | null;
  }
): ProductOffer[] {
  if (Array.isArray(product.offers) && product.offers.length > 0) {
    return product.offers
      .map((o) => normalizeProductOffer(o))
      .filter((o): o is ProductOffer => o != null);
  }

  // 캐시에 남은 적격 purchase_links 만으로도 재검증 가능하도록 우선 사용
  if (
    Array.isArray(product.purchase_links) &&
    product.purchase_links.length > 0
  ) {
    const productId =
      typeof product.id === "string" && product.id.trim()
        ? product.id.trim()
        : "unknown";
    return product.purchase_links.map((link, i) =>
      purchaseLinkToProductOffer(link, productId, i)
    );
  }

  const productId =
    typeof product.id === "string" && product.id.trim()
      ? product.id.trim()
      : "unknown";
  const links = buildPurchaseLinksFromProduct(product);
  return links.map((link, i) => purchaseLinkToProductOffer(link, productId, i));
}

export type OfferFilterResult<T> = {
  eligible: T[];
  excludedCount: number;
};

/**
 * 핵심 추천 전: 배송 국가에 적격 verified offer가 있는 제품만 통과.
 * 랭킹 점수 계산은 변경하지 않는다.
 */
export function filterCandidatesByOfferAvailability<
  T extends LegacyPurchaseLinkFields & {
    id: string;
    offers?: ProductOffer[] | null;
  },
>(
  products: T[],
  shippingCountry: ShippingCountry | string | null | undefined
): OfferFilterResult<T> {
  const country = normalizeShippingCountry(
    typeof shippingCountry === "string"
      ? shippingCountry
      : shippingCountry ?? null
  );

  if (!country) {
    return { eligible: [], excludedCount: products.length };
  }

  const eligible: T[] = [];
  let excludedCount = 0;

  for (const product of products) {
    const offers = resolveProductOffers(product);
    const hasEligible = offers.some((o) =>
      isOfferEligibleForCoreRecommendation(o, country)
    );
    if (hasEligible) {
      // 표시용 purchase_links 를 적격 offer 기준으로 보강
      const purchase_links = offers
        .filter((o) => isOfferEligibleForCoreRecommendation(o, country))
        .map(productOfferToPurchaseLink);
      eligible.push({
        ...product,
        offers,
        purchase_links:
          purchase_links.length > 0
            ? purchase_links
            : product.purchase_links ?? null,
      });
    } else {
      excludedCount += 1;
    }
  }

  return { eligible, excludedCount };
}
