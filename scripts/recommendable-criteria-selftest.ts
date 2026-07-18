/**
 * Selftest for recommendable SSOT — no DB.
 * Run: npx tsx scripts/recommendable-criteria-selftest.ts
 */
import {
  evaluateStagingRecommendable,
  evaluatePublicCoreRecommendable,
  isTinyPlaceholderImage,
  countEligibleKrOffers,
} from "../src/lib/catalog/recommendableCriteria";
import type { ProductOffer } from "../src/lib/recommend/catalogTypes";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const ready = evaluateStagingRecommendable({
  productStatus: "approved",
  matchClass: "official_matched",
  ingredientsStatus: "raw_collected",
  hasOfficialUrl: true,
  hasPrimaryImage: true,
  imageValid: true,
  hasKrOfferCandidate: true,
  recommendableFlag: true,
});
assert(ready.bucket === "READY_TO_RECOMMEND", "expected READY_TO_RECOMMEND");
assert(ready.readyToRecommend === true, "ready should recommend");

const blocked = evaluateStagingRecommendable({
  productStatus: "needs_review",
  matchClass: "official_matched",
  ingredientsStatus: "not_found",
  officialInciBlocked: true,
});
assert(blocked.bucket === "BLOCKED", "expected BLOCKED");

const missingInci = evaluateStagingRecommendable({
  productStatus: "data_complete",
  matchClass: "partial",
  ingredientsStatus: "not_found",
  hasOfficialUrl: true,
  hasPrimaryImage: true,
  imageValid: true,
  hasKrOfferCandidate: true,
});
assert(missingInci.bucket === "MISSING_OFFICIAL_INCI", "expected MISSING_OFFICIAL_INCI");

const dup = evaluateStagingRecommendable({
  productStatus: "duplicate_candidate",
  matchClass: "duplicate",
  ingredientsStatus: "raw_collected",
});
assert(dup.bucket === "DUPLICATE_SUSPECT", "expected DUPLICATE_SUSPECT");

assert(isTinyPlaceholderImage(68) === true, "68B is tiny");
assert(isTinyPlaceholderImage(26610) === false, "26k is not tiny");

const publicOk = evaluatePublicCoreRecommendable({
  active: true,
  verifiedAt: "2026-07-01T00:00:00Z",
  approvedStructuredIngredientCount: 5,
  offers: [
    {
      id: "1",
      productId: "p1",
      retailerName: "Official",
      retailerCountry: "KR",
      shipsToCountries: ["KR"],
      purchaseUrl: "https://example.com/p",
      price: 12000,
      currency: "KRW",
      stockStatus: "in_stock",
      verificationStatus: "verified",
      verifiedAt: "2026-07-01T00:00:00Z",
      isOfficial: true,
      active: true,
    } satisfies ProductOffer,
  ],
});
assert(publicOk.eligible === true, "public eligible");

const publicDraft = evaluatePublicCoreRecommendable({
  active: true,
  verifiedAt: null,
  approvedStructuredIngredientCount: 5,
  offers: [],
});
assert(publicDraft.eligible === false, "unverified not eligible");
assert(publicDraft.blockers.includes("product_not_verified"), "needs verified_at");

assert(countEligibleKrOffers([]) === 0, "no offers");

const variant = evaluateStagingRecommendable({
  productStatus: "approved",
  matchClass: "official_matched",
  ingredientsStatus: "raw_collected",
  hasOfficialUrl: true,
  hasPrimaryImage: true,
  imageValid: true,
  hasKrOfferCandidate: true,
  variantMismatch: true,
});
assert(variant.bucket === "VARIANT_MISMATCH", "expected VARIANT_MISMATCH");

const imageBad = evaluateStagingRecommendable({
  productStatus: "approved",
  matchClass: "official_matched",
  ingredientsStatus: "raw_collected",
  hasOfficialUrl: true,
  hasPrimaryImage: true,
  imageValid: false,
  hasKrOfferCandidate: true,
});
assert(imageBad.bucket === "IMAGE_INVALID", "expected IMAGE_INVALID");

const offerBad = evaluateStagingRecommendable({
  productStatus: "approved",
  matchClass: "official_matched",
  ingredientsStatus: "raw_collected",
  hasOfficialUrl: true,
  hasPrimaryImage: true,
  imageValid: true,
  hasKrOfferCandidate: false,
});
assert(offerBad.bucket === "OFFER_INVALID", "expected OFFER_INVALID");

// Public PDP gate: draft/unverified never public
assert(publicDraft.eligible === false, "draft/unverified stays private");

console.log(
  JSON.stringify({
    phase: "recommendable_criteria_selftest_ok",
    checks: 12,
  })
);
