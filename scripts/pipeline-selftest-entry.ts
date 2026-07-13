import { runPipelineSelftests } from "../src/lib/pipeline/selftest";
import { runJourneySelftests } from "../src/lib/user/journey-selftest";
import { runRecommendScoreFixSelftests } from "../src/lib/recommend/recommend-selftest";
import { runLocalizationDisplaySelftests } from "../src/lib/recommend/localization-selftest";
import { runRednessObservationSelftests } from "../src/lib/ai/redness-selftest";

const result = runPipelineSelftests();
const journey = runJourneySelftests();
const recommend = runRecommendScoreFixSelftests();
const localization = runLocalizationDisplaySelftests();
const redness = runRednessObservationSelftests();
console.log("[pipeline-selftest] ok", {
  ...result,
  journeyChecks: journey.checks,
  recommendChecks: recommend.checks,
  localizationChecks: localization.checks,
  rednessChecks: redness.checks,
});
