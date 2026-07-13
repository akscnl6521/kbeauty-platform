import { runPipelineSelftests } from "../src/lib/pipeline/selftest";
import { runJourneySelftests } from "../src/lib/user/journey-selftest";

const result = runPipelineSelftests();
const journey = runJourneySelftests();
console.log("[pipeline-selftest] ok", { ...result, journeyChecks: journey.checks });
