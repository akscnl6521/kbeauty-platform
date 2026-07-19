import assert from "node:assert/strict";
import {
  canonicalCollectionKey,
  decideCollectedProduct,
} from "@/lib/catalog/collectionDecision";
import type { EnrichmentRecord } from "@/lib/catalog/enrichment";

function record(overrides: Partial<EnrichmentRecord> = {}): EnrichmentRecord {
  return {
    externalProductId: "cosrx-snail-96",
    brand: "COSRX",
    brandIdHint: "cosrx",
    nameRaw: "Advanced Snail 96 Mucin Power Essence",
    category: "essence",
    officialUrl: "https://www.cosrx.com/products/snail-96",
    curatedProvenance: "known_hero",
    matchClass: "official_matched",
    reasons: [],
    officialName: "Advanced Snail 96 Mucin Power Essence",
    description: "",
    imageRemoteUrl: "https://cdn.example.com/snail.jpg",
    imageStatus: "remote_reference",
    imageContentHash: "hash-new",
    price: 23000,
    currency: "KRW",
    availability: "in_stock",
    fullIngredients: ["Snail Secretion Filtrate", "Sodium Hyaluronate"],
    keyIngredients: ["Snail Secretion Filtrate"],
    evidenceSlugs: ["snail-mucin"],
    attributes: {},
    fetchedAt: "2026-07-19T00:00:00.000Z",
    sourceHost: "cosrx.com",
    robotsAllowed: true,
    ...overrides,
  };
}

const base = record();
const canonicalKey = canonicalCollectionKey(base);

assert.equal(
  decideCollectedProduct({ record: base, existing: [] }).action,
  "create_candidate"
);

assert.equal(
  decideCollectedProduct({
    record: base,
    existing: [
      {
        productId: "4",
        canonicalKey,
        officialUrl: base.officialUrl,
        imageContentHash: "hash-old",
      },
    ],
  }).action,
  "update_candidate"
);

assert.equal(
  decideCollectedProduct({
    record: record({
      fullIngredients: [],
      price: null,
      availability: null,
      imageContentHash: null,
    }),
    existing: [
      {
        productId: "4",
        canonicalKey,
        officialUrl: base.officialUrl,
        imageContentHash: null,
      },
    ],
  }).action,
  "no_change"
);

assert.deepEqual(
  decideCollectedProduct({
    record: record({ matchClass: "match_failed", fetchedAt: null }),
    existing: [],
  }),
  { action: "manual_review", reason: "official_match_failed" }
);

assert.deepEqual(
  decideCollectedProduct({
    record: record({ robotsAllowed: false }),
    existing: [],
  }),
  { action: "manual_review", reason: "robots_disallowed" }
);

assert.equal(
  decideCollectedProduct({
    record: record({
      matchClass: "rejected_candidate",
      curatedProvenance: "category_discovery",
    }),
    existing: [],
  }).action,
  "reject"
);

console.log("collection-decision-selftest: ok");
