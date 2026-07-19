import type { CandidateProduct } from "./types";
import {
  isOfferEligibleForCoreRecommendation,
  productOfferToPurchaseLink,
} from "./productOffer";
import {
  buildPurchaseLinksFromProduct,
  normalizeShippingCountry,
  selectPurchaseLinkForCountry,
  type PurchaseLinkSelection,
} from "./selectPurchaseLink";

/**
 * 구매 CTA는 정규화된 product_offers를 우선 사용한다.
 * offer가 존재하면 배송국·검증일·가격·통화·재고·HTTPS 조건을 모두
 * 통과한 항목만 노출한다. offer 자체가 없는 구형 제품에 한해서만
 * 기존 링크 컬럼을 하위 호환용으로 사용한다.
 */
export function selectPurchaseLink(
  product: CandidateProduct,
  countryCode: string | null | undefined
): PurchaseLinkSelection | null {
  const shipping = normalizeShippingCountry(countryCode);
  if (!shipping) return null;

  if (Array.isArray(product.offers) && product.offers.length > 0) {
    const eligibleOfferLinks = product.offers
      .filter((offer) => isOfferEligibleForCoreRecommendation(offer, shipping))
      .map(productOfferToPurchaseLink);

    return selectPurchaseLinkForCountry(eligibleOfferLinks, shipping);
  }

  return selectPurchaseLinkForCountry(
    buildPurchaseLinksFromProduct(product),
    shipping
  );
}
