import assert from "node:assert/strict";
import { auditCatalogExceptionArtifact } from "../src/lib/catalog/automation/exceptionArtifactAudit";
import type { CatalogExceptionArtifact } from "../src/lib/catalog/automation/exceptionArtifactAudit";

const queue = [
  {
    externalProductId: "p1",
    brand: "COSRX",
    productName: "Snail Essence",
    sourceUrl: "https://www.cosrx.com/products/snail-essence",
    reasons: ["duplicate_candidate"],
    kind: "duplicate" as const,
    confidence: 0.99,
    priority: "critical" as const,
    score: 90,
    reviewGroup: "identity" as const,
  },
  {
    externalProductId: "p2",
    brand: "Beauty of Joseon",
    productName: "Relief Sun",
    sourceUrl: "https://beautyofjoseon.com/products/relief-sun",
    reasons: ["ingredients_missing"],
    kind: "missing_inci" as const,
    priority: "medium" as const,
    score: 55,
    reviewGroup: "content" as const,
  },
];

const validArtifact: CatalogExceptionArtifact = {
  summary: {
    phase: "catalog_exception_queue",
    linked: "jfnjufmldiqlgvgyugfd",
    productionTouched: false,
    writeMode: "artifact_only",
    productCount: 2,
    exceptionCount: 2,
    byPriority: { critical: 1, high: 0, medium: 1, low: 0 },
    byGroup: { identity: 1, source: 0, content: 1, commerce: 0 },
  },
  queue,
};

assert.deepEqual(auditCatalogExceptionArtifact(validArtifact), {
  valid: true,
  issues: [],
});

const countMismatch = auditCatalogExceptionArtifact({
  ...validArtifact,
  summary: { ...validArtifact.summary, exceptionCount: 1 },
});
assert.equal(countMismatch.valid, false);
assert(countMismatch.issues.some((issue) => issue.code === "count_mismatch"));

const duplicateItem = auditCatalogExceptionArtifact({
  ...validArtifact,
  summary: {
    ...validArtifact.summary,
    exceptionCount: 3,
    byPriority: { critical: 2, high: 0, medium: 1, low: 0 },
    byGroup: { identity: 2, source: 0, content: 1, commerce: 0 },
  },
  queue: [queue[0]!, queue[0]!, queue[1]!],
});
assert.equal(duplicateItem.valid, false);
assert(
  duplicateItem.issues.some((issue) => issue.code === "duplicate_queue_item")
);

const badPrioritySummary = auditCatalogExceptionArtifact({
  ...validArtifact,
  summary: {
    ...validArtifact.summary,
    byPriority: { critical: 0, high: 0, medium: 2, low: 0 },
  },
});
assert.equal(badPrioritySummary.valid, false);
assert(
  badPrioritySummary.issues.some(
    (issue) => issue.code === "priority_summary_mismatch"
  )
);

console.log("catalog exception artifact audit self-test passed");
