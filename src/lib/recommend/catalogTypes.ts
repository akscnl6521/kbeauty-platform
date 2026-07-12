/**
 * 카탈로그 제품 + 국가별 판매 Offer 도메인 타입.
 * 추천 점수와 분리: 판매 가능 여부(offer)를 먼저 확인한 뒤 적합도 랭킹에 투입한다.
 */

import type {
  LinkVerificationStatus,
  OfferCurrency,
  RetailerCountry,
  ShippingCountry,
} from "./selectPurchaseLink";

/** 재고 상태 — out_of_stock 은 핵심 추천 제외 */
export type StockStatus = "in_stock" | "out_of_stock" | "unknown";

/** 제품 데이터 신뢰도 (관리자 입력) */
export type DataConfidence = "high" | "medium" | "low" | "unverified";

/**
 * 카탈로그 Product (판매처·가격과 분리).
 * 기존 products 테이블과 병행하며, 신규 컬럼은 선택적이다.
 */
export type CatalogProduct = {
  id: string;
  brand: string;
  productName: string;
  category?: string;
  skinTypes?: string[];
  concerns?: string[];
  keyIngredients?: string[];
  fullIngredients?: string[];
  usageArea?: string;
  texture?: string;
  fragranceFree?: boolean;
  alcoholFree?: boolean;
  verifiedAt?: string;
  dataConfidence?: DataConfidence;
  active?: boolean;
};

/**
 * 국가·판매처별 Offer.
 * 한 제품에 KR/US/JP 등 여러 offer를 연결할 수 있다.
 */
export type ProductOffer = {
  id: string;
  productId: string;
  retailerName: string;
  retailerCountry: RetailerCountry;
  shipsToCountries: ShippingCountry[];
  purchaseUrl: string;
  price?: number;
  currency?: OfferCurrency;
  stockStatus: StockStatus;
  verificationStatus: LinkVerificationStatus;
  isOfficial?: boolean;
  verifiedAt?: string;
  lastCheckedAt?: string;
  /** false면 핵심 추천 제외. 없으면 활성으로 간주 */
  active?: boolean;
  /**
   * 향후 리뷰 확장 필드 — 이번 단계 점수 반영 없음.
   */
  rating?: number;
  reviewCount?: number;
  source?: string;
  lastReviewSyncAt?: string;
};

/** US/JP 핵심 추천에서 허용하는 재고 (KR은 in_stock만 허용) */
export const CORE_ALLOWED_STOCK: ReadonlySet<StockStatus> = new Set([
  "in_stock",
  "unknown",
]);

/** 국가별·성분별 최소 데이터 목표 (운영 체크리스트) */
export const CATALOG_DATA_GOALS = {
  minOffersByCountry: {
    KR: 100,
    US: 100,
    JP: 100,
  } as const satisfies Record<ShippingCountry, number>,
  minProductsByIngredient: {
    panthenol: 15,
    ceramide: 15,
    centella: 15,
    hyaluronicAcid: 15,
    niacinamide: 15,
    vitaminC: 10,
    retinol: 10,
    azelaicAcid: 5,
  } as const,
} as const;
