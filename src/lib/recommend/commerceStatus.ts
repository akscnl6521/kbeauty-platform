/**
 * Commerce availability — separate from recommendation_ready / Organic ranking.
 * Uses existing product_offers.stock_status; no DB migration required.
 */

import type { ProductOffer, ProductStatus, StockStatus } from "./catalogTypes";
import type { OfferCurrency, ShippingCountry } from "./selectPurchaseLink";
import { normalizeShippingCountry } from "./selectPurchaseLink";

/** Runtime commerce layer status (Organic rank must not depend on this). */
export type CommerceStatus =
  | "in_stock"
  | "out_of_stock"
  | "availability_unknown"
  | "discontinued"
  | "region_unavailable";

export type CommerceAvailability = {
  commerce_status: CommerceStatus;
  seller: string | null;
  official_seller: boolean | null;
  price: number | null;
  currency: OfferCurrency | null;
  offer_url: string | null;
  checked_at: string | null;
};

/**
 * Feature flag — set RECOMMEND_COMMERCE_SEPARATION=0 to restore
 * legacy KR in_stock gate for ranking eligibility.
 */
export function isRecommendCommerceSeparationEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  const raw = (env.RECOMMEND_COMMERCE_SEPARATION ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

export function stockStatusToCommerceStatus(
  stock: StockStatus | null | undefined
): CommerceStatus {
  if (stock === "in_stock") return "in_stock";
  if (stock === "out_of_stock") return "out_of_stock";
  return "availability_unknown";
}

/**
 * Derive commerce status from offers + optional product status.
 * Ranking must not call this to exclude match-fit products.
 */
export function deriveCommerceAvailability(input: {
  offers: ProductOffer[];
  shippingCountry: ShippingCountry | string | null | undefined;
  productStatus?: ProductStatus | null;
  /** Prefer this offer when choosing seller/price display */
  preferredOffer?: ProductOffer | null;
}): CommerceAvailability {
  const empty: CommerceAvailability = {
    commerce_status: "availability_unknown",
    seller: null,
    official_seller: null,
    price: null,
    currency: null,
    offer_url: null,
    checked_at: null,
  };

  if (input.productStatus === "discontinued") {
    return { ...empty, commerce_status: "discontinued" };
  }

  const country = normalizeShippingCountry(
    typeof input.shippingCountry === "string"
      ? input.shippingCountry
      : input.shippingCountry ?? null
  );
  if (!country) {
    return { ...empty, commerce_status: "region_unavailable" };
  }

  const regional = input.offers.filter(
    (o) =>
      o.active !== false &&
      o.retailerCountry === country &&
      o.shipsToCountries.includes(country)
  );

  if (regional.length === 0) {
    if (input.offers.length > 0) {
      return { ...empty, commerce_status: "region_unavailable" };
    }
    return empty;
  }

  const preferred =
    input.preferredOffer &&
    regional.some((o) => o.id === input.preferredOffer!.id)
      ? input.preferredOffer
      : regional.find((o) => o.stockStatus === "in_stock") ??
        regional.find((o) => o.isOfficial === true) ??
        regional[0]!;

  return {
    commerce_status: stockStatusToCommerceStatus(preferred.stockStatus),
    seller: preferred.retailerName ?? null,
    official_seller:
      typeof preferred.isOfficial === "boolean" ? preferred.isOfficial : null,
    price: preferred.price ?? null,
    currency: preferred.currency ?? null,
    offer_url: preferred.purchaseUrl ?? null,
    checked_at: preferred.lastCheckedAt ?? preferred.verifiedAt ?? null,
  };
}

export function commerceStatusLabelKo(status: CommerceStatus): string {
  switch (status) {
    case "in_stock":
      return "현재 구매 가능";
    case "out_of_stock":
      return "현재 품절";
    case "availability_unknown":
      return "판매 상태 확인 중";
    case "discontinued":
      return "단종";
    case "region_unavailable":
      return "이 지역에서 판매처 미확인";
    default:
      return "판매 상태 확인 중";
  }
}

export function commerceStatusLabelEn(status: CommerceStatus): string {
  switch (status) {
    case "in_stock":
      return "Available to purchase";
    case "out_of_stock":
      return "Currently out of stock";
    case "availability_unknown":
      return "Availability being confirmed";
    case "discontinued":
      return "Discontinued";
    case "region_unavailable":
      return "No retailer confirmed for this region";
    default:
      return "Availability being confirmed";
  }
}

export function commerceFitButUnavailableMessageKo(
  status: CommerceStatus
): string | null {
  if (status === "out_of_stock") {
    return "이 제품은 성분과 피부 고민 기준에는 적합하지만 현재 공식 판매처에서 품절 상태입니다.";
  }
  if (status === "availability_unknown") {
    return "이 제품은 성분과 피부 고민 기준에는 적합하지만 현재 판매 상태를 확인 중입니다.";
  }
  if (status === "discontinued") {
    return "이 제품은 단종되어 구매할 수 없습니다.";
  }
  if (status === "region_unavailable") {
    return "이 제품은 추천 적합하지만 현재 배송 지역에서 확인된 판매처가 없습니다.";
  }
  return null;
}
