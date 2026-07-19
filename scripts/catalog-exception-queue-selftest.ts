import assert from "node:assert/strict";
import { buildCatalogExceptionQueue } from "@/lib/catalog/automation/exceptionQueue";

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

console.log("catalog-exception-queue-selftest: ok");
