/**
 * 국가별 구매 링크 선택.
 * - 사용자가 선택한 배송 국가(KR/US/JP)를 우선한다.
 * - unverified / invalid / unavailable 은 핵심 구매 버튼에서 제외한다.
 * - KR에서 Amazon US를 기본 구매처로 쓰지 않는다.
 */

export type ShippingCountry = "KR" | "US" | "JP";
export type RetailerCountry = "KR" | "US" | "JP" | "GLOBAL";
export type LinkVerificationStatus =
  | "verified"
  | "unverified"
  | "invalid"
  | "unavailable";

/** 구매처 offer 통화 — 환율 변환용 아님 */
export type OfferCurrency = "KRW" | "USD" | "JPY";

/** 관리자 검증·향후 주기 검사용 구매 링크 단위 */
export type PurchaseLink = {
  retailerName: string;
  purchaseUrl: string;
  retailerCountry: RetailerCountry;
  shipsToCountries: ShippingCountry[];
  verificationStatus: LinkVerificationStatus;
  /** 해당 판매처 offer 가격 (제품 기본 price_usd 아님) */
  price?: number;
  currency?: OfferCurrency;
  verifiedAt?: string;
  isOfficial?: boolean;
  /** 재고 — product_offers / 핵심 추천 재검증용 */
  stockStatus?: "in_stock" | "out_of_stock" | "unknown";
  active?: boolean;
  /** 레거시 컬럼명 등 (감사 로그용) */
  sourceField?: string;
};

export type PurchaseLinkSelection = {
  url: string;
  marketplace: string;
  retailerName: string;
  verificationStatus: LinkVerificationStatus;
  /** offer 가격 — 없으면 가격 정보 없음 */
  price?: number;
  currency?: OfferCurrency;
  verifiedAt?: string;
  /** 표시용 — 선택 로직 불변, UI locale 변환에만 사용 */
  retailerCountry?: RetailerCountry;
  isOfficial?: boolean;
  /** 개발 로그용 선택 이유 */
  reason: string;
};

/** 레거시 CandidateProduct 링크 컬럼 (하위 호환) */
export type LegacyPurchaseLinkFields = {
  link_sephora?: string | null;
  link_amazon_us?: string | null;
  link_amazon_jp?: string | null;
  link_qoo10?: string | null;
  link_oliveyoung?: string | null;
  link_coupang?: string | null;
  link_yesstyle?: string | null;
  /** 선택: 관리자가 검증한 구조화 링크 배열 */
  purchase_links?: PurchaseLink[] | null;
};

const SHIPPING_COUNTRIES: readonly ShippingCountry[] = ["KR", "US", "JP"];

export function normalizeShippingCountry(
  value: string | null | undefined
): ShippingCountry | null {
  if (!value || typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  if ((SHIPPING_COUNTRIES as readonly string[]).includes(code)) {
    return code as ShippingCountry;
  }
  return null;
}

function currencyForRetailerCountry(
  country: RetailerCountry
): OfferCurrency | undefined {
  if (country === "KR") return "KRW";
  if (country === "US") return "USD";
  if (country === "JP") return "JPY";
  return undefined;
}

function parseOfferPrice(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return undefined;
}

function parseOfferCurrency(value: unknown): OfferCurrency | undefined {
  if (typeof value !== "string") return undefined;
  const c = value.trim().toUpperCase();
  if (c === "KRW" || c === "USD" || c === "JPY") return c;
  return undefined;
}

/** 화면 표시용 offer 가격 포맷 (환율 변환 없음) */
export function formatOfferPrice(
  price: number | undefined,
  currency: OfferCurrency | undefined,
  locale: "en" | "ja" | "ko" = "ko"
): string {
  if (
    price == null ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !currency
  ) {
    return locale === "ko"
      ? "가격 정보 없음"
      : locale === "ja"
        ? "価格情報なし"
        : "Price unavailable";
  }

  if (currency === "KRW") {
    return `₩${Math.round(price).toLocaleString("ko-KR")}`;
  }
  if (currency === "JPY") {
    return `¥${Math.round(price).toLocaleString("ja-JP")}`;
  }
  return `$${price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function looksLikePlaceholderUrl(url: string): boolean {
  const lower = url.toLowerCase();
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (
    host === "example.com" ||
    host.endsWith(".example") ||
    host === "localhost" ||
    host === "127.0.0.1"
  ) {
    return true;
  }
  if (
    lower.includes("placeholder") ||
    lower.includes("/sample") ||
    lower.includes("example-product") ||
    lower.includes("lorem")
  ) {
    return true;
  }
  return false;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return "";
  }
}

/** 깨진/불완전 Amazon URL 휴리스틱 (실시간 HEAD 요청 없음) */
function isWeakAmazonUrl(url: string): boolean {
  const host = hostOf(url);
  const path = pathOf(url);
  const isAmazon =
    host.includes("amazon.") ||
    host.endsWith("amzn.to") ||
    host.includes("a.co");
  if (!isAmazon) return false;
  // 단축/루트만 있으면 상품 페이지로 보지 않음
  if (host.endsWith("amzn.to") || host === "a.co" || host.endsWith("amzn.com")) {
    return true;
  }
  if (path === "/" || path === "") return true;
  // /dp/ASIN 또는 /gp/product/ASIN 형태가 아니면 약함
  const hasDp = /\/(dp|gp\/product)\/[a-z0-9]{8,}/i.test(path);
  return !hasDp;
}

type TrustedChannel = {
  matchHost: (host: string) => boolean;
  retailerName: string;
  retailerCountry: RetailerCountry;
  shipsToCountries: ShippingCountry[];
  /** MVP: 관리자 신뢰 채널 — verified로 취급 (Amazon 제외) */
  treatAsVerified: boolean;
  isOfficial?: boolean;
};

const TRUSTED_CHANNELS: TrustedChannel[] = [
  {
    matchHost: (h) =>
      h.includes("oliveyoung.") || h.includes("global.oliveyoung."),
    retailerName: "Olive Young",
    retailerCountry: "KR",
    shipsToCountries: ["KR"],
    treatAsVerified: true,
  },
  {
    matchHost: (h) => h.includes("coupang."),
    retailerName: "Coupang",
    retailerCountry: "KR",
    shipsToCountries: ["KR"],
    treatAsVerified: true,
  },
  {
    matchHost: (h) => h.includes("sephora."),
    retailerName: "Sephora",
    retailerCountry: "US",
    shipsToCountries: ["US"],
    treatAsVerified: true,
  },
  {
    matchHost: (h) => h.includes("yesstyle."),
    retailerName: "YesStyle",
    retailerCountry: "GLOBAL",
    shipsToCountries: ["US", "JP"],
    treatAsVerified: true,
  },
  {
    matchHost: (h) => h.includes("qoo10."),
    retailerName: "Qoo10",
    retailerCountry: "JP",
    shipsToCountries: ["JP"],
    treatAsVerified: true,
  },
  {
    matchHost: (h) => h.includes("rakuten."),
    retailerName: "Rakuten",
    retailerCountry: "JP",
    shipsToCountries: ["JP"],
    treatAsVerified: true,
  },
];

function normalizePurchaseLinkRecord(raw: unknown): PurchaseLink | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const urlRaw =
    (typeof row.purchaseUrl === "string" && row.purchaseUrl) ||
    (typeof row.purchase_url === "string" && row.purchase_url) ||
    (typeof row.url === "string" && row.url) ||
    "";
  const url = urlRaw.trim();
  if (!url || !isSafeHttpUrl(url) || looksLikePlaceholderUrl(url)) {
    return {
      retailerName:
        typeof row.retailerName === "string"
          ? row.retailerName
          : typeof row.retailer_name === "string"
            ? row.retailer_name
            : "Unknown",
      purchaseUrl: url || "",
      retailerCountry: "GLOBAL",
      shipsToCountries: [],
      verificationStatus: "invalid",
      sourceField: "purchase_links",
    };
  }

  const retailerName =
    (typeof row.retailerName === "string" && row.retailerName.trim()) ||
    (typeof row.retailer_name === "string" && row.retailer_name.trim()) ||
    "Retailer";

  const retailerCountryRaw = String(
    row.retailerCountry ?? row.retailer_country ?? "GLOBAL"
  )
    .trim()
    .toUpperCase();
  const retailerCountry: RetailerCountry =
    retailerCountryRaw === "KR" ||
    retailerCountryRaw === "US" ||
    retailerCountryRaw === "JP" ||
    retailerCountryRaw === "GLOBAL"
      ? retailerCountryRaw
      : "GLOBAL";

  const shipsRaw = row.shipsToCountries ?? row.ships_to_countries;
  const shipsToCountries = Array.isArray(shipsRaw)
    ? shipsRaw
        .map((c) => normalizeShippingCountry(String(c)))
        .filter((c): c is ShippingCountry => c != null)
    : [];

  const statusRaw = String(
    row.verificationStatus ?? row.verification_status ?? "unverified"
  )
    .trim()
    .toLowerCase();
  const verificationStatus: LinkVerificationStatus =
    statusRaw === "verified" ||
    statusRaw === "unverified" ||
    statusRaw === "invalid" ||
    statusRaw === "unavailable"
      ? statusRaw
      : "unverified";

  const verifiedAt =
    typeof row.verifiedAt === "string"
      ? row.verifiedAt
      : typeof row.verified_at === "string"
        ? row.verified_at
        : undefined;

  const isOfficial =
    typeof row.isOfficial === "boolean"
      ? row.isOfficial
      : typeof row.is_official === "boolean"
        ? row.is_official
        : undefined;

  // offer 가격만 사용 — product.price_usd 와 연결하지 않음
  const price = parseOfferPrice(row.price ?? row.offer_price ?? row.offerPrice);
  const currencyExplicit = parseOfferCurrency(
    row.currency ?? row.offer_currency ?? row.offerCurrency
  );
  const currency =
    currencyExplicit ??
    (price != null ? currencyForRetailerCountry(retailerCountry) : undefined);

  return {
    retailerName,
    purchaseUrl: url,
    retailerCountry,
    shipsToCountries:
      shipsToCountries.length > 0
        ? shipsToCountries
        : retailerCountry === "GLOBAL"
          ? []
          : [retailerCountry as ShippingCountry],
    verificationStatus,
    ...(price != null ? { price } : {}),
    ...(currency ? { currency } : {}),
    ...(verifiedAt ? { verifiedAt } : {}),
    ...(isOfficial !== undefined ? { isOfficial } : {}),
    sourceField: "purchase_links",
  };
}

function linkFromLegacyField(
  field: string,
  raw: string | null | undefined,
  defaults: {
    retailerName: string;
    retailerCountry: RetailerCountry;
    shipsToCountries: ShippingCountry[];
  }
): PurchaseLink | null {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  if (!url) return null;
  if (!isSafeHttpUrl(url) || looksLikePlaceholderUrl(url)) {
    return {
      ...defaults,
      purchaseUrl: url,
      verificationStatus: "invalid",
      sourceField: field,
    };
  }

  const host = hostOf(url);
  const trusted = TRUSTED_CHANNELS.find((c) => c.matchHost(host));

  // Amazon: 기본 unverified. 약하면 invalid.
  if (field === "link_amazon_us" || field === "link_amazon_jp") {
    if (isWeakAmazonUrl(url)) {
      return {
        retailerName: defaults.retailerName,
        purchaseUrl: url,
        retailerCountry: defaults.retailerCountry,
        shipsToCountries: defaults.shipsToCountries,
        verificationStatus: "invalid",
        sourceField: field,
      };
    }
    return {
      retailerName: defaults.retailerName,
      purchaseUrl: url,
      retailerCountry: defaults.retailerCountry,
      shipsToCountries: defaults.shipsToCountries,
      verificationStatus: "unverified",
      sourceField: field,
    };
  }

  if (trusted) {
    return {
      retailerName: trusted.retailerName,
      purchaseUrl: url,
      retailerCountry: trusted.retailerCountry,
      shipsToCountries: trusted.shipsToCountries,
      verificationStatus: trusted.treatAsVerified ? "verified" : "unverified",
      isOfficial: trusted.isOfficial,
      sourceField: field,
    };
  }

  // 알 수 없는 호스트 → unverified (핵심 버튼 제외)
  return {
    retailerName: defaults.retailerName,
    purchaseUrl: url,
    retailerCountry: defaults.retailerCountry,
    shipsToCountries: defaults.shipsToCountries,
    verificationStatus: "unverified",
    sourceField: field,
  };
}

/**
 * 제품의 레거시 컬럼 + 선택적 purchase_links 를 통일된 배열로 만든다.
 */
export function buildPurchaseLinksFromProduct(
  product: LegacyPurchaseLinkFields
): PurchaseLink[] {
  const out: PurchaseLink[] = [];

  if (Array.isArray(product.purchase_links)) {
    for (const item of product.purchase_links) {
      const normalized = normalizePurchaseLinkRecord(item);
      if (normalized) out.push(normalized);
    }
  }

  const legacySpecs: {
    field: keyof LegacyPurchaseLinkFields;
    retailerName: string;
    retailerCountry: RetailerCountry;
    shipsToCountries: ShippingCountry[];
  }[] = [
    {
      field: "link_oliveyoung",
      retailerName: "Olive Young",
      retailerCountry: "KR",
      shipsToCountries: ["KR"],
    },
    {
      field: "link_coupang",
      retailerName: "Coupang",
      retailerCountry: "KR",
      shipsToCountries: ["KR"],
    },
    {
      field: "link_sephora",
      retailerName: "Sephora",
      retailerCountry: "US",
      shipsToCountries: ["US"],
    },
    {
      field: "link_yesstyle",
      retailerName: "YesStyle",
      retailerCountry: "GLOBAL",
      shipsToCountries: ["US", "JP"],
    },
    {
      field: "link_amazon_us",
      retailerName: "Amazon US",
      retailerCountry: "US",
      shipsToCountries: ["US"],
    },
    {
      field: "link_amazon_jp",
      retailerName: "Amazon JP",
      retailerCountry: "JP",
      shipsToCountries: ["JP"],
    },
    {
      field: "link_qoo10",
      retailerName: "Qoo10",
      retailerCountry: "JP",
      shipsToCountries: ["JP"],
    },
  ];

  for (const spec of legacySpecs) {
    const raw = product[spec.field];
    if (typeof raw !== "string" && raw != null) continue;
    const link = linkFromLegacyField(spec.field, raw as string | null, {
      retailerName: spec.retailerName,
      retailerCountry: spec.retailerCountry,
      shipsToCountries: spec.shipsToCountries,
    });
    if (link) out.push(link);
  }

  return out;
}

function shipsTo(link: PurchaseLink, country: ShippingCountry): boolean {
  if (link.shipsToCountries.includes(country)) return true;
  // GLOBAL 이지만 shipsTo가 비어 있으면 국가 미확정 → 허용하지 않음
  return false;
}

/** 국가별 판매처 우선순위 (낮을수록 우선) */
function priorityScore(link: PurchaseLink, country: ShippingCountry): number {
  const name = link.retailerName.toLowerCase();
  const officialBoost = link.isOfficial ? -100 : 0;

  if (country === "KR") {
    if (link.isOfficial && link.retailerCountry === "KR") return 0 + officialBoost;
    if (name.includes("olive young")) return 10;
    if (name.includes("coupang")) return 20;
    if (link.retailerCountry === "KR") return 30;
    if (link.retailerCountry === "GLOBAL" && shipsTo(link, "KR")) return 40;
    return 90;
  }

  if (country === "US") {
    if (link.isOfficial && link.retailerCountry === "US") return 0 + officialBoost;
    if (name.includes("amazon") && link.retailerCountry === "US") return 10;
    if (name.includes("sephora")) return 20;
    if (name.includes("yesstyle")) return 30;
    if (link.retailerCountry === "GLOBAL" && shipsTo(link, "US")) return 40;
    return 90;
  }

  // JP
  if (link.isOfficial && link.retailerCountry === "JP") return 0 + officialBoost;
  if (name.includes("amazon") && link.retailerCountry === "JP") return 10;
  if (name.includes("rakuten")) return 20;
  if (name.includes("qoo10")) return 30;
  if (link.retailerCountry === "JP") return 40;
  if (link.retailerCountry === "GLOBAL" && shipsTo(link, "JP")) return 50;
  return 90;
}

export type SelectPurchaseLinkDebug = {
  country: ShippingCountry | null;
  considered: number;
  excluded: { retailerName: string; reason: string }[];
  selected: PurchaseLinkSelection | null;
};

/**
 * 국가와 구매 링크 배열을 받아 가장 적합한 verified 링크 1개를 반환한다.
 * 없으면 null. 다른 국가 링크로 폴백하지 않는다.
 */
export function selectPurchaseLinkForCountry(
  links: PurchaseLink[],
  country: ShippingCountry | string | null | undefined
): PurchaseLinkSelection | null {
  const result = selectPurchaseLinkForCountryWithDebug(links, country);
  return result.selected;
}

export function selectPurchaseLinkForCountryWithDebug(
  links: PurchaseLink[],
  country: ShippingCountry | string | null | undefined
): SelectPurchaseLinkDebug {
  const shipping = normalizeShippingCountry(
    typeof country === "string" ? country : country ?? null
  );
  const excluded: { retailerName: string; reason: string }[] = [];

  if (!shipping) {
    return {
      country: null,
      considered: links.length,
      excluded: [
        {
          retailerName: "*",
          reason: "shipping country not KR/US/JP — no selection",
        },
      ],
      selected: null,
    };
  }

  const eligible: PurchaseLink[] = [];

  for (const link of links) {
    if (!link.purchaseUrl || !isSafeHttpUrl(link.purchaseUrl)) {
      excluded.push({
        retailerName: link.retailerName,
        reason: "unsafe or empty url",
      });
      continue;
    }
    if (looksLikePlaceholderUrl(link.purchaseUrl)) {
      excluded.push({
        retailerName: link.retailerName,
        reason: "placeholder/sample url",
      });
      continue;
    }
    if (link.verificationStatus === "invalid") {
      excluded.push({
        retailerName: link.retailerName,
        reason: "status=invalid",
      });
      continue;
    }
    if (link.verificationStatus === "unavailable") {
      excluded.push({
        retailerName: link.retailerName,
        reason: "status=unavailable",
      });
      continue;
    }
    if (link.verificationStatus === "unverified") {
      excluded.push({
        retailerName: link.retailerName,
        reason: "status=unverified (excluded from core CTA)",
      });
      continue;
    }
    if (link.verificationStatus !== "verified") {
      excluded.push({
        retailerName: link.retailerName,
        reason: `unknown status=${link.verificationStatus}`,
      });
      continue;
    }
    // 가격이 명시된 경우 0 이하는 CTA에서 제외 (미확인은 허용하되 가격 미표시)
    if (typeof link.price === "number" && link.price <= 0) {
      excluded.push({
        retailerName: link.retailerName,
        reason: "price <= 0",
      });
      continue;
    }
    if (!shipsTo(link, shipping)) {
      excluded.push({
        retailerName: link.retailerName,
        reason: `does not ship to ${shipping}`,
      });
      continue;
    }
    // 국가 일치: GLOBAL 및 타국 판매처는 해당 배송국에서 제외
    if (link.retailerCountry !== shipping) {
      excluded.push({
        retailerName: link.retailerName,
        reason: `retailerCountry ${link.retailerCountry} !== ${shipping}`,
      });
      continue;
    }

    eligible.push(link);
  }

  eligible.sort(
    (a, b) => priorityScore(a, shipping) - priorityScore(b, shipping)
  );

  const best = eligible[0];
  if (!best) {
    return {
      country: shipping,
      considered: links.length,
      excluded,
      selected: null,
    };
  }

  const selected: PurchaseLinkSelection = {
    url: best.purchaseUrl.trim(),
    marketplace: best.retailerName,
    retailerName: best.retailerName,
    verificationStatus: best.verificationStatus,
    ...(best.price != null ? { price: best.price } : {}),
    ...(best.currency ? { currency: best.currency } : {}),
    ...(best.verifiedAt ? { verifiedAt: best.verifiedAt } : {}),
    retailerCountry: best.retailerCountry,
    ...(best.isOfficial !== undefined ? { isOfficial: best.isOfficial } : {}),
    reason: `best verified for ${shipping} via ${best.sourceField ?? "purchase_links"}`,
  };

  return {
    country: shipping,
    considered: links.length,
    excluded,
    selected,
  };
}

/**
 * CandidateProduct(레거시 컬럼) → 국가별 구매 링크 선택.
 * 기존 호출부 호환용 래퍼.
 */
export function selectPurchaseLink(
  product: LegacyPurchaseLinkFields,
  countryCode: string | null | undefined
): PurchaseLinkSelection | null {
  const links = buildPurchaseLinksFromProduct(product);
  const debug = selectPurchaseLinkForCountryWithDebug(links, countryCode);

  if (process.env.NODE_ENV === "development") {
    console.log("[purchaseLinkSelect]", {
      country: debug.country,
      considered: debug.considered,
      selected: debug.selected
        ? {
            marketplace: debug.selected.marketplace,
            reason: debug.selected.reason,
            status: debug.selected.verificationStatus,
          }
        : null,
      excludedSample: debug.excluded.slice(0, 8),
    });
  }

  return debug.selected;
}
