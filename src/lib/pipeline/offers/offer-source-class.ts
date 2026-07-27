/**
 * Offer retailer authority grades (no inventing official status).
 */

export type OfferSourceGrade =
  | "official_brand_store"
  | "official_country_store"
  | "authorized_retailer"
  | "marketplace_official_store"
  | "retailer_unverified"
  | "marketplace_seller";

const MARKETPLACE_HOSTS =
  /(amazon\.|amzn\.|ebay\.|shopee\.|lazada\.|tmall\.|aliexpress\.|coupang\.|qoo10\.|rakuten\.|walmart\.|target\.com)/i;

const SOCIAL_HOSTS =
  /(instagram\.|facebook\.|tiktok\.|youtube\.|twitter\.|x\.com|linktr\.ee)/i;

export function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * 두 URL 이 같은 상품 페이지를 가리키는지 본다.
 *
 * 한글 상품명이 URL 에 들어가는 국내 쇼핑몰에서는 같은 페이지가 인코딩된
 * 형태와 디코딩된 형태로 동시에 돌아다닌다. 예를 들어 JSON-LD 는
 * `/product/하이드로-lpp-.../13/` 를, 저장된 값은 `/product/%ED%95%98...%2F13/`
 * 를 갖는다. 문자열을 그대로 비교하면 같은 페이지를 다른 페이지로 본다.
 */
export function isSameProductPage(a: string, b: string): boolean {
  const canon = (raw: string): string | null => {
    try {
      const u = new URL(raw);
      let path = u.pathname;
      try {
        path = decodeURIComponent(path);
      } catch {
        // 잘못된 인코딩이면 원문 경로를 그대로 쓴다.
      }
      return (
        u.hostname.replace(/^www\./i, "").toLowerCase() +
        path.replace(/\/+$/, "").toLowerCase()
      );
    } catch {
      return null;
    }
  };
  const ca = canon(a);
  const cb = canon(b);
  return ca != null && ca === cb;
}

export function classifyOfferSource(input: {
  purchaseUrl: string;
  isOfficialClaim?: boolean;
  sameAsOfficialBrandHost?: boolean;
  brandConfirmedRetailer?: boolean;
  marketplaceOfficialStoreEvidence?: boolean;
}): { grade: OfferSourceGrade; confidence: number; reasons: string[] } {
  const host = hostFromUrl(input.purchaseUrl);
  const reasons: string[] = [];
  if (!host) {
    return { grade: "retailer_unverified", confidence: 0.1, reasons: ["bad_url"] };
  }
  if (SOCIAL_HOSTS.test(host)) {
    return {
      grade: "marketplace_seller",
      confidence: 0.95,
      reasons: ["social_or_aggregator"],
    };
  }

  if (input.sameAsOfficialBrandHost || input.isOfficialClaim) {
    reasons.push("official_brand_host");
    return { grade: "official_brand_store", confidence: 0.95, reasons };
  }

  if (input.brandConfirmedRetailer) {
    reasons.push("brand_confirmed_retailer");
    return { grade: "authorized_retailer", confidence: 0.85, reasons };
  }

  if (MARKETPLACE_HOSTS.test(host)) {
    if (input.marketplaceOfficialStoreEvidence) {
      reasons.push("marketplace_official_store_evidence");
      return {
        grade: "marketplace_official_store",
        confidence: 0.75,
        reasons,
      };
    }
    reasons.push("marketplace_without_official_evidence");
    return { grade: "marketplace_seller", confidence: 0.9, reasons };
  }

  reasons.push("unknown_retailer");
  return { grade: "retailer_unverified", confidence: 0.4, reasons };
}

export function canAutoPersistOffer(grade: OfferSourceGrade): boolean {
  return (
    grade === "official_brand_store" ||
    grade === "official_country_store" ||
    grade === "authorized_retailer" ||
    grade === "marketplace_official_store"
  );
}

export function canAutoVerifyOffer(grade: OfferSourceGrade): boolean {
  return (
    grade === "official_brand_store" ||
    grade === "official_country_store" ||
    grade === "authorized_retailer"
  );
}
