/**
 * P2-T02 — Staging read-only release gate runner.
 *
 * Default: static (repo/env presence, no network writes).
 * Optional: --mode=readonly with BASE_URL health + anon SELECT head probes.
 *
 * Never writes to Staging/Production. Aborts on Production identity.
 * Never prints secrets or full project refs.
 *
 * Usage:
 *   npm run check:staging-release-gate
 *   npm run check:staging-release-gate -- --mode=readonly
 *   BASE_URL=http://127.0.0.1:3000 npm run check:staging-release-gate -- --mode=readonly
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";
import {
  EXPECTED_STAGING_TABLES,
  assessEnvironmentIdentity,
  formatReportMarkdown,
  mergeReadonlyProbeResults,
  resolveProductionRef,
  resolveProjectRef,
  runStaticStagingReleaseGate,
  type StagingReleaseGateMode,
  type StagingReleaseGateReport,
} from "../src/lib/release/stagingReleaseGate";

const root = process.cwd();
const outDir = path.join(root, "artifacts", "staging-release-gate");

function parseArgs(argv: string[]) {
  let mode: StagingReleaseGateMode = "static";
  let writeArtifacts = true;
  let baseUrlArg: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith("--mode=")) {
      const value = arg.slice("--mode=".length);
      if (value === "static" || value === "readonly") mode = value;
      else throw new Error(`Unknown mode: ${value}`);
    }
    if (arg.startsWith("--base-url=")) {
      baseUrlArg = arg.slice("--base-url=".length).replace(/\/$/, "");
    }
    if (arg === "--no-artifacts") writeArtifacts = false;
  }
  return { mode, writeArtifacts, baseUrlArg };
}

function resolveBaseUrl(baseUrlArg: string | null): string | null {
  const raw =
    baseUrlArg ||
    process.env.BASE_URL ||
    process.env.PREVIEW_BASE_URL ||
    process.env.PREVIEW_URL ||
    "";
  const base = raw.replace(/\/$/, "");
  if (!base) return null;
  if (/kbeautymatch\.com/i.test(base) && !/vercel\.app/i.test(base)) {
    throw new Error("ABORT: refuse non-preview production host for health probe");
  }
  return base;
}

async function probeHealth(baseUrl: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${baseUrl}/api/health`, {
      redirect: "manual",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: boolean };
    return body.ok === true;
  } catch {
    return false;
  }
}

async function probeTablesSelectHead(
  env: NodeJS.ProcessEnv
): Promise<
  Partial<Record<(typeof EXPECTED_STAGING_TABLES)[number], boolean>> | undefined
> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return undefined;

  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const found: Partial<
    Record<(typeof EXPECTED_STAGING_TABLES)[number], boolean>
  > = {};

  for (const table of EXPECTED_STAGING_TABLES) {
    try {
      const { error } = await client
        .from(table)
        .select("id", { head: true, count: "exact" })
        .limit(1);
      // PGRST205 = missing relation; other errors may be RLS — still "reachable"
      if (error?.code === "PGRST205") {
        found[table] = false;
      } else if (error && /does not exist|Could not find/i.test(error.message)) {
        found[table] = false;
      } else {
        // no error, or RLS/permission — table exists for contract purposes
        found[table] = true;
      }
    } catch {
      found[table] = false;
    }
  }

  return found;
}

function writeArtifacts(report: StagingReleaseGateReport) {
  mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "latest-result.json");
  const mdPath = path.join(outDir, "latest-summary.md");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(mdPath, formatReportMarkdown(report), "utf8");
  console.log(`[staging-release-gate] artifacts → ${path.relative(root, outDir)}`);
}

async function main() {
  loadEnvLocal(root);
  const { mode, writeArtifacts: shouldWrite, baseUrlArg } = parseArgs(
    process.argv.slice(2)
  );

  const env = process.env;
  const identity = assessEnvironmentIdentity(env);
  if (identity.isProduction) {
    console.error(
      "[staging-release-gate] ABORT: Production identity detected — no probes, no writes"
    );
    const blocked = runStaticStagingReleaseGate({
      env,
      fileExists: (rel) => existsSync(path.join(root, rel)),
      readFile: (rel) => readFileSync(path.join(root, rel), "utf8"),
    });
    if (shouldWrite) writeArtifacts(blocked);
    process.exit(1);
  }

  // Extra hard check on resolved refs before any remote call
  const ref = resolveProjectRef(env);
  const prod = resolveProductionRef(env);
  if (ref && ref === prod) {
    console.error("[staging-release-gate] ABORT: project ref equals Production");
    process.exit(1);
  }

  let report = runStaticStagingReleaseGate({
    env,
    fileExists: (rel) => existsSync(path.join(root, rel)),
    readFile: (rel) => readFileSync(path.join(root, rel), "utf8"),
  });

  if (mode === "readonly") {
    const baseUrl = resolveBaseUrl(baseUrlArg);
    const healthOk = baseUrl ? await probeHealth(baseUrl) : null;
    const tablesFound = await probeTablesSelectHead(env);
    report = mergeReadonlyProbeResults(report, { healthOk, tablesFound });
  }

  console.log(
    JSON.stringify(
      {
        taskId: report.taskId,
        mode: report.mode,
        ok: report.ok,
        projectRefMasked: report.projectRefMasked,
        isStagingIdentity: report.isStagingIdentity,
        isProductionBlocked: report.isProductionBlocked,
        writeAttempted: report.writeAttempted,
        summary: report.summary,
        failIds: report.checks.filter((c) => c.status === "fail").map((c) => c.id),
        dashboardOnlyUnknownIds: report.checks
          .filter((c) => c.factKind === "dashboard_only_unknown")
          .map((c) => c.id),
      },
      null,
      2
    )
  );

  if (shouldWrite) writeArtifacts(report);

  if (!report.ok) {
    console.error("[staging-release-gate] FAIL");
    process.exit(1);
  }
  console.log("[staging-release-gate] PASS (read-only · no writes)");
}

main().catch((err) => {
  console.error("[staging-release-gate] error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
