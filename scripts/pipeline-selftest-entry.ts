import { runPipelineSelftests } from "../src/lib/pipeline/selftest";

const result = runPipelineSelftests();
console.log("[pipeline-selftest] ok", result);
