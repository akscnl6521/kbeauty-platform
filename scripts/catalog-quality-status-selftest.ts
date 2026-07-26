import assert from "node:assert/strict";
import {
  classifyCatalogQualityStatus,
  computeCatalogQualityRates,
  countByQualityStatus,
  CATALOG_QUALITY_PRIORITY,
} from "@/lib/catalog/qualityStatus";

assert.equal(
  classifyCatalogQualityStatus({
    blockedByPolicy: true,
    isDuplicate: true,
    hasIngredients: false,
  }),
  "blocked_by_policy"
);
assert.equal(
  classifyCatalogQualityStatus({ isDuplicate: true, hasIngredients: false }),
  "duplicate"
);
assert.equal(
  classifyCatalogQualityStatus({ discontinued: true, unavailable: true }),
  "discontinued"
);
assert.equal(
  classifyCatalogQualityStatus({ unavailable: true, sourceVerified: false }),
  "unavailable"
);
assert.equal(
  classifyCatalogQualityStatus({ sourceVerified: false, hasIngredients: false }),
  "source_unverified"
);
assert.equal(
  classifyCatalogQualityStatus({
    sourceVerified: true,
    hasIngredients: false,
    hasImage: false,
  }),
  "ingredient_incomplete"
);
assert.equal(
  classifyCatalogQualityStatus({
    sourceVerified: true,
    hasIngredients: true,
    hasImage: false,
    hasOffer: false,
  }),
  "image_missing"
);
assert.equal(
  classifyCatalogQualityStatus({
    sourceVerified: true,
    hasIngredients: true,
    hasImage: true,
    hasOffer: false,
  }),
  "offer_missing"
);
assert.equal(
  classifyCatalogQualityStatus({
    sourceVerified: true,
    hasIngredients: true,
    hasImage: true,
    hasOffer: true,
    needsReview: true,
  }),
  "review_required"
);
assert.equal(
  classifyCatalogQualityStatus({
    sourceVerified: true,
    hasIngredients: true,
    hasImage: true,
    hasOffer: true,
  }),
  "staging_ready"
);

assert.equal(CATALOG_QUALITY_PRIORITY[0], "blocked_by_policy");
assert.equal(CATALOG_QUALITY_PRIORITY.at(-1), "staging_ready");

const counts = countByQualityStatus(["staging_ready", "duplicate", "staging_ready"]);
assert.equal(counts.staging_ready, 2);
assert.equal(counts.duplicate, 1);

const rates = computeCatalogQualityRates({
  total: 10,
  withIngredients: 7,
  withImage: 5,
  withOffer: 2,
  stagingReady: 1,
  duplicate: 1,
  reviewOrBlocked: 9,
});
assert.equal(rates.ingredient.ratePct, 70);
assert.equal(rates.image.ratePct, 50);
assert.equal(rates.offer.ratePct, 20);

console.log("catalog-quality-status-selftest: ok");
