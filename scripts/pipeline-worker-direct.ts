/**
 * Direct pipeline worker — fixed entry for Task Scheduler.
 *
 * Always:
 *   node scripts/run-pipeline-worker.mjs
 *
 * Reads config/pipeline-operation.json (+ data/pipeline/operation-overrides.json).
 * Does not accept brands/products/allowCommit/secrets from CLI.
 */
import { loadEnvLocal, hasRequiredPipelineEnv } from "./load-env-local.mjs";

loadEnvLocal();

if (!hasRequiredPipelineEnv()) {
  console.error(
    "[pipeline-worker] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env (.env.local). Values not printed."
  );
  process.exit(1);
}

const argv = process.argv.slice(2);
const forbidden = argv.filter((a) =>
  /--(brands|products|allowCommit|allowGatedCandidateInsert|mode|batch|cookie|email|uuid)=/i.test(
    a
  )
);
if (forbidden.length) {
  console.error(
    "[pipeline-worker] refusing CLI overrides (use config/pipeline-operation.json):",
    forbidden.map((f) => f.split("=")[0]).join(", ")
  );
  process.exit(1);
}

async function main() {
  const { runPipelineWorkerFromConfig } = await import(
    "../src/lib/pipeline/worker"
  );
  const result = await runPipelineWorkerFromConfig({
    workerId: `scheduler-${process.pid}`,
    triggerType: "scheduler",
  });
  console.log("[pipeline-worker] done", {
    batchId: result.batchId,
    ticks: result.ticks,
    mode: "mode" in result ? result.mode : undefined,
    writeScope: "writeScope" in result ? result.writeScope : undefined,
    skipped: "skipped" in result ? result.skipped : undefined,
  });
}

main().catch((err) => {
  console.error(
    "[pipeline-worker] failed",
    err instanceof Error ? err.message : "error"
  );
  process.exit(1);
});
