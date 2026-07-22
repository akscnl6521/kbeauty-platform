/**
 * Phase 2.5 — recommendation_ready vs commerce availability separation.
 * Offline only; no DB writes.
 */
import assert from "node:assert/strict";
import {
  commerceFitButUnavailableMessageKo,
  deriveCommerceAvailability,
  isRecommendCommerceSeparationEnabled,
} from "./commerceStatus";
import {
  filterCandidatesByOfferAvailability,
  isOfferEligibleForCoreRecommendation,
  isOfferEligibleForRecommendation,
  isOfferPurchasableForCta,
} from "./productOffer";
import type { ProductOffer } from "./catalogTypes";
import type { CandidateProduct } from "./types";
import { AFFILIATE_SCORE_FORBIDDEN } from "./scenarios/poolRules";

function offer(partial: Partial<ProductOffer> & { id: string; productId: string }): ProductOffer {
  return {
    retailerName: "조선미녀 공식몰",
    retailerCountry: "KR",
    shipsToCountries: ["KR"],
    purchaseUrl: "https://beautyofjoseon.co.kr/product/example/31/",
    price: 18000,
    currency: "KRW",
    stockStatus: "in_stock",
    verificationStatus: "verified",
    isOfficial: true,
    verifiedAt: "2026-07-22T00:00:00.000Z",
    lastCheckedAt: "2026-07-22T10:40:00+09:00",
    active: true,
    ...partial,
  };
}

function product(
  id: string,
  slug: string,
  offers: ProductOffer[] | null,
  ingredients: string[] = ["Salicylic Acid", "Glycolic Acid"]
): CandidateProduct {
  return {
    id,
    slug,
    name: slug,
    name_ko: slug,
    name_ja: null,
    brand: "TestBrand",
    category: "toner",
    skin_concern: ["acne"],
    skin_tone: null,
    key_ingredients: ingredients,
    key_ingredients_ja: null,
    price_usd: 15,
    offers,
    link_oliveyoung: null,
    link_sephora: null,
    link_amazon_us: null,
    link_amazon_jp: null,
    link_qoo10: null,
    link_coupang: null,
    link_yesstyle: null,
    recommendation_reason: null,
    recommendation_reason_ko: null,
    recommendation_reason_ja: null,
  };
}

assert.equal(AFFILIATE_SCORE_FORBIDDEN, true, "affiliate/ad must stay out of Organic score");

// Flag default on
assert.equal(isRecommendCommerceSeparationEnabled({}), true);
assert.equal(
  isRecommendCommerceSeparationEnabled({ RECOMMEND_COMMERCE_SEPARATION: "0" }),
  false,
  "flag=0 rolls back to legacy ranking gate"
);

const bojOos = offer({
  id: "boj-oos",
  productId: "25",
  stockStatus: "out_of_stock",
  verificationStatus: "unverified",
  verifiedAt: undefined,
  isOfficial: true,
});

assert.equal(
  isOfferEligibleForRecommendation(bojOos, "KR"),
  true,
  "BOJ official OOS remains recommendation-eligible"
);
assert.equal(
  isOfferEligibleForCoreRecommendation(bojOos, "KR"),
  false,
  "BOJ OOS must not enable purchase CTA"
);
assert.equal(isOfferPurchasableForCta(bojOos, "KR"), false);

const verifiedOos = offer({
  id: "v-oos",
  productId: "25",
  stockStatus: "out_of_stock",
});
assert.equal(isOfferEligibleForRecommendation(verifiedOos, "KR"), true);
assert.equal(isOfferEligibleForCoreRecommendation(verifiedOos, "KR"), false);

const inStock = offer({ id: "v-in", productId: "10" });
assert.equal(isOfferEligibleForRecommendation(inStock, "KR"), true);
assert.equal(isOfferEligibleForCoreRecommendation(inStock, "KR"), true);

const usSku = offer({
  id: "us",
  productId: "99",
  retailerCountry: "US",
  shipsToCountries: ["US"],
  currency: "USD",
  price: 20,
});
assert.equal(
  isOfferEligibleForRecommendation(usSku, "KR"),
  false,
  "KR/US SKU mix blocked for KR ranking"
);

const commerceBoj = deriveCommerceAvailability({
  offers: [bojOos],
  shippingCountry: "KR",
});
assert.equal(commerceBoj.commerce_status, "out_of_stock");
assert.equal(commerceBoj.official_seller, true);
assert.equal(commerceBoj.price, 18000);
assert.ok(
  commerceFitButUnavailableMessageKo("out_of_stock")?.includes("품절")
);

const commerceUnknown = deriveCommerceAvailability({
  offers: [],
  shippingCountry: "KR",
});
assert.equal(commerceUnknown.commerce_status, "availability_unknown");
assert.ok(
  commerceFitButUnavailableMessageKo("availability_unknown")?.includes("확인")
);

const discontinued = deriveCommerceAvailability({
  offers: [inStock],
  shippingCountry: "KR",
  productStatus: "discontinued",
});
assert.equal(discontinued.commerce_status, "discontinued");

const haruharuNoOffer = product(
  "26",
  "haruharu-wonder-black-rice-hyaluronic-toner",
  [],
  ["Hyaluronic Acid", "Glycerin"]
);
const bojProduct = product(
  "25",
  "beauty-of-joseon-green-plum-refreshing-toner",
  [bojOos]
);
const cosrx = product("10", "cosrx-aha-bha-toner", [inStock]);

const prev = process.env.RECOMMEND_COMMERCE_SEPARATION;
process.env.RECOMMEND_COMMERCE_SEPARATION = "1";
const { eligible, excludedCount } = filterCandidatesByOfferAvailability(
  [cosrx, bojProduct, haruharuNoOffer],
  "KR"
);
assert.equal(excludedCount, 0, "OOS + availability_unknown stay in ranking pool");
assert.equal(eligible.length, 3);
assert.ok(
  eligible.find((p) => p.id === "25"),
  "BOJ OOS included for ranking"
);
assert.ok(
  eligible.find((p) => p.id === "26"),
  "Haruharu availability_unknown included for ranking"
);
const bojEligible = eligible.find((p) => p.id === "25")!;
assert.equal(
  (bojEligible.purchase_links ?? []).length,
  0,
  "OOS must not attach purchasable purchase_links for CTA"
);

process.env.RECOMMEND_COMMERCE_SEPARATION = "0";
const legacy = filterCandidatesByOfferAvailability(
  [cosrx, bojProduct, haruharuNoOffer],
  "KR"
);
assert.equal(
  legacy.eligible.length,
  1,
  "legacy flag excludes OOS and no-offer products"
);
assert.equal(legacy.eligible[0]?.id, "10");

if (prev === undefined) delete process.env.RECOMMEND_COMMERCE_SEPARATION;
else process.env.RECOMMEND_COMMERCE_SEPARATION = prev;

console.log("[commerce-separation-selftest] ok");
