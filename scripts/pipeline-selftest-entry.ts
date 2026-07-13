import { runPipelineSelftests } from "../src/lib/pipeline/selftest";
import { runJourneySelftests } from "../src/lib/user/journey-selftest";
import { runRecommendScoreFixSelftests } from "../src/lib/recommend/recommend-selftest";
import { runLocalizationDisplaySelftests } from "../src/lib/recommend/localization-selftest";
import { runRednessObservationSelftests } from "../src/lib/ai/redness-selftest";
import { runAnalyzeInputSnapshotSelftests } from "../src/lib/ai/analyze-input-snapshot-selftest";
import { runAnalyzeReferencePreviewSelftests } from "../src/lib/ai/analyze-reference-preview-selftest";
import { runCatalogAuditSelftests } from "../src/lib/catalog/catalog-audit-selftest";
import { runCatalogAutomationSelftests } from "../src/lib/catalog/automation/catalog-automation-selftest";
import { runScalpHairFoundationSelftests } from "../src/lib/catalog/scalpHair/scalp-hair-selftest";
import { runBeautyCatalogFoundationSelftests } from "../src/lib/catalog/taxonomy/beauty-catalog-selftest";

async function main() {
  const result = runPipelineSelftests();
  const journey = runJourneySelftests();
  const recommend = runRecommendScoreFixSelftests();
  const localization = runLocalizationDisplaySelftests();
  const redness = runRednessObservationSelftests();
  const analyzeInput = runAnalyzeInputSnapshotSelftests();
  const referencePreview = runAnalyzeReferencePreviewSelftests();
  const catalogAudit = runCatalogAuditSelftests();
  const catalogAutomation = await runCatalogAutomationSelftests();
  const scalpHair = runScalpHairFoundationSelftests();
  const beautyCatalog = runBeautyCatalogFoundationSelftests();
  console.log("[pipeline-selftest] ok", {
    ...result,
    journeyChecks: journey.checks,
    recommendChecks: recommend.checks,
    localizationChecks: localization.checks,
    rednessChecks: redness.checks,
    analyzeInputChecks: analyzeInput.checks,
    referencePreviewChecks: referencePreview.checks,
    catalogAuditChecks: catalogAudit.checks,
    catalogAutomationChecks: catalogAutomation.checks,
    scalpHairChecks: scalpHair.checks,
    beautyCatalogChecks: beautyCatalog.checks,
  });
}


main().catch((err) => {
  console.error(err);
  process.exit(1);
});
