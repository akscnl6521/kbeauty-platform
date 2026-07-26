/**
 * T05 — Country/language-aware offer presentation.
 * Never invents inventory, price, stock, or retailer rows.
 */

import type { ProductOffer } from "@/lib/recommend/catalogTypes";
import {
  deriveCommerceAvailability,
  type CommerceAvailability,
  type CommerceStatus,
} from "@/lib/recommend/commerceStatus";
import {
  normalizeShippingCountry,
  type OfferCurrency,
  type ShippingCountry,
} from "@/lib/recommend/selectPurchaseLink";

export type OfferLocale = "ko" | "ja" | "en";

export type LocalizedOfferView = {
  offerId: string;
  productId: string;
  retailerName: string;
  retailerCountry: string;
  price: number | null;
  currency: OfferCurrency | null;
  /** Display-only formatted price; null when price unknown (never invent). */
  priceLabel: string | null;
  stockStatus: ProductOffer["stockStatus"];
  stockLabel: string;
  verificationStatus: ProductOffer["verificationStatus"];
  purchaseUrl: string | null;
  isOfficial: boolean | null;
  shipsToSelectedCountry: boolean;
  checkedAt: string | null;
};

export type LocalizedOfferPresentation = {
  country: ShippingCountry | null;
  locale: OfferLocale;
  offers: LocalizedOfferView[];
  preferred: LocalizedOfferView | null;
  commerce: CommerceAvailability;
  /** True when region has no matching offers — never fabricate substitutes. */
  regionUnavailable: boolean;
  inventedInventory: false;
  emptyReason:
    | null
    | "no_offers"
    | "region_unavailable"
    | "country_unspecified"
    | "discontinued";
  message: string;
};

const STOCK_LABEL: Record<OfferLocale, Record<ProductOffer["stockStatus"], string>> = {
  ko: {
    in_stock: "재고 있음",
    out_of_stock: "품절",
    unknown: "재고 확인 중",
  },
  ja: {
    in_stock: "在庫あり",
    out_of_stock: "売り切れ",
    unknown: "在庫確認中",
  },
  en: {
    in_stock: "In stock",
    out_of_stock: "Out of stock",
    unknown: "Availability confirming",
  },
};

const EMPTY_MESSAGE: Record<
  OfferLocale,
  Record<NonNullable<LocalizedOfferPresentation["emptyReason"]>, string>
> = {
  ko: {
    no_offers: "확인된 판매처 정보가 없습니다.",
    region_unavailable: "이 배송 국가에서 확인된 판매처가 없습니다.",
    country_unspecified: "배송 국가를 선택하면 판매처를 확인할 수 있습니다.",
    discontinued: "단종되어 구매할 수 없습니다.",
  },
  ja: {
    no_offers: "確認済みの販売情報がありません。",
    region_unavailable: "この配送国では確認済みの販売先がありません。",
    country_unspecified: "配送国を選ぶと販売先を確認できます。",
    discontinued: "販売終了のため購入できません。",
  },
  en: {
    no_offers: "No verified retailer offers are available.",
    region_unavailable: "No verified retailer for this shipping country.",
    country_unspecified: "Select a shipping country to see retailers.",
    discontinued: "This product is discontinued.",
  },
};

export function normalizeOfferLocale(value: string | null | undefined): OfferLocale {
  const raw = (value ?? "en").trim().toLowerCase();
  if (raw.startsWith("ko")) return "ko";
  if (raw.startsWith("ja")) return "ja";
  return "en";
}

function formatPriceLabel(
  price: number | null | undefined,
  currency: OfferCurrency | null | undefined,
  locale: OfferLocale,
): string | null {
  if (typeof price !== "number" || !Number.isFinite(price) || !currency) {
    return null;
  }
  const tag = locale === "ko" ? "ko-KR" : locale === "ja" ? "ja-JP" : "en-US";
  try {
    return new Intl.NumberFormat(tag, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "KRW" || currency === "JPY" ? 0 : 2,
    }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
}

function toView(
  offer: ProductOffer,
  country: ShippingCountry | null,
  locale: OfferLocale,
): LocalizedOfferView {
  const ships =
    country !== null &&
    offer.active !== false &&
    offer.shipsToCountries.includes(country);
  return {
    offerId: offer.id,
    productId: offer.productId,
    retailerName: offer.retailerName,
    retailerCountry: offer.retailerCountry,
    price: typeof offer.price === "number" ? offer.price : null,
    currency: offer.currency ?? null,
    priceLabel: formatPriceLabel(offer.price, offer.currency, locale),
    stockStatus: offer.stockStatus,
    stockLabel: STOCK_LABEL[locale][offer.stockStatus],
    verificationStatus: offer.verificationStatus,
    purchaseUrl:
      offer.verificationStatus === "verified" && offer.purchaseUrl
        ? offer.purchaseUrl
        : null,
    isOfficial: typeof offer.isOfficial === "boolean" ? offer.isOfficial : null,
    shipsToSelectedCountry: ships,
    checkedAt: offer.lastCheckedAt ?? offer.verifiedAt ?? null,
  };
}

/**
 * Present offers for a country/locale without inventing missing rows.
 * Unverified purchase URLs are withheld from CTA.
 */
export function presentLocalizedOffers(input: {
  offers: ProductOffer[];
  shippingCountry: ShippingCountry | string | null | undefined;
  locale?: string | null;
  productStatus?: "active" | "draft" | "sample" | "discontinued" | null;
  preferredOfferId?: string | null;
}): LocalizedOfferPresentation {
  const locale = normalizeOfferLocale(input.locale);
  const country = normalizeShippingCountry(
    typeof input.shippingCountry === "string"
      ? input.shippingCountry
      : input.shippingCountry ?? null,
  );

  const commerce = deriveCommerceAvailability({
    offers: input.offers,
    shippingCountry: country,
    productStatus: input.productStatus,
    preferredOffer:
      input.preferredOfferId != null
        ? input.offers.find((o) => o.id === input.preferredOfferId) ?? null
        : null,
  });

  if (input.productStatus === "discontinued") {
    return {
      country,
      locale,
      offers: [],
      preferred: null,
      commerce,
      regionUnavailable: false,
      inventedInventory: false,
      emptyReason: "discontinued",
      message: EMPTY_MESSAGE[locale].discontinued,
    };
  }

  if (!country) {
    return {
      country: null,
      locale,
      offers: [],
      preferred: null,
      commerce,
      regionUnavailable: false,
      inventedInventory: false,
      emptyReason: "country_unspecified",
      message: EMPTY_MESSAGE[locale].country_unspecified,
    };
  }

  if (input.offers.length === 0) {
    return {
      country,
      locale,
      offers: [],
      preferred: null,
      commerce,
      regionUnavailable: false,
      inventedInventory: false,
      emptyReason: "no_offers",
      message: EMPTY_MESSAGE[locale].no_offers,
    };
  }

  const regional = input.offers.filter(
    (o) =>
      o.active !== false &&
      o.retailerCountry === country &&
      o.shipsToCountries.includes(country),
  );

  if (regional.length === 0) {
    return {
      country,
      locale,
      offers: [],
      preferred: null,
      commerce,
      regionUnavailable: true,
      inventedInventory: false,
      emptyReason: "region_unavailable",
      message: EMPTY_MESSAGE[locale].region_unavailable,
    };
  }

  const views = regional.map((o) => toView(o, country, locale));
  const preferred =
    (input.preferredOfferId
      ? views.find((v) => v.offerId === input.preferredOfferId)
      : null) ??
    views.find((v) => v.stockStatus === "in_stock" && v.purchaseUrl) ??
    views.find((v) => v.isOfficial === true) ??
    views[0] ??
    null;

  return {
    country,
    locale,
    offers: views,
    preferred,
    commerce,
    regionUnavailable: false,
    inventedInventory: false,
    emptyReason: null,
    message: "",
  };
}

export function commerceStatusMessage(
  status: CommerceStatus,
  locale: OfferLocale,
): string {
  const map: Record<OfferLocale, Record<CommerceStatus, string>> = {
    ko: {
      in_stock: "현재 구매 가능",
      out_of_stock: "현재 품절",
      availability_unknown: "판매 상태 확인 중",
      discontinued: "단종",
      region_unavailable: "이 지역에서 판매처 미확인",
    },
    ja: {
      in_stock: "購入可能",
      out_of_stock: "売り切れ",
      availability_unknown: "販売状況確認中",
      discontinued: "販売終了",
      region_unavailable: "この地域では販売先未確認",
    },
    en: {
      in_stock: "Available to purchase",
      out_of_stock: "Currently out of stock",
      availability_unknown: "Availability being confirmed",
      discontinued: "Discontinued",
      region_unavailable: "No retailer confirmed for this region",
    },
  };
  return map[locale][status];
}
