import assert from "node:assert/strict";
import {
  summarizeScenarioCoverage,
  type ScenarioCatalogGap,
} from "../src/lib/recommend/scenarios/gapAnalysis";
import { KR_CORE_SCENARIOS } from "../src/lib/recommend/scenarios/krCoreScenarios";
import { getScenarioCoverageReport } from "../src/lib/recommend/scenarios/scenarioCoverageReport";

// Fixture aggregation math — no real product data involved.
{
  const gaps: ScenarioCatalogGap[] = [
    {
      scenarioId: "a",
      priorityArea: "redness_sensitive",
      matchedProductIds: ["1", "2"],
      recommendationReadyCount: 1,
      evidenceGaps: [],
    },
    {
      scenarioId: "b",
      priorityArea: "redness_sensitive",
      matchedProductIds: [],
      recommendationReadyCount: 0,
      evidenceGaps: [],
    },
    {
      scenarioId: "c",
      priorityArea: "dry_barrier",
      matchedProductIds: ["3"],
      recommendationReadyCount: 0,
      evidenceGaps: ["image_unknown_from_backup"],
    },
  ];

  const summary = summarizeScenarioCoverage(gaps);
  assert.equal(summary.scenarioCount, 3);
  assert.equal(summary.readyScenarioCount, 1);
  assert.equal(summary.readinessRatePercent, 33.3);

  const redness = summary.byArea.find((a) => a.priorityArea === "redness_sensitive");
  assert.ok(redness);
  assert.equal(redness!.scenarioCount, 2);
  assert.equal(redness!.readyScenarioCount, 1);
  assert.equal(redness!.totalMatchedProducts, 2);
  assert.equal(redness!.readinessRatePercent, 50);

  const dry = summary.byArea.find((a) => a.priorityArea === "dry_barrier");
  assert.ok(dry);
  assert.equal(dry!.readyScenarioCount, 0);
  assert.equal(dry!.readinessRatePercent, 0);
}

// Empty input must not divide by zero.
{
  const summary = summarizeScenarioCoverage([]);
  assert.equal(summary.scenarioCount, 0);
  assert.equal(summary.readinessRatePercent, 0);
  assert.equal(summary.byArea.length, 0);
}

// Live offline report — honesty invariants, no DB/network, no auto-fill.
{
  const report = getScenarioCoverageReport();
  assert.equal(report.summary.scenarioCount, KR_CORE_SCENARIOS.length);
  assert.equal(report.gaps.length, KR_CORE_SCENARIOS.length);
  assert.ok(report.productCount > 0, "expected offline backup products");
  assert.ok(
    report.generatedFrom.includes("offline"),
    "report must self-identify as offline snapshot"
  );

  // readyScenarioCount can never exceed what the raw gaps independently report
  const rawReadyCount = report.gaps.filter(
    (g) => g.recommendationReadyCount > 0
  ).length;
  assert.equal(report.summary.readyScenarioCount, rawReadyCount);

  const areaScenarioTotal = report.summary.byArea.reduce(
    (sum, a) => sum + a.scenarioCount,
    0
  );
  assert.equal(areaScenarioTotal, report.summary.scenarioCount);
}

console.log("scenario-coverage-selftest ok");
