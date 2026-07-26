/**
 * T07-02 dry-run runner — writes machine-readable audit under artifacts/.
 * Default: fixture mode. Never publishes. Never writes Production DB.
 *
 * Usage:
 *   npx tsx scripts/run-seoul-dermatology-ingestion.ts
 *   npx tsx scripts/run-seoul-dermatology-ingestion.ts --mode=fixture
 *   npx tsx scripts/run-seoul-dermatology-ingestion.ts --mode=dry_run
 *   npx tsx scripts/run-seoul-dermatology-ingestion.ts --max-pages=2 --num-of-rows=5
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  createFixturePageFetcher,
  createLivePageFetcher,
  runSeoulDermatologyIngestion,
} from "../src/lib/publicData/seoulDermatologyIngestion";
import type {
  PaginationCheckpoint,
  SeoulDermatologyIngestionMode,
} from "../src/lib/publicData/seoulDermatologyIngestion";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function argFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const modeRaw = argValue("mode") ?? "fixture";
  const mode = modeRaw as SeoulDermatologyIngestionMode;
  if (mode !== "fixture" && mode !== "dry_run" && mode !== "live_blocked") {
    throw new Error(`unsupported mode: ${modeRaw}`);
  }

  const numOfRows = Number(argValue("num-of-rows") ?? "10");
  const maxPagesRaw = argValue("max-pages");
  const maxPages = maxPagesRaw ? Number(maxPagesRaw) : undefined;
  const openList = argFlag("open-list");

  const resumePath = argValue("resume-checkpoint");
  let resumeCheckpoint: PaginationCheckpoint | undefined;
  if (resumePath) {
    if (!existsSync(resumePath)) {
      throw new Error(`resume checkpoint not found: ${resumePath}`);
    }
    resumeCheckpoint = JSON.parse(
      readFileSync(resumePath, "utf8"),
    ) as PaginationCheckpoint;
    if (resumeCheckpoint.status === "completed") {
      throw new Error("resume checkpoint already completed — nothing to resume");
    }
  }

  const fetcher =
    mode === "fixture"
      ? createFixturePageFetcher()
      : mode === "dry_run"
        ? createFixturePageFetcher()
        : createLivePageFetcher({
            allowFixtureFallback: false,
            config: { mode: "live" },
          });

  const result = await runSeoulDermatologyIngestion({
    mode: mode === "dry_run" ? "dry_run" : mode,
    fetcher,
    numOfRows: Number.isFinite(numOfRows) && numOfRows > 0 ? numOfRows : 10,
    maxPages,
    dgsbjtCd: openList ? null : undefined,
    checkpoint: resumeCheckpoint,
  });

  const outDir = path.join(
    process.cwd(),
    "artifacts",
    "seoul-dermatology-ingestion",
  );
  mkdirSync(outDir, { recursive: true });
  const stamp = result.generatedAt.replace(/[:.]/g, "-");
  const auditFile = path.join(outDir, `audit-${stamp}.json`);
  const candidatesFile = path.join(outDir, `candidates-${stamp}.json`);
  const checkpointFile = path.join(outDir, `checkpoint-${stamp}.json`);

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

  // Also write stable "latest" pointers for operators
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
