/**
 * Direct pipeline worker — no admin cookie, uses .env.local + Supabase service role.
 * Usage: npx tsx scripts/pipeline-worker-direct.ts --mode=dry_run --brands=3 --tick=3 --maxTicks=20
 */
import { loadEnvLocal, hasRequiredPipelineEnv } from "./load-env-local.mjs";

loadEnvLocal();

if (!hasRequiredPipelineEnv()) {
  console.error(
    "[pipeline-worker] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env (.env.local). Values not printed."
  );
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  })
);

const mode = args.mode === "commit" ? "commit" : "dry_run";
if (mode === "commit" && args.allowCommit !== "true") {
  console.error(
    "[pipeline-worker] commit mode requires --allowCommit=true (scheduler stays dry_run)"
  );
  process.exit(1);
}

async function main() {
  const { runPipelineWorker } = await import("../src/lib/pipeline/worker");
  const result = await runPipelineWorker({
    mode,
    brandLimit: Number(args.brands ?? 3),
    productLimitPerBrand: Number(args.products ?? 5),
    tickLimit: Number(args.tick ?? 3),
    maxTicks: Number(args.maxTicks ?? 30),
    batchId: args.batch || undefined,
    workerId: args.workerId || `scheduler-${process.pid}`,
  });
  console.log("[pipeline-worker] done", {
    batchId: result.batchId,
    ticks: result.ticks,
    mode,
  });
}

main().catch((err) => {
  console.error(
    "[pipeline-worker] failed",
    err instanceof Error ? err.message : "error"
  );
  process.exit(1);
});
