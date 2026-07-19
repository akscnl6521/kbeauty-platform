import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const root = process.cwd();
const maxEnrichmentPasses = Math.max(
  1,
  Number(process.env.CATALOG_AUTOPILOT_MAX_PASSES ?? "20")
);
const includeCuratedLabels =
  process.env.CATALOG_AUTOPILOT_INCLUDE_CURATED_LABELS === "1";

export function npmCommand(platform: NodeJS.Platform = process.platform): string {
  return platform === "win32" ? "npm.cmd" : "npm";
}

export function catalogAutopilotSteps(options?: {
  includeCuratedLabels?: boolean;
}): string[] {
  const steps = [
    "catalog:full-beauty",
    "catalog:enrich",
    "catalog:dedupe-plan",
    "catalog:inci",
  ];
  if (options?.includeCuratedLabels) steps.push("catalog:labels:sync");
  steps.push("catalog:refresh-plan");
  return steps;
}

function assertStagingLinked(): void {
  const refPath = path.join(root, "supabase", ".temp", "project-ref");
  if (!existsSync(refPath)) throw new Error("missing supabase/.temp/project-ref");
  const linked = readFileSync(refPath, "utf8").trim();
  if (linked === PROD) throw new Error("ABORT_PRODUCTION");
  if (linked !== STAGING) throw new Error(`ABORT_NOT_STAGING:${linked}`);
}

function run(script: string, extraEnv: Record<string, string> = {}): void {
  console.error(`[catalog-autopilot] ${script}`);
  const result = spawnSync(npmCommand(), ["run", script], {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    timeout: Number(process.env.CATALOG_AUTOPILOT_STEP_TIMEOUT_MS ?? "900000"),
  });
  if (result.error) {
    throw new Error(`AUTOPILOT_STEP_ERROR:${script}:${result.error.message}`);
  }
  if ((result.status ?? 1) !== 0) {
    throw new Error(`AUTOPILOT_STEP_FAILED:${script}`);
  }
}

function enrichmentComplete(): boolean {
  const checkpointPath = path.join(
    root,
    "data",
    "catalog",
    "enrichment",
    "checkpoint.json"
  );
  if (!existsSync(checkpointPath)) return false;
  try {
    const parsed = JSON.parse(readFileSync(checkpointPath, "utf8")) as {
      resumeBrandId?: string | null;
      brands?: Array<{ status?: string }>;
    };
    return (
      parsed.resumeBrandId == null &&
      Array.isArray(parsed.brands) &&
      parsed.brands.every((brand) => brand.status === "completed")
    );
  } catch {
    return false;
  }
}

function main(): void {
  assertStagingLinked();
  run("catalog:full-beauty");
  for (let pass = 1; pass <= maxEnrichmentPasses; pass += 1) {
    run("catalog:enrich", {
      ENRICH_MAX_FETCH: process.env.ENRICH_MAX_FETCH ?? "100",
    });
    if (enrichmentComplete()) break;
    if (pass === maxEnrichmentPasses) {
      throw new Error("AUTOPILOT_ENRICHMENT_INCOMPLETE");
    }
  }
  run("catalog:dedupe-plan");
  run("catalog:inci");
  if (includeCuratedLabels) run("catalog:labels:sync");
  run("catalog:refresh-plan");
  console.log(
    JSON.stringify({
      ok: true,
      mode: "staging_catalog_autopilot",
      productionTouched: false,
      manualReview: "exceptions_only",
      curatedLabelsIncluded: includeCuratedLabels,
      dedupePlanGenerated: true,
    })
  );
}

if (process.env.CATALOG_AUTOPILOT_SELFTEST !== "1") {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
