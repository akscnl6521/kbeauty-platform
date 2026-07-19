import { getCatalogRefreshPlan } from "@/lib/catalog/refreshPolicy";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[catalog-refresh-policy] ${message}`);
}

const now = new Date("2026-07-19T00:00:00.000Z");

const complete = getCatalogRefreshPlan(
  {
    disposition: "auto_register",
    officialSourceConfirmed: true,
    hasFullInci: true,
    hasImage: true,
    hasRetailer: true,
  },
  now
);
assert(complete.intervalDays === 30, "complete official candidate refreshes in 30 days");
assert(complete.priority === "normal", "complete candidate is normal priority");
assert(complete.checks.includes("stock_price"), "verified retailer gets stock/price check");

const incomplete = getCatalogRefreshPlan(
  {
    disposition: "auto_register",
    officialSourceConfirmed: true,
    hasFullInci: false,
    hasImage: false,
    hasRetailer: false,
  },
  now
);
assert(incomplete.intervalDays === 7, "incomplete candidate refreshes in 7 days");
assert(incomplete.priority === "high", "incomplete candidate is high priority");
assert(incomplete.checks.includes("full_inci"), "missing INCI is scheduled");
assert(incomplete.checks.includes("image"), "missing image is scheduled");
assert(incomplete.checks.includes("retailer"), "missing retailer is scheduled");

const review = getCatalogRefreshPlan(
  {
    disposition: "needs_review",
    officialSourceConfirmed: false,
    hasFullInci: false,
    hasImage: true,
    hasRetailer: false,
  },
  now
);
assert(review.intervalDays === 3, "review candidate refreshes in 3 days");
assert(review.reasons.includes("official_source_unconfirmed"), "source gap is recorded");

const failed = getCatalogRefreshPlan(
  {
    disposition: "failed",
    officialSourceConfirmed: false,
    hasFullInci: false,
    hasImage: false,
    hasRetailer: false,
  },
  now
);
assert(failed.intervalDays === 1, "failed candidate retries next day");
assert(failed.priority === "urgent", "failed candidate is urgent");

const duplicate = getCatalogRefreshPlan(
  {
    disposition: "duplicate",
    officialSourceConfirmed: true,
    hasFullInci: true,
    hasImage: true,
    hasRetailer: true,
  },
  now
);
assert(duplicate.intervalDays === 90, "duplicate is monitored quarterly");
assert(duplicate.priority === "low", "duplicate is low priority");

console.log(JSON.stringify({ ok: true, checks: 13 }));
