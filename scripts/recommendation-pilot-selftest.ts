/**
 * Selftest for scenario Top10 pilot artifacts (2026-07-22).
 * Loads 5 pool JSON files, runs pure validators, prints metrics.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  assertBrandCap,
  assertNoAffiliateInScore,
  assertReadinessEnum,
  computePoolMetrics,
  validatePoolShape,
  type PilotPoolFile,
} from "../src/lib/recommend/scenarios/pilotPoolValidate";

const PILOT_DIR = path.join(
  process.cwd(),
  "data",
  "catalog",
  "scenario-pilot",
  "2026-07-22"
);

const FILES = [
  "A-kr-redness-sensitive-cream.json",
  "B-pilot-dryness-barrier-serum.json",
  "C-kr-acne-pores-toner.json",
  "D-kr-uv-sunscreen-sensitive.json",
  "E-kr-aging-eye-cream.json",
] as const;

const EXPECTED_IDS: Record<string, string> = {
  "A-kr-redness-sensitive-cream.json": "kr-redness-sensitive-cream",
  "B-pilot-dryness-barrier-serum.json": "pilot-dryness-barrier-serum",
  "C-kr-acne-pores-toner.json": "kr-acne-pores-toner",
  "D-kr-uv-sunscreen-sensitive.json": "kr-uv-sunscreen-sensitive",
  "E-kr-aging-eye-cream.json": "kr-aging-eye-cream",
};

function loadPool(file: string): PilotPoolFile {
  const raw = fs.readFileSync(path.join(PILOT_DIR, file), { encoding: "utf8" });
  return JSON.parse(raw) as PilotPoolFile;
}

const allIdentities: string[] = [];
const perScenarioMetrics: Record<string, ReturnType<typeof computePoolMetrics>> =
  {};
let recommendationReadyTotal = 0;
let failures = 0;

for (const file of FILES) {
  const pool = loadPool(file);
  console.log(`\n=== ${file} ===`);

  const shape = validatePoolShape(pool);
  if (!shape.ok) {
    failures += 1;
    console.error("validatePoolShape FAILED:", shape.errors);
  } else {
    console.log("validatePoolShape: ok");
  }

  assert.equal(pool.scenarioId, EXPECTED_IDS[file], "scenarioId mismatch");
  if (file === "B-pilot-dryness-barrier-serum.json") {
    const coreRef = (pool as { coreScenarioRef?: string }).coreScenarioRef;
    assert.equal(
      coreRef,
      "kr-dryness-barrier-essence",
      "B coreScenarioRef must be kr-dryness-barrier-essence"
    );
  }

  const readiness = assertReadinessEnum(pool.candidates);
  if (!readiness.ok) {
    failures += 1;
    console.error("assertReadinessEnum FAILED:", readiness.invalid);
  } else {
    console.log("assertReadinessEnum: ok");
  }

  const brandCap = assertBrandCap(pool.candidates, pool.brandCapDefault ?? 2);
  if (!brandCap.ok) {
    failures += 1;
    console.error("assertBrandCap FAILED:", brandCap.violations);
  } else {
    console.log("assertBrandCap: ok");
  }

  const affiliate = assertNoAffiliateInScore(
    pool.candidates,
    pool.affiliateOrAdInScore
  );
  if (!affiliate.ok) {
    failures += 1;
    console.error("assertNoAffiliateInScore FAILED:", affiliate.offenders);
  } else {
    console.log("assertNoAffiliateInScore: ok");
  }

  const metrics = computePoolMetrics(pool.candidates);
  perScenarioMetrics[pool.scenarioId] = metrics;
  recommendationReadyTotal += metrics.recommendationReadyCount;
  allIdentities.push(...metrics.identities);
  console.log(
    "metrics:",
    JSON.stringify(
      {
        poolSize: metrics.poolSize,
        recommendationReadyCount: metrics.recommendationReadyCount,
        readinessCounts: metrics.readinessCounts,
        distinctBrands: metrics.distinctBrands,
        distinctRoleTags: metrics.distinctRoleTags,
      },
      null,
      2
    )
  );

  // Spot checks for documented honesty rules
  if (pool.scenarioId === "kr-redness-sensitive-cream") {
    const ready = pool.candidates.filter(
      (c) => c.readiness === "recommendation_ready"
    );
    assert.equal(ready.length, 2);
    const ids = new Set(ready.map((c) => c.productIdentity));
    assert.ok(ids.has("cosrx-advanced-snail-92-all-in-one-cream"));
    assert.ok(ids.has("aestura-atobarrier365-cream"));
  }
  if (pool.scenarioId === "kr-uv-sunscreen-sensitive") {
    const birch = pool.candidates.find(
      (c) => c.productIdentity === "round-lab-birch-juice-moisturizing-sunscreen"
    );
    assert.equal(birch?.readiness, "ingredient_candidate");
    const boj = pool.candidates.find(
      (c) =>
        c.productIdentity === "beauty-of-joseon-relief-sun-rice-probiotics"
    );
    assert.equal(boj?.readiness, "catalog_ready");
  }
}

const unique = new Set(allIdentities);
const reuseRate =
  allIdentities.length === 0 ? 0 : 1 - unique.size / allIdentities.length;

const summaryPath = path.join(PILOT_DIR, "SUMMARY.json");
const summary = JSON.parse(
  fs.readFileSync(summaryPath, { encoding: "utf8" })
) as {
  totals: {
    uniqueProductIdentities: number;
    reuseRate: number;
    recommendationReadyTotal: number;
    candidateSlots: number;
  };
};

console.log("\n=== SUMMARY metrics ===");
console.log(
  JSON.stringify(
    {
      candidateSlots: allIdentities.length,
      uniqueProductIdentities: unique.size,
      reuseRate: Number(reuseRate.toFixed(4)),
      recommendationReadyTotal,
      perScenario: Object.fromEntries(
        Object.entries(perScenarioMetrics).map(([id, m]) => [
          id,
          {
            recommendationReadyCount: m.recommendationReadyCount,
            readinessCounts: m.readinessCounts,
          },
        ])
      ),
      summaryFile: summary.totals,
    },
    null,
    2
  )
);

assert.equal(summary.totals.candidateSlots, allIdentities.length);
assert.equal(summary.totals.uniqueProductIdentities, unique.size);
assert.equal(summary.totals.recommendationReadyTotal, recommendationReadyTotal);

if (failures > 0) {
  console.error(`\nFAILED with ${failures} validator group(s)`);
  process.exit(1);
}

console.log("\nrecommendation-pilot-selftest: PASS");
