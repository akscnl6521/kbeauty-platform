import assert from "node:assert/strict";
import {
  buildCatalogExceptionQueue,
  deriveCatalogExceptionsFromStagingRows,
} from "@/lib/catalog/automation/exceptionQueue";

const queue = buildCatalogExceptionQueue([
  {
    externalProductId: "p2",
    brand: "COSRX",
    productName: "Renewed Essence",
    kind: "renewal_suspect",
    confidence: 0.9,
  },
  {
    externalProductId: "p1",
    brand: "COSRX",
    productName: "Duplicate Essence",
    kind: "duplicate",
    confidence: 1,
  },
  {
    externalProductId: "p3",
    brand: "COSRX",
    productName: "No Offer",
    kind: "missing_offer",
  },
  {
    externalProductId: "p1",
    brand: "COSRX",
    productName: "Duplicate Essence",
    kind: "duplicate",
    confidence: 1,
  },
]);

assert.equal(queue.length, 3);
assert.equal(queue[0]?.externalProductId, "p1");
assert.equal(queue[0]?.priority, "critical");
assert.equal(queue[0]?.reviewGroup, "identity");
assert.equal(queue[1]?.externalProductId, "p2");
assert.equal(queue[1]?.priority, "high");
assert.equal(queue[2]?.externalProductId, "p3");
assert.equal(queue[2]?.priority, "low");
assert.equal(queue[2]?.reviewGroup, "commerce");

const derived = deriveCatalogExceptionsFromStagingRows([
  {
    external_product_id: "p4",
    brand_canonical: "Beauty of Joseon",
    product_name_raw: "Relief Sun",
    official_product_url: "https://beautyofjoseon.com/products/relief-sun",
    match_class: "match_failed",
    enrichment_reasons: ["official_domain_not_allowlisted", "fetch_error:timeout"],
    ingredients_status: "not_found",
    primary_image_url: null,
    image_status: "broken",
    product_attributes: {},
  },
  {
    external_product_id: "p5",
    brand_canonical: "COSRX",
    product_name_raw: "Snail Essence",
    match_class: "duplicate",
    enrichment_reasons: [],
    ingredients_status: "raw_collected",
    primary_image_url: "https://cdn.example.com/snail.jpg",
    image_status: "remote_reference",
    product_attributes: {
      identityConfidence: 0.98,
      price: 23000,
      currency: "KRW",
    },
  },
]);

const kindsP4 = derived
  .filter((item) => item.externalProductId === "p4")
  .map((item) => item.kind)
  .sort();
assert.deepEqual(kindsP4, [
  "broken_image",
  "fetch_failed",
  "missing_image",
  "missing_inci",
  "missing_offer",
  "source_mismatch",
].sort());

const p5 = derived.filter((item) => item.externalProductId === "p5");
assert.equal(p5.length, 1);
assert.equal(p5[0]?.kind, "duplicate");
assert.equal(p5[0]?.confidence, 0.98);

console.log("catalog-exception-queue-selftest: ok");
