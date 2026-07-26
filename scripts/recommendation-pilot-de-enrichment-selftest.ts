/**
 * Selftest for D/E scenario pilot enrichment artifacts (offline).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  mergeDeEvidencePack,
  applyPoolReplacements,
} from "../src/lib/catalog/multiSource/pilotDeEnrichment";
import type { EvidencePack } from "../src/lib/catalog/multiSource/pilotEnrichment";
import type { ProductReadinessState } from "../src/lib/catalog/multiSource";

const OUT = path.join(
  process.cwd(),
  "data",
  "catalog",
  "scenario-pilot-enrichment-de",
  "2026-07-22"
);
const BASE = path.join(
  process.cwd(),
  "data",
  "catalog",
  "scenario-pilot-enrichment",
  "2026-07-22"
);

function loadJson<T>(dir: string, name: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(dir, name), { encoding: "utf8" })
  ) as T;
}

const scenarioPools = loadJson<
  Record<
    string,
    {
      scenarioId: string;
      affiliateOrAdInScore: boolean;
      brandCapDefault: number;
      slots: Array<{
        productId: string;
        readiness: ProductReadinessState;
      }>;
    }
  >
>(OUT, "scenario-pools.json");

const productsFile = loadJson<{
  products: Array<{
    brand: string;
    externalProductId: string;
    ingredientStatus: string;
    images: unknown[];
    offers: unknown[];
    readiness: ProductReadinessState;
    affiliateOrAdInScore?: boolean;
  }>;
}>(OUT, "products.json");

const readinessReport = loadJson<{
  recommendationReadyTotal: number;
  perScenario: Record<string, { recommendation_ready: number }>;
  shortfallNotes: string[];
}>(OUT, "readiness-report.json");

const replacementReport = loadJson<{
  scenarios: Record<
    string,
    { replacements: Array<{ out: string; in: string; reason: string }> }
  >;
}>(OUT, "candidate-replacement-report.json");

const baseline = loadJson<{
  recommendationReadyTotal: number;
  perScenario: Record<string, { recommendation_ready: number }>;
}>(BASE, "readiness-report.json");

const overlay = loadJson<{ poolReplacements: Record<string, unknown[]> }>(
  OUT,
  "_de-evidence-overlay.json"
);

const basePack = loadJson<EvidencePack>(BASE, "_evidence-pack.json");
const merged = mergeDeEvidencePack(basePack, overlay as never);
assert.ok(
  merged.products.some(
    (p) => p.productIdentity === "aestura-derma-uv365-barrier-hydro-mineral-sunscreen"
  ),
  "merged pack must include aestura mineral identity"
);

const { plan } = applyPoolReplacements(basePack.poolSlotPlan!, {
  "kr-uv-sunscreen-sensitive": [
    {
      out: "aestura-derma-uv-365-barrier-hydro-sunscreen",
      in: "aestura-derma-uv365-barrier-hydro-mineral-sunscreen",
      reason: "test",
    },
  ],
});
assert.equal(
  plan["kr-uv-sunscreen-sensitive"].includes(
    "aestura-derma-uv365-barrier-hydro-mineral-sunscreen"
  ),
  true
);

let failures = 0;
const DE = "kr-uv-sunscreen-sensitive";
const EE = "kr-aging-eye-cream";

for (const sid of [DE, EE]) {
  const pool = scenarioPools[sid];
  assert.equal(pool.slots.length, 10, `${sid} must have 10 slots`);
  assert.equal(pool.affiliateOrAdInScore, false);

  const reps = replacementReport.scenarios[sid]?.replacements ?? [];
  if (reps.length > 2) {
    failures += 1;
    console.error(`${sid}: too many replacements`, reps.length);
  }

  for (const slot of pool.slots) {
    const prod = productsFile.products.find(
      (p) => p.externalProductId === slot.productId
    );
    assert.ok(prod, `missing product ${slot.productId}`);
    assert.equal(prod.affiliateOrAdInScore, false);

    if (slot.readiness === "recommendation_ready") {
      const okInci =
        prod.ingredientStatus === "verified" ||
        prod.ingredientStatus === "cross_source_confirmed";
      if (!okInci || !prod.images?.length || !prod.offers?.length) {
        failures += 1;
        console.error("invalid recommendation_ready:", slot.productId);
      }
    }
  }
}

const dReady = readinessReport.perScenario[DE].recommendation_ready;
const eReady = readinessReport.perScenario[EE].recommendation_ready;
const priorD = baseline.perScenario[DE].recommendation_ready;
const priorE = baseline.perScenario[EE].recommendation_ready;

console.log("D ready:", priorD, "→", dReady);
console.log("E ready:", priorE, "→", eReady);
console.log(
  "Total ready:",
  baseline.recommendationReadyTotal,
  "→",
  readinessReport.recommendationReadyTotal
);

assert.ok(dReady >= priorD, "D ready must not regress");
assert.ok(eReady >= priorE, "E ready must not regress");

const aesturaMineral = productsFile.products.find(
  (p) => p.externalProductId === "aestura-derma-uv365-barrier-hydro-mineral-sunscreen"
);
assert.ok(aesturaMineral, "aestura mineral product required");
assert.equal(
  aesturaMineral!.readiness,
  "ingredient_candidate",
  "Aestura must stay below recommendation_ready without KR-label INCI"
);
assert.equal(aesturaMineral!.ingredientStatus, "source_verified_candidate");

const roundLabUs = scenarioPools[DE].slots.find(
  (s) => s.productId === "round-lab-birch-juice-moisturizing-sunscreen-us"
);
assert.ok(roundLabUs, "round lab US split must be in D pool");
assert.equal(roundLabUs!.readiness, "review_required");

// A/B/C unchanged vs baseline
for (const sid of [
  "kr-redness-sensitive-cream",
  "pilot-dryness-barrier-serum",
  "kr-acne-pores-toner",
]) {
  assert.equal(
    readinessReport.perScenario[sid].recommendation_ready,
    baseline.perScenario[sid].recommendation_ready,
    `${sid} ready count must match baseline enrichment`
  );
}

const rawPools = fs.readFileSync(path.join(OUT, "scenario-pools.json"), {
  encoding: "utf8",
});
assert.equal(rawPools.includes("organicScore"), false);
assert.equal(rawPools.includes("affiliateScore"), false);

if (dReady < 4 || eReady < 4) {
  assert.ok(
    readinessReport.shortfallNotes.some(
      (n) => n.includes(DE) || n.includes("Total")
    ),
    "shortfall must be documented when D/E below target"
  );
  console.warn("SHORTFALL documented:", readinessReport.shortfallNotes);
}

if (failures > 0) {
  console.error("DE SELFTEST FAILED", failures);
  process.exit(1);
}
console.log("\nDE SELFTEST PASSED");
