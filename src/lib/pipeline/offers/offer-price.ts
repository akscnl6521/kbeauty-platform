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

/**
 * 실제 판매가로 보기 어려운 자리표시 가격인지 본다.
 *
 * 브랜드 소개용 쇼핑몰은 결제를 다른 몰로 넘기면서 상품 가격 칸을 100원 같은
 * 최소값으로 채워두는 일이 흔하다. 2026-07-27 miseenscene.com 이 헤어젤과
 * 트리트먼트를 **둘 다 100원**으로 게시하고 있었다. 그 값을 그대로 검증하면
 * 사용자에게 존재하지 않는 가격을 보여주게 된다 (§5-3).
 *
 * 여기서 «비싸다/싸다» 를 판단하지 않는다. 화장품 소매가가 도달할 수 없는
 * 구간인지만 본다. 걸리면 거절이 아니라 **검증 보류** 로 보내 사람이 본다 —
 * 값이 진짜라면 사람이 통과시키면 된다.
 */
export function isImplausibleRetailPrice(
  price: number | null | undefined,
  currency: OfferCurrency | null | undefined
): boolean {
  if (price == null || !Number.isFinite(price) || price <= 0) return false;
  // 국내 화장품 단품이 1,000원 미만으로 정식 판매되는 경우는 사실상 없다.
  if (currency === "KRW") return price < 1000;
  if (currency === "JPY") return price < 100;
  if (currency === "USD") return price < 1;
  return false;
}

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

  const currency =
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
