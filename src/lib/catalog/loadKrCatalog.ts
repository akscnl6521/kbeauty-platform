/**
 * 한국 카탈로그 JSON 로더 (관리자 검증·개발용).
 * Supabase 연동·추천 점수와 분리. unverified offer 는 핵심 추천에 넣지 않는다.
 */

import type {
  KoreanProductInput,
  KoreanProductOfferInput,
} from "@/lib/recommend/catalogTypes";
import {
  meetsKoreanVerifiedOfferRules,
  validateCatalogData,
} from "@/lib/recommend/validateCatalogData";
import type { CatalogValidationReport } from "@/lib/recommend/validateCatalogData";
import cosrxProductsFile from "../../../data/catalog/kr/cosrx-products.json";
import cosrxOffersFile from "../../../data/catalog/kr/cosrx-offers.json";

export type CatalogReviewRow = {
  product: KoreanProductInput;
  offer: KoreanProductOfferInput | null;
  coreRecommendEligible: boolean;
  awaitingStockVerification: boolean;
  statusMessageKo: string;
};

function asProductList(raw: unknown): KoreanProductInput[] {
  if (!raw || typeof raw !== "object") return [];
  const products = (raw as { products?: unknown }).products;
  if (!Array.isArray(products)) return [];
  return products as KoreanProductInput[];
}

function asOfferList(raw: unknown): KoreanProductOfferInput[] {
  if (!raw || typeof raw !== "object") return [];
  const offers = (raw as { offers?: unknown }).offers;
  if (!Array.isArray(offers)) return [];
  return offers as KoreanProductOfferInput[];
}

/** Sprint 14 COSRX 1차 등록분 */
export function loadCosrxKrCatalog(): {
  products: KoreanProductInput[];
  offers: KoreanProductOfferInput[];
} {
  return {
    products: asProductList(cosrxProductsFile),
    offers: asOfferList(cosrxOffersFile),
  };
}

/** 등록된 KR 카탈로그 묶음 (향후 브랜드 파일 추가) */
export function loadKrCatalogBundles(): {
  products: KoreanProductInput[];
  offers: KoreanProductOfferInput[];
} {
  const cosrx = loadCosrxKrCatalog();
  return {
    products: [...cosrx.products],
    offers: [...cosrx.offers],
  };
}

export function validateKrCatalog(): CatalogValidationReport {
  const { products, offers } = loadKrCatalogBundles();
  return validateCatalogData(products, offers);
}

/**
 * 핵심 추천 포함 가능 여부.
 * unverified / stock unknown / verifiedAt 없음 → false
 */
export function isAwaitingAdminVerification(
  offer: KoreanProductOfferInput | null | undefined
): boolean {
  if (!offer) return true;
  if (offer.verificationStatus !== "verified") return true;
  if (offer.stockStatus === "unknown" || offer.stockStatus == null) return true;
  if (!offer.verifiedAt) return true;
  return false;
}

export function buildCatalogReviewRows(): CatalogReviewRow[] {
  const { products, offers } = loadKrCatalogBundles();
  const offersByProduct = new Map<string, KoreanProductOfferInput[]>();
  for (const offer of offers) {
    const list = offersByProduct.get(offer.productId) ?? [];
    list.push(offer);
    offersByProduct.set(offer.productId, list);
  }

  const rows: CatalogReviewRow[] = [];
  for (const product of products) {
    const productOffers = offersByProduct.get(product.productId) ?? [];
    if (productOffers.length === 0) {
      rows.push({
        product,
        offer: null,
        coreRecommendEligible: false,
        awaitingStockVerification: true,
        statusMessageKo:
          "공식 제품 및 가격 확인 완료 · 재고 및 구매 가능 여부 검증 대기",
      });
      continue;
    }
    for (const offer of productOffers) {
      const awaiting = isAwaitingAdminVerification(offer);
      rows.push({
        product,
        offer,
        coreRecommendEligible: meetsKoreanVerifiedOfferRules(offer),
        awaitingStockVerification: awaiting,
        statusMessageKo: awaiting
          ? "공식 제품 및 가격 확인 완료 · 재고 및 구매 가능 여부 검증 대기"
          : "핵심 추천 조건 충족 (verified · in_stock)",
      });
    }
  }
  return rows;
}
