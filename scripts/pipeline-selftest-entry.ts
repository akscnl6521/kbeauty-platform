import { runPipelineSelftests } from "../src/lib/pipeline/selftest";
import { runJourneySelftests } from "../src/lib/user/journey-selftest";
import { runRecommendScoreFixSelftests } from "../src/lib/recommend/recommend-selftest";
import { runLocalizationDisplaySelftests } from "../src/lib/recommend/localization-selftest";
import { runRednessObservationSelftests } from "../src/lib/ai/redness-selftest";
import { runAnalyzeInputSnapshotSelftests } from "../src/lib/ai/analyze-input-snapshot-selftest";
import { runAnalyzeReferencePreviewSelftests } from "../src/lib/ai/analyze-reference-preview-selftest";

const result = runPipelineSelftests();
const journey = runJourneySelftests();
const recommend = runRecommendScoreFixSelftests();
const localization = runLocalizationDisplaySelftests();
const redness = runRednessObservationSelftests();
const analyzeInput = runAnalyzeInputSnapshotSelftests();
const referencePreview = runAnalyzeReferencePreviewSelftests();
console.log("[pipeline-selftest] ok", {
  ...result,
  journeyChecks: journey.checks,
  recommendChecks: recommend.checks,
  localizationChecks: localization.checks,
  rednessChecks: redness.checks,
  analyzeInputChecks: analyzeInput.checks,
  referencePreviewChecks: referencePreview.checks,
});
