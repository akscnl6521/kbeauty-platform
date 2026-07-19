import assert from "node:assert/strict";
import { buildStagingSyncPlan } from "@/lib/catalog/stagingSyncPlan";
import type { EnrichmentRecord } from "@/lib/catalog/enrichment";

function record(overrides: Partial<EnrichmentRecord> = {}): EnrichmentRecord {
  return {
    externalProductId: "cosrx-snail-96",
    brand: "COSRX",
    brandIdHint: "cosrx",
    nameRaw: "Advanced Snail 96 Mucin Power Essence",
    category: "essence",
    officialUrl: "https://www.cosrx.com/products/advanced-snail-96-mucin-power-essence",
    curatedProvenance: "known_hero",
    matchClass: "official_matched",
    reasons: [],
    officialName: "Advanced Snail 96 Mucin Power Essence",
    description: "Official product description",
    imageRemoteUrl: "https://cdn.example.com/snail.jpg",
    imageStatus: "remote_reference",
    imageContentHash: "image-v2",
    price: 25000,
    currency: "KRW",
    availability: "in_stock",
    fullIngredients: ["Snail Secretion Filtrate", "Betaine"],
    keyIngredients: ["Snail Secretion Filtrate"],
    evidenceSlugs: ["snail-mucin"],
    attributes: {},
    fetchedAt: "2026-07-19T00:00:00.000Z",
    sourceHost: "cosrx.com",
    robotsAllowed: true,
    ...overrides,
  };
}

const existing = [
  {
    productId: "product-1",
    canonicalKey: "cosrx::advanced-snail-96-mucin-power-essence::essence",
    officialUrl:
      "https://www.cosrx.com/products/advanced-snail-96-mucin-power-essence",
    imageContentHash: "image-v1",
  },
];

const updatePlan = buildStagingSyncPlan({ records: [record()], existing });
assert.equal(updatePlan.productionTouched, false);
assert.equal(updatePlan.summary.update_candidate, 1);
assert.equal(updatePlan.operations[0]?.action, "update_candidate");

const createPlan = buildStagingSyncPlan({
  records: [
    record({
      externalProductId: "anua-heartleaf-toner",
      brand: "ANUA",
      brandIdHint: "anua",
      nameRaw: "Heartleaf 77 Soothing Toner",
      officialName: "Heartleaf 77 Soothing Toner",
      category: "toner",
      officialUrl: "https://anua.kr/product/heartleaf-77-soothing-toner",
      sourceHost: "anua.kr",
      imageContentHash: "anua-image",
    }),
  ],
  existing,
});
assert.equal(createPlan.summary.insert_candidate, 1);

const reviewPlan = buildStagingSyncPlan({
  records: [
    record({
      externalProductId: "blocked-product",
      matchClass: "match_failed",
      sourceHost: null,
      fetchedAt: null,
      robotsAllowed: null,
    }),
  ],
  existing: [],
});
assert.equal(reviewPlan.summary.manual_review, 1);

const rejectPlan = buildStagingSyncPlan({
  records: [
    record({
      externalProductId: "placeholder",
      matchClass: "rejected_candidate",
      curatedProvenance: "category_discovery",
    }),
  ],
  existing: [],
});
assert.equal(rejectPlan.summary.reject_candidate, 1);

console.log("staging sync plan self-test passed");
