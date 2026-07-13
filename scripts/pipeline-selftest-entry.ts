import { runPipelineSelftests } from "../src/lib/pipeline/selftest";
import { runJourneySelftests } from "../src/lib/user/journey-selftest";
import { runRecommendScoreFixSelftests } from "../src/lib/recommend/recommend-selftest";

const result = runPipelineSelftests();
const journey = runJourneySelftests();
const recommend = runRecommendScoreFixSelftests();
console.log("[pipeline-selftest] ok", {
  ...result,
  journeyChecks: journey.checks,
  recommendChecks: recommend.checks,
});
