import assert from "node:assert/strict";
import { applyIdentityDecisions } from "@/lib/catalog/enrichment/applyIdentityDecisions";
import type { EnrichmentRecord } from "@/lib/catalog/enrichment";

function record(input: Partial<EnrichmentRecord>): EnrichmentRecord {
  return {
    externalProductId: "cosrx-snail-100",
    brand: "COSRX",
    brandIdHint: "cosrx",
    nameRaw: "Advanced Snail 96 Mucin Power Essence",
    category: "essence",
    officialUrl: "https://www.cosrx.com/products/snail-96",
    curatedProvenance: "known_hero",
    matchClass: "official_matched",
    reasons: [],
    officialName: "Advanced Snail 96 Mucin Power Essence",
    description: null,
    imageRemoteUrl: null,
    imageStatus: "missing",
    imageContentHash: null,
    price: null,
    currency: null,
    availability: null,
    fullIngredients: [],
    keyIngredients: [],
    evidenceSlugs: [],
    attributes: { sizeValue: 100, sizeUnit: "ml" },
    fetchedAt: null,
    sourceHost: "cosrx.com",
    robotsAllowed: true,
    ...input,
  };
}

const result = applyIdentityDecisions([
  record({ externalProductId: "cosrx-snail-100-a" }),
  record({ externalProductId: "cosrx-snail-100-b" }),
  record({
    externalProductId: "cosrx-snail-30",
    attributes: { sizeValue: 30, sizeUnit: "ml" },
  }),
  record({
    externalProductId: "cosrx-snail-renewal",
    officialName: "Advanced Snail Mucin Essence Renewal",
    attributes: { sizeValue: 100, sizeUnit: "ml" },
  }),
]);

assert.equal(result[0]?.matchClass, "official_matched");
assert.equal(result[1]?.matchClass, "duplicate");
assert.equal(result[1]?.attributes.duplicateOfExternalProductId, "cosrx-snail-100-a");
assert.equal(result[2]?.matchClass, "official_matched");
assert.equal(result[2]?.attributes.variantOfExternalProductId, "cosrx-snail-100-a");
assert.equal(result[3]?.matchClass, "renewal_suspect");
assert.equal(result[3]?.attributes.renewalCandidateOfExternalProductId, "cosrx-snail-100-a");

console.log("enrichment-identity-decisions-selftest: ok");
