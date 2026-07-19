import { runPipelineSelftests } from "../src/lib/pipeline/selftest";
import { runJourneySelftests } from "../src/lib/user/journey-selftest";
import { runRecommendScoreFixSelftests } from "../src/lib/recommend/recommend-selftest";
import { runLocalizationDisplaySelftests } from "../src/lib/recommend/localization-selftest";
import { runRecommendQualityRegressionSelftests } from "../src/lib/recommend/quality-regression-selftest";
import { runRednessObservationSelftests } from "../src/lib/ai/redness-selftest";
import { runAnalyzeInputSnapshotSelftests } from "../src/lib/ai/analyze-input-snapshot-selftest";
import { runAnalyzeReferencePreviewSelftests } from "../src/lib/ai/analyze-reference-preview-selftest";
import { runCatalogAuditSelftests } from "../src/lib/catalog/catalog-audit-selftest";
import { runCatalogAutomationSelftests } from "../src/lib/catalog/automation/catalog-automation-selftest";
import { runScalpHairFoundationSelftests } from "../src/lib/catalog/scalpHair/scalp-hair-selftest";
import { runBeautyCatalogFoundationSelftests } from "../src/lib/catalog/taxonomy/beauty-catalog-selftest";
import { runProductCreateSelftests } from "../src/lib/admin/product-create-selftest";

type TestCase = {
  name: string;
  run: () => unknown | Promise<unknown>;
};

const cases: TestCase[] = [
  { name: "pipeline", run: runPipelineSelftests },
  { name: "journey", run: runJourneySelftests },
  { name: "recommend-score", run: runRecommendScoreFixSelftests },
  { name: "localization", run: runLocalizationDisplaySelftests },
  { name: "quality-regression", run: runRecommendQualityRegressionSelftests },
  { name: "redness", run: runRednessObservationSelftests },
  { name: "analyze-input", run: runAnalyzeInputSnapshotSelftests },
  { name: "analyze-reference", run: runAnalyzeReferencePreviewSelftests },
  { name: "catalog-audit", run: runCatalogAuditSelftests },
  { name: "catalog-automation", run: runCatalogAutomationSelftests },
  { name: "scalp-hair", run: runScalpHairFoundationSelftests },
  { name: "beauty-catalog", run: runBeautyCatalogFoundationSelftests },
  { name: "product-create", run: runProductCreateSelftests },
];

async function main(): Promise<void> {
  const requested = process.argv[2]?.trim();
  const selected = requested ? cases.filter((test) => test.name === requested) : cases;
  if (selected.length === 0) {
    throw new Error(`unknown pipeline diagnostic suite: ${requested}`);
  }

  for (const test of selected) {
    await test.run();
    console.log(`[pipeline-diagnostic] PASS ${test.name}`);
  }
}

void main();
