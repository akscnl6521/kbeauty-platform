import assert from "node:assert/strict";
import {
  AFFILIATE_SCORE_FORBIDDEN,
  applyBrandCap,
  checkRoleCoverage,
  DEFAULT_BRAND_CAP,
  MAX_BRAND_CAP_WITH_EVIDENCE,
  resolveBrandCap,
} from "../src/lib/recommend/scenarios/poolRules";
import { KR_CORE_SCENARIOS } from "../src/lib/recommend/scenarios/krCoreScenarios";
import {
  isPoolEntryBlockedByManagementLevel,
  matchScenario,
} from "../src/lib/recommend/scenarios/matchScenario";
import { rankingModifiersChangePool } from "../src/lib/recommend/scenarios/rankingModifiers";

function cartesianUpperBound(): number {
  return (
    9 * 14 * 6 * 3
  );
}

{
  const count = KR_CORE_SCENARIOS.length;
  assert.ok(count >= 25 && count <= 35, `expected 25-35 scenarios, got ${count}`);

  const ids = KR_CORE_SCENARIOS.map((s) => s.scenarioId);
  assert.equal(new Set(ids).size, ids.length, "scenario ids must be unique");

  assert.ok(count < 50, "curated set must stay under 50");
  assert.ok(count < cartesianUpperBound(), "must not be cartesian explosion");
}

{
  assert.equal(isPoolEntryBlockedByManagementLevel("urgent_check"), true);
  assert.equal(isPoolEntryBlockedByManagementLevel("expert_first"), true);
  assert.equal(isPoolEntryBlockedByManagementLevel("cosmetic_care"), false);

  const blocked = matchScenario({
    primaryConcern: "redness",
    productCategory: "cream",
    bodyArea: "face",
    sensitivityLevel: "high",
    managementLevel: "urgent_check",
  });
  assert.equal(blocked, null, "urgent_check must block pool entry");
}

{
  const matched = matchScenario({
    primaryConcern: "redness",
    productCategory: "cream",
    bodyArea: "face",
    sensitivityLevel: "high",
  });
  assert.ok(matched, "expected redness cream scenario");
  assert.equal(matched?.scenarioId, "kr-redness-sensitive-cream");
}

{
  assert.equal(DEFAULT_BRAND_CAP, 2);
  assert.equal(MAX_BRAND_CAP_WITH_EVIDENCE, 3);
  assert.equal(AFFILIATE_SCORE_FORBIDDEN, true);

  const sample = [
    { brand: "A", id: "1" },
    { brand: "A", id: "2" },
    { brand: "A", id: "3" },
    { brand: "B", id: "4" },
  ];
  const capped = applyBrandCap(sample, DEFAULT_BRAND_CAP);
  assert.equal(capped.length, 3);
  assert.equal(capped.filter((x) => x.brand === "A").length, 2);

  const scenario = KR_CORE_SCENARIOS[0];
  assert.equal(resolveBrandCap(scenario, false), 2);
  assert.equal(resolveBrandCap(scenario, true), 3);
}

{
  const weak = checkRoleCoverage(["popular"]);
  assert.equal(weak.ok, false);

  const ok = checkRoleCoverage(["popular", "safety", "value"]);
  assert.equal(ok.ok, true);
  assert.ok(ok.distinctCount >= 2);
}

assert.equal(rankingModifiersChangePool(), false);

console.log("recommendation scenario selftest: ok");
