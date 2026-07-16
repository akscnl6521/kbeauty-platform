/**
 * Price / currency parsing for offers (schema: KRW|USD|JPY only).
 */

export type OfferCurrency = "KRW" | "USD" | "JPY";

export type ParsedPrice = {
  price: number | null;
  currency: OfferCurrency | null;
  salePrice: number | null;
  regularPrice: number | null;
  confidence: number;
  reasons: string[];
};

function detectCurrency(raw: string): OfferCurrency | null {
  if (/₩|KRW|원/i.test(raw)) return "KRW";
  if (/¥|JPY|円/i.test(raw) && !/\$/.test(raw)) return "JPY";
  if (/\$|USD/i.test(raw)) return "USD";
  const iso = raw.trim().toUpperCase();
  if (iso === "KRW" || iso === "USD" || iso === "JPY") return iso;
  return null;
}

function parseNumberLocale(raw: string, currency: OfferCurrency | null): number | null {
  const cleaned = raw.replace(/[^\d.,\-]/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;

  // KRW/JPY: usually no decimal cents in retail display
  if (currency === "KRW" || currency === "JPY") {
    const digits = cleaned.replace(/[.,]/g, "");
    const n = Number(digits);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // USD: prefer last dot as decimal
  if (/,/.test(cleaned) && /\./.test(cleaned)) {
    const n = Number(cleaned.replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    const n = Number(cleaned.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    const n = Number(cleaned.replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const n = Number(cleaned.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseOfferPrice(input: {
  priceText?: string | null;
  currencyHint?: string | null;
  salePriceText?: string | null;
  regularPriceText?: string | null;
}): ParsedPrice {
  const reasons: string[] = [];
  const blob = [
    input.priceText,
    input.salePriceText,
    input.regularPriceText,
    input.currencyHint,
  ]
    .filter(Boolean)
    .join(" ");

  let currency =
    detectCurrency(input.currencyHint ?? "") ||
    detectCurrency(blob) ||
    null;

  const sale = input.salePriceText
    ? parseNumberLocale(input.salePriceText, currency)
    : null;
  const regular = input.regularPriceText
    ? parseNumberLocale(input.regularPriceText, currency)
    : null;
  const main = input.priceText
    ? parseNumberLocale(input.priceText, currency)
    : null;

  const price = sale ?? main ?? regular;
  if (price == null) {
    reasons.push("price_missing_or_unparseable");
    return {
      price: null,
      currency,
      salePrice: sale,
      regularPrice: regular,
      confidence: 0.1,
      reasons,
    };
  }
  if (!currency) {
    reasons.push("currency_missing");
    return {
      price,
      currency: null,
      salePrice: sale,
      regularPrice: regular,
      confidence: 0.35,
      reasons,
    };
  }
  reasons.push("price_parsed");
  return {
    price,
    currency,
    salePrice: sale,
    regularPrice: regular,
    confidence: sale && regular ? 0.85 : 0.75,
    reasons,
  };
}

/** Map app countries to schema retailer_country. */
export function toSchemaRetailerCountry(
  code: string | null | undefined
): "KR" | "US" | "JP" | "GLOBAL" {
  const c = (code ?? "").toUpperCase();
  if (c === "KR" || c === "US" || c === "JP") return c;
  return "GLOBAL";
}
