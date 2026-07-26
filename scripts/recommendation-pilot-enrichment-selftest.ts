/**
 * Selftest for scenario pilot enrichment artifacts (offline, no .env / network).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  mergeIngredientStatus,
  promoteReadiness,
  trustTierRank,
} from "../src/lib/catalog/multiSource";
import type {
  IngredientEvidence,
  ProductReadinessState,
} from "../src/lib/catalog/multiSource";

const OUT = path.join(
  process.cwd(),
  "data",
  "catalog",
  "scenario-pilot-enrichment",
  "2026-07-22"
);

function loadJson<T>(name: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(OUT, name), { encoding: "utf8" })
  ) as T;
}

const scenarioPools = loadJson<
  Record<
    string,
    {
      scenarioId: string;
      brandCapDefault: number;
      affiliateOrAdInScore: boolean;
      slots: Array<{
        productId: string;
        readiness: ProductReadinessState;
        roleTags: string[];
      }>;
    }
  >
>("scenario-pools.json");

const productsFile = loadJson<{
  products: Array<{
    brand: string;
    externalProductId: string;
    ingredientStatus: string;
    images: unknown[];
    offers: unknown[];
    readiness: ProductReadinessState;
    affiliateOrAdInScore?: boolean;
    productIdentity?: { scenarioIds: string[] };
  }>;
}>("products.json");

const reuse = loadJson<{
  reuseRate: number;
  uniqueProducts: number;
  totalSlots: number;
  metTarget: boolean;
  failureReason: string | null;
}>("reuse-analysis.json");

const readinessReport = loadJson<{
  totals: Record<string, number>;
  recommendationReadyTotal: number;
  shortfallNotes: string[];
}>("readiness-report.json");

const scenarioIds = Object.keys(scenarioPools);
assert.equal(scenarioIds.length, 5, "expected 5 scenarios");

let failures = 0;
const allSlotIds: string[] = [];

for (const sid of scenarioIds) {
  const pool = scenarioPools[sid];
  assert.equal(pool.slots.length, 10, `${sid} must have 10 candidates`);
  assert.equal(pool.affiliateOrAdInScore, false, "affiliate never in score");
  assert.ok(
    (pool.brandCapDefault ?? 2) <= 2,
    "brand cap default must be ≤2 (max-3 requires justification flag — not used)"
  );

  const brandCounts: Record<string, number> = {};
  for (const slot of pool.slots) {
    allSlotIds.push(slot.productId);
    const prod = productsFile.products.find(
      (p) => p.externalProductId === slot.productId
    );
    assert.ok(prod, `missing product ${slot.productId}`);
    assert.equal(prod.affiliateOrAdInScore, false);
    const brandKey = prod.brand.trim().toLowerCase();
    brandCounts[brandKey] = (brandCounts[brandKey] || 0) + 1;

    if (slot.readiness === "recommendation_ready") {
      const okInci =
        prod.ingredientStatus === "verified" ||
        prod.ingredientStatus === "cross_source_confirmed";
      if (!okInci) {
        failures += 1;
        console.error(
          "recommendation_ready without verified/cross_source_confirmed:",
          slot.productId,
          prod.ingredientStatus
        );
      }
      if (!prod.images?.length || !prod.offers?.length) {
        failures += 1;
        console.error(
          "recommendation_ready missing image or offer:",
          slot.productId
        );
      }
    }
  }

  for (const [b, n] of Object.entries(brandCounts)) {
    if (n > 2) {
      failures += 1;
      console.error(`${sid} brand cap exceeded for ${b}: ${n}`);
    }
  }
  console.log(`${sid}: 10 slots ok, brands`, brandCounts);
}

assert.equal(allSlotIds.length, 50, "5×10 slots");

if (reuse.reuseRate < 0.15 || reuse.reuseRate > 0.35) {
  if (!reuse.failureReason) {
    failures += 1;
    console.error("reuseRate out of range without failureReason", reuse);
  } else {
    console.warn(
      "reuseRate shortfall documented:",
      reuse.failureReason,
      reuse
    );
  }
} else {
  console.log("reuseRate in target:", reuse.reuseRate);
}

// Organic score fields absent
const rawPools = fs.readFileSync(path.join(OUT, "scenario-pools.json"), {
  encoding: "utf8",
});
assert.equal(rawPools.includes("organicScore"), false);
assert.equal(rawPools.includes("affiliateScore"), false);

// Pure logic smoke: trust rank + promote
assert.ok(trustTierRank("A") < trustTierRank("B"));
const evidences: IngredientEvidence[] = [
  {
    raw: "Water, Glycerin, Butylene Glycol, Niacinamide, Panthenol, Allantoin",
    status: "source_verified_candidate",
    trust: "B",
    channel: "naver_brand_store",
    sourceUrl: "https://example.invalid/a",
    checkedAt: "2026-07-22T00:00:00.000Z",
  },
  {
    raw: "Water, Glycerin, Butylene Glycol, Niacinamide, Panthenol, Allantoin, Centella",
    status: "source_verified_candidate",
    trust: "C",
    channel: "oliveyoung",
    sourceUrl: "https://example.invalid/b",
    checkedAt: "2026-07-22T00:00:00.000Z",
  },
];
const merged = mergeIngredientStatus(evidences);
assert.ok(
  merged.status === "cross_source_confirmed" ||
    merged.status === "source_verified_candidate"
);
const promoted = promoteReadiness({
  ingredientStatus: "verified",
  images: [
    {
      imageUrl: "https://example.invalid/img.jpg",
      trust: "A",
      channel: "official_brand",
      sourcePageUrl: "https://example.invalid/",
      checkedAt: "2026-07-22T00:00:00.000Z",
      isOfficialSource: true,
    },
  ],
  offers: [
    {
      retailerName: "official",
      trust: "A",
      channel: "official_brand",
      purchaseUrl: "https://example.invalid/p",
      price: null,
      currency: "USD",
      inStock: null,
      isOfficialStore: true,
      checkedAt: "2026-07-22T00:00:00.000Z",
      sourceVerified: true,
    },
  ],
  hasIdentity: true,
});
assert.equal(promoted.readiness, "recommendation_ready");

const needsReview = promoteReadiness({
  ingredientStatus: "needs_review",
  images: [],
  offers: [],
  hasIdentity: true,
});
assert.equal(needsReview.readiness, "review_required");

const catalogReady = promoteReadiness({
  ingredientStatus: "ingredient_incomplete",
  images: [
    {
      imageUrl: "https://example.invalid/img.jpg",
      trust: "A",
      channel: "official_brand",
      sourcePageUrl: "https://example.invalid/products/x",
      checkedAt: "2026-07-22T00:00:00.000Z",
      isOfficialSource: true,
    },
  ],
  offers: [
    {
      retailerName: "official",
      trust: "A",
      channel: "official_brand",
      purchaseUrl: "https://example.invalid/products/x",
      price: null,
      currency: "USD",
      inStock: null,
      isOfficialStore: true,
      checkedAt: "2026-07-22T00:00:00.000Z",
      sourceVerified: true,
    },
  ],
  hasIdentity: true,
});
assert.equal(
  catalogReady.readiness,
  "catalog_ready",
  "identity+image+offer with incomplete INCI must be catalog_ready, not trend_candidate"
);

console.log("\nreadiness totals", readinessReport.totals);
console.log(
  "recommendationReadyTotal",
  readinessReport.recommendationReadyTotal
);
console.log("uniqueProducts", reuse.uniqueProducts);

if (failures > 0) {
  console.error("SELFTEST FAILED", failures);
  process.exit(1);
}
console.log("\nSELFTEST PASSED");
