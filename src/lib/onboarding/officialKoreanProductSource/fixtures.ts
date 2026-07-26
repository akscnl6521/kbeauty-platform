/**
 * Offline fixtures for P3-T01 official Korean product source onboarding.
 * All fixtures are non-public. Never claim as live catalog.
 */

import { SAFE_ENDPOINT_NOTE } from "./constants";
import type {
  OfficialKrProductPageFetcher,
  OfficialKrProductRawItem,
} from "./types";

const NOW_FRESH = "2026-07-20T00:00:00.000Z";
const NOW_STALE = "2025-10-01T00:00:00.000Z";
const NOW_REFRESH = "2026-06-01T00:00:00.000Z";

export function createOfficialKrProductFixtures(): OfficialKrProductRawItem[] {
  const officialComplete: OfficialKrProductRawItem = {
    sourceId: "kr-brand-official",
    sourceKind: "brand_official_page",
    accessMode: "public_https",
    sourceTier: 1,
    brandOfficialUrl: "https://brand-official.example/products/centella-serum",
    officialMallUrl: "https://mall.official.example/kr/centella-serum-30ml",
    inciDisclosureUrl:
      "https://brand-official.example/products/centella-serum/ingredients",
    brandName: "Example Lab",
    productNameKo: "센텔라 세럼",
    productNameEn: "Centella Serum",
    category: "serum",
    fullIngredients:
      "Water, Centella Asiatica Extract, Glycerin, Butylene Glycol",
    volumeLabel: "30ml",
    variants: [
      {
        variantId: "var-30",
        sizeLabel: "30ml",
        shadeLabel: null,
        sku: "EX-CEN-30",
        barcode: null,
      },
      {
        variantId: "var-50",
        sizeLabel: "50ml",
        shadeLabel: null,
        sku: "EX-CEN-50",
        barcode: null,
      },
    ],
    images: [
      {
        imageId: "img-hero",
        sourceUrl: "https://brand-official.example/img/centella-hero.jpg",
        role: "hero",
        rightsStatus: "official_remote_use",
        verified: true,
      },
      {
        imageId: "img-inci",
        sourceUrl: "https://brand-official.example/img/centella-inci.jpg",
        role: "ingredient_label",
        rightsStatus: "official_remote_use",
        verified: true,
      },
    ],
    offers: [
      {
        offerId: "off-official",
        retailerName: "Example Lab Official KR",
        retailerType: "official_mall",
        retailerCountry: "KR",
        shipsToCountries: ["KR"],
        purchaseUrl: "https://mall.official.example/kr/centella-serum-30ml",
        price: 28000,
        currency: "KRW",
        stockStatus: "in_stock",
        isOfficial: true,
        lastCheckedAt: NOW_FRESH,
      },
    ],
    usageGuidance: {
      amountHint: "2-3 drops",
      orderHint: "after toner",
      frequencyHint: "AM/PM",
      cautions: ["patch test if sensitive"],
      patchTestRecommended: true,
      sourceUrl: "https://brand-official.example/products/centella-serum/how-to",
      complete: true,
    },
    sourceVerifiedAt: NOW_FRESH,
    isFixture: false,
  };

  /** Intentional duplicate of officialComplete (same brand+name+volume). */
  const officialDuplicate: OfficialKrProductRawItem = {
    ...officialComplete,
    sourceId: "kr-official-mall",
    sourceKind: "official_kr_mall_page",
    brandOfficialUrl: officialComplete.brandOfficialUrl,
  };

  const fixtureOffline: OfficialKrProductRawItem = {
    sourceId: "kr-fixture-offline",
    sourceKind: "fixture_offline",
    accessMode: "offline_fixture",
    sourceTier: 4,
    brandOfficialUrl: "https://fixture.local/products/green-tea-toner",
    officialMallUrl: null,
    inciDisclosureUrl: "https://fixture.local/products/green-tea-toner/inci",
    brandName: "Fixture Brand",
    productNameKo: "녹차 토너",
    productNameEn: "Green Tea Toner",
    category: "toner",
    fullIngredients: "Water, Camellia Sinensis Leaf Extract, Glycerin",
    volumeLabel: "150ml",
    variants: [
      {
        variantId: "fx-var-150",
        sizeLabel: "150ml",
        shadeLabel: null,
        sku: null,
        barcode: null,
      },
    ],
    images: [
      {
        imageId: "fx-img",
        sourceUrl: null,
        role: "hero",
        rightsStatus: "unknown",
        verified: false,
      },
    ],
    offers: [],
    usageGuidance: {
      amountHint: null,
      orderHint: null,
      frequencyHint: null,
      cautions: [],
      patchTestRecommended: null,
      sourceUrl: null,
      complete: false,
    },
    sourceVerifiedAt: NOW_FRESH,
    isFixture: true,
  };

  const marketplaceOnly: OfficialKrProductRawItem = {
    sourceId: "kr-marketplace",
    sourceKind: "marketplace_listing",
    accessMode: "public_https",
    sourceTier: 3,
    brandOfficialUrl: null,
    officialMallUrl: null,
    inciDisclosureUrl: null,
    brandName: "Market Only Brand",
    productNameKo: "마켓 단독 크림",
    productNameEn: null,
    category: "cream",
    fullIngredients: null,
    volumeLabel: "50ml",
    variants: [],
    images: [],
    offers: [
      {
        offerId: "off-mkt",
        retailerName: "Some Marketplace",
        retailerType: "marketplace",
        retailerCountry: "KR",
        shipsToCountries: ["KR"],
        purchaseUrl: "https://marketplace.example/item/123",
        price: 19900,
        currency: "KRW",
        stockStatus: "in_stock",
        isOfficial: false,
        lastCheckedAt: NOW_FRESH,
      },
    ],
    usageGuidance: null,
    sourceVerifiedAt: NOW_FRESH,
    isFixture: false,
  };

  const paidApiBlocked: OfficialKrProductRawItem = {
    sourceId: "kr-paid-api-blocked",
    sourceKind: "partner_feed",
    accessMode: "blocked_paid_api",
    sourceTier: 3,
    brandOfficialUrl: null,
    officialMallUrl: null,
    inciDisclosureUrl: null,
    brandName: "Paid Feed Brand",
    productNameKo: "유료피드 제품",
    productNameEn: null,
    category: null,
    fullIngredients: null,
    volumeLabel: null,
    variants: [],
    images: [],
    offers: [],
    usageGuidance: null,
    sourceVerifiedAt: null,
    isFixture: false,
  };

  const captchaBlocked: OfficialKrProductRawItem = {
    sourceId: "kr-captcha-blocked",
    sourceKind: "brand_official_page",
    accessMode: "blocked_captcha",
    sourceTier: 1,
    brandOfficialUrl: "https://captcha.example/product",
    officialMallUrl: null,
    inciDisclosureUrl: null,
    brandName: "Captcha Brand",
    productNameKo: "캡차 제품",
    productNameEn: null,
    category: "serum",
    fullIngredients: "Water",
    volumeLabel: "30ml",
    variants: [],
    images: [],
    offers: [],
    usageGuidance: null,
    sourceVerifiedAt: NOW_FRESH,
    isFixture: false,
  };

  const inventedPrice: OfficialKrProductRawItem = {
    sourceId: "kr-brand-official",
    sourceKind: "brand_official_page",
    accessMode: "public_https",
    sourceTier: 1,
    brandOfficialUrl: "https://brand-official.example/products/invented-price",
    officialMallUrl: null,
    inciDisclosureUrl:
      "https://brand-official.example/products/invented-price/inci",
    brandName: "Invent Brand",
    productNameKo: "발명가격 세럼",
    productNameEn: null,
    category: "serum",
    fullIngredients: "Water, Glycerin",
    volumeLabel: "30ml",
    variants: [],
    images: [],
    offers: [
      {
        offerId: "off-invented",
        retailerName: "Unknown Shop",
        retailerType: "unknown",
        retailerCountry: null,
        shipsToCountries: [],
        purchaseUrl: null,
        price: 12345,
        currency: "KRW",
        stockStatus: "in_stock",
        isOfficial: false,
        lastCheckedAt: null,
      },
    ],
    usageGuidance: null,
    sourceVerifiedAt: NOW_FRESH,
    isFixture: false,
    forceBlockReason: "price_or_stock_invented",
  };

  const missingInci: OfficialKrProductRawItem = {
    sourceId: "kr-official-mall",
    sourceKind: "official_kr_mall_page",
    accessMode: "public_https",
    sourceTier: 1,
    brandOfficialUrl: "https://brand-official.example/products/no-inci",
    officialMallUrl: "https://mall.official.example/kr/no-inci",
    inciDisclosureUrl: null,
    brandName: "No Inci Brand",
    productNameKo: "전성분 미공개 로션",
    productNameEn: null,
    category: "lotion",
    fullIngredients: null,
    volumeLabel: "100ml",
    variants: [],
    images: [
      {
        imageId: "img-no-inci",
        sourceUrl: "https://mall.official.example/img/no-inci.jpg",
        role: "hero",
        rightsStatus: "official_remote_use",
        verified: true,
      },
    ],
    offers: [
      {
        offerId: "off-no-inci",
        retailerName: "Official Mall",
        retailerType: "official_mall",
        retailerCountry: "KR",
        shipsToCountries: ["KR"],
        purchaseUrl: "https://mall.official.example/kr/no-inci",
        price: 22000,
        currency: "KRW",
        stockStatus: "in_stock",
        isOfficial: true,
        lastCheckedAt: NOW_FRESH,
      },
    ],
    usageGuidance: null,
    sourceVerifiedAt: NOW_FRESH,
    isFixture: false,
  };

  const staleProduct: OfficialKrProductRawItem = {
    ...officialComplete,
    sourceId: "kr-brand-official",
    brandName: "Stale Lab",
    productNameKo: "만료 세럼",
    productNameEn: "Stale Serum",
    brandOfficialUrl: "https://brand-official.example/products/stale-serum",
    officialMallUrl: "https://mall.official.example/kr/stale-serum",
    inciDisclosureUrl:
      "https://brand-official.example/products/stale-serum/ingredients",
    sourceVerifiedAt: NOW_STALE,
    offers: [
      {
        offerId: "off-stale",
        retailerName: "Example Lab Official KR",
        retailerType: "official_mall",
        retailerCountry: "KR",
        shipsToCountries: ["KR"],
        purchaseUrl: "https://mall.official.example/kr/stale-serum",
        price: 28000,
        currency: "KRW",
        stockStatus: "unknown",
        isOfficial: true,
        lastCheckedAt: NOW_STALE,
      },
    ],
  };

  const refreshDue: OfficialKrProductRawItem = {
    ...officialComplete,
    brandName: "Refresh Lab",
    productNameKo: "재확인 세럼",
    productNameEn: "Refresh Serum",
    brandOfficialUrl: "https://brand-official.example/products/refresh-serum",
    officialMallUrl: "https://mall.official.example/kr/refresh-serum",
    inciDisclosureUrl:
      "https://brand-official.example/products/refresh-serum/ingredients",
    sourceVerifiedAt: NOW_REFRESH,
    offers: [
      {
        offerId: "off-refresh",
        retailerName: "Example Lab Official KR",
        retailerType: "official_mall",
        retailerCountry: "KR",
        shipsToCountries: ["KR"],
        purchaseUrl: "https://mall.official.example/kr/refresh-serum",
        price: 29000,
        currency: "KRW",
        stockStatus: "in_stock",
        isOfficial: true,
        lastCheckedAt: NOW_REFRESH,
      },
    ],
  };

  const unknownFieldsPreserved: OfficialKrProductRawItem = {
    sourceId: "kr-brand-official",
    sourceKind: "brand_official_page",
    accessMode: "public_https",
    sourceTier: 1,
    brandOfficialUrl: "https://brand-official.example/products/partial",
    officialMallUrl: null,
    inciDisclosureUrl:
      "https://brand-official.example/products/partial/ingredients",
    brandName: "Partial Lab",
    productNameKo: "부분확인 앰플",
    productNameEn: null,
    category: null,
    fullIngredients: "Water, Niacinamide",
    volumeLabel: null,
    variants: [],
    images: [],
    offers: [],
    usageGuidance: null,
    sourceVerifiedAt: NOW_FRESH,
    isFixture: false,
  };

  return [
    officialComplete,
    officialDuplicate,
    fixtureOffline,
    marketplaceOnly,
    paidApiBlocked,
    captchaBlocked,
    inventedPrice,
    missingInci,
    staleProduct,
    refreshDue,
    unknownFieldsPreserved,
  ];
}

export function createFixturePageFetcher(
  items: OfficialKrProductRawItem[] = createOfficialKrProductFixtures(),
): OfficialKrProductPageFetcher {
  return {
    async listManifestSlice(req) {
      const slice = items.slice(req.startIndex, req.startIndex + req.limit);
      return {
        ok: true,
        items: slice,
        totalCount: items.length,
        safeEndpoint: SAFE_ENDPOINT_NOTE,
        usedFixture: true,
        errorMessageKo: null,
      };
    },
  };
}
