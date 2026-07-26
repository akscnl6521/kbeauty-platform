/**
 * T07-03 dry-run runner — writes machine-readable audit under artifacts/.
 * Default: fixture mode. Never publishes. Never writes Production DB.
 *
 * Usage:
 *   npx tsx scripts/run-institution-detail-enrichment.ts
 *   npx tsx scripts/run-institution-detail-enrichment.ts --mode=fixture
 *   npx tsx scripts/run-institution-detail-enrichment.ts --mode=dry_run --concurrency=3
 *   npx tsx scripts/run-institution-detail-enrichment.ts --max-institutions=5
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  createFixtureDetailFetcher,
  createLiveDetailFetcher,
  getFixtureEnrichmentCandidates,
  runInstitutionDetailEnrichment,
} from "../src/lib/publicData/institutionDetailEnrichment";
import type { InstitutionDetailEnrichmentMode } from "../src/lib/publicData/institutionDetailEnrichment";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const modeRaw = argValue("mode") ?? "fixture";
  const mode = modeRaw as InstitutionDetailEnrichmentMode;
  if (mode !== "fixture" && mode !== "dry_run" && mode !== "live_blocked") {
    throw new Error(`unsupported mode: ${modeRaw}`);
  }

  const concurrency = Number(argValue("concurrency") ?? "3");
  const maxRaw = argValue("max-institutions");
  const maxInstitutions = maxRaw ? Number(maxRaw) : undefined;

  const fetcher =
    mode === "fixture" || mode === "dry_run"
      ? createFixtureDetailFetcher()
      : createLiveDetailFetcher({
          allowFixtureFallback: false,
          config: { mode: "live" },
        });

  const result = await runInstitutionDetailEnrichment({
    mode: mode === "dry_run" ? "dry_run" : mode,
    fetcher,
    candidates: getFixtureEnrichmentCandidates(),
    concurrency: Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 3,
    maxInstitutions,
  });

  const outDir = path.join(
    process.cwd(),
    "artifacts",
    "institution-detail-enrichment",
  );
  mkdirSync(outDir, { recursive: true });
  const stamp = result.generatedAt.replace(/[:.]/g, "-");
  const auditFile = path.join(outDir, `audit-${stamp}.json`);
  const candidatesFile = path.join(outDir, `candidates-${stamp}.json`);
  const checkpointFile = path.join(outDir, `checkpoint-${stamp}.json`);
  const cacheFile = path.join(outDir, `cache-${stamp}.json`);

  writeFileSync(auditFile, JSON.stringify(result.audit, null, 2), "utf8");
  writeFileSync(
    candidatesFile,
    JSON.stringify(
      {
        taskId: result.taskId,
        mode: result.mode,
        runId: result.runId,
        publishAllowed: false,
        databaseTouched: false,
        candidates: result.candidates,
      },
      null,
      2,
    ),
    "utf8",
  );
  writeFileSync(
    checkpointFile,
    JSON.stringify(result.checkpoint, null, 2),
    "utf8",
  );
  writeFileSync(
    cacheFile,
    JSON.stringify(result.cacheSnapshot, null, 2),
    "utf8",
  );

  writeFileSync(
    path.join(outDir, "audit-latest.json"),
    JSON.stringify(result.audit, null, 2),
    "utf8",
  );
  writeFileSync(
    path.join(outDir, "checkpoint-latest.json"),
    JSON.stringify(result.checkpoint, null, 2),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        ok: result.audit.ok,
        taskId: result.taskId,
        mode: result.mode,
        runId: result.runId,
        checkpointStatus: result.checkpoint.status,
        totals: result.totals,
        auditFile: path.relative(process.cwd(), auditFile),
        candidatesFile: path.relative(process.cwd(), candidatesFile),
        checkpointFile: path.relative(process.cwd(), checkpointFile),
        publishAllowed: false,
        databaseTouched: false,
        writeAttempted: false,
        productionTouched: false,
      },
      null,
      2,
    ),
  );

  if (!result.audit.ok || result.checkpoint.status === "failed") {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
