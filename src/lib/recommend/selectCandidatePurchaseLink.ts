import type { CandidateProduct } from "./types";
import { productOfferToPurchaseLink } from "./productOffer";
import {
  buildPurchaseLinksFromProduct,
  selectPurchaseLinkForCountry,
  type PurchaseLinkSelection,
} from "./selectPurchaseLink";

export function selectPurchaseLink(
  product: CandidateProduct,
  countryCode: string | null | undefined
): PurchaseLinkSelection | null {
  const offerLinks = (product.offers ?? []).map(productOfferToPurchaseLink);
  const legacyLinks = buildPurchaseLinksFromProduct(product);
  return selectPurchaseLinkForCountry([...offerLinks, ...legacyLinks], countryCode);
}
