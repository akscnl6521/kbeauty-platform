/**
 * Country-eligible verified offer selection for recommendations.
 */

import type { ProductOffer } from "@/lib/recommend/catalogTypes";
import { isOfferEligibleForCoreRecommendation } from "@/lib/recommend/productOffer";
import type { ShippingCountry } from "@/lib/recommend/selectPurchaseLink";

function authorityRank(offer: ProductOffer): number {
  if (offer.isOfficial) return 1;
  const source = (offer.source ?? "").toLowerCase();
  if (source.includes("official_brand_store")) return 1;
  if (source.includes("official_country_store")) return 2;
  if (source.includes("authorized_retailer")) return 3;
  if (source.includes("marketplace_official")) return 4;
  return 5;
}

/**
 * Pick best verified in-stock offer for a shipping country.
 * Returns null when none — Top5 must exclude the product.
 */
export function selectBestCountryOffer(
  offers: ProductOffer[] | undefined,
  country: ShippingCountry
): ProductOffer | null {
  if (!offers?.length) return null;
  const eligible = offers.filter((o) =>
    isOfferEligibleForCoreRecommendation(o, country)
  );
  if (!eligible.length) return null;

  eligible.sort((a, b) => {
    const ra = authorityRank(a);
    const rb = authorityRank(b);
    if (ra !== rb) return ra - rb;
    const pa = a.price ?? Number.POSITIVE_INFINITY;
    const pb = b.price ?? Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    const ta = a.lastCheckedAt ? Date.parse(a.lastCheckedAt) : 0;
    const tb = b.lastCheckedAt ? Date.parse(b.lastCheckedAt) : 0;
    return tb - ta;
  });

  return eligible[0] ?? null;
}

export function productHasCountryEligibleOffer(
  offers: ProductOffer[] | undefined,
  country: ShippingCountry
): boolean {
  return selectBestCountryOffer(offers, country) != null;
}
