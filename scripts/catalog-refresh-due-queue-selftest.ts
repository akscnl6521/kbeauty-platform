import assert from "node:assert/strict";
import { buildCatalogRefreshDueQueue } from "@/lib/catalog/refreshDueQueue";

const cutoff = new Date("2026-07-19T00:00:00.000Z");
const queue = buildCatalogRefreshDueQueue(
  [
    {
      canonicalKey: "b",
      slug: "b",
      brand: "B",
      nameKo: "B",
      officialUrl: null,
      refresh: {
        priority: "normal",
        nextCheckAt: "2026-07-18T00:00:00.000Z",
        checks: ["price"],
      },
    },
    {
      canonicalKey: "a",
      slug: "a",
      brand: "A",
      nameKo: "A",
      officialUrl: null,
      refresh: {
        priority: "urgent",
        nextCheckAt: "2026-07-19T00:00:00.000Z",
        checks: ["inci", "image"],
      },
    },
    {
      canonicalKey: "future",
      slug: "future",
      brand: "F",
      nameKo: "F",
      officialUrl: null,
      refresh: {
        priority: "high",
        nextCheckAt: "2026-07-20T00:00:00.000Z",
        checks: ["offer"],
      },
    },
  ],
  cutoff
);

assert.equal(queue.summary.totalDue, 2);
assert.deepEqual(
  queue.items.map((item) => item.canonicalKey),
  ["a", "b"]
);
assert.equal(queue.summary.byPriority.urgent, 1);
assert.equal(queue.summary.byPriority.normal, 1);
assert.equal(queue.summary.byCheck.inci, 1);
assert.equal(queue.productionTouched, false);
assert.equal(queue.databaseTouched, false);
assert.equal(queue.writeMode, "artifact_only");

assert.throws(
  () =>
    buildCatalogRefreshDueQueue(
      [
        {
          canonicalKey: "bad",
          slug: "bad",
          brand: "Bad",
          nameKo: "Bad",
          officialUrl: null,
          refresh: {
            priority: "low",
            nextCheckAt: "not-a-date",
            checks: [],
          },
        },
      ],
      cutoff
    ),
  /INVALID_NEXT_CHECK_AT:bad/
);

console.log("catalog-refresh-due-queue-selftest: ok");
