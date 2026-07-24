/**
 * P3-T01 dry-run runner — writes machine-readable audit under artifacts/.
 * Default: fixture mode. Never publishes. Never writes Production DB.
 *
 * Usage:
 *   npx tsx scripts/run-official-kr-product-source.ts
 *   npx tsx scripts/run-official-kr-product-source.ts --mode=fixture
 *   npx tsx scripts/run-official-kr-product-source.ts --mode=dry_run
 *   npx tsx scripts/run-official-kr-product-source.ts --max-slices=2 --slice-size=3
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  createFixturePageFetcher,
  runOfficialKrProductIngestion,
} from "../src/lib/onboarding/officialKoreanProductSource";
import type { OfficialKrProductIngestionMode } from "../src/lib/onboarding/officialKoreanProductSource";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const modeRaw = argValue("mode") ?? "fixture";
  const mode = modeRaw as OfficialKrProductIngestionMode;
  if (mode !== "fixture" && mode !== "dry_run" && mode !== "live_blocked") {
    throw new Error(`unsupported mode: ${modeRaw}`);
  }
  if (mode === "live_blocked") {
    throw new Error(
      "live_blocked: 실 수집은 사람 승인·공식 공개 페이지만. 이 러너는 fixture/dry_run만 허용.",
    );
  }

  const sliceSize = Number(argValue("slice-size") ?? "5");
  const maxSlicesRaw = argValue("max-slices");
  const maxSlices = maxSlicesRaw ? Number(maxSlicesRaw) : undefined;

  const result = await runOfficialKrProductIngestion({
    mode: mode === "dry_run" ? "dry_run" : "fixture",
    fetcher: createFixturePageFetcher(),
    sliceSize:
      Number.isFinite(sliceSize) && sliceSize > 0 ? sliceSize : 5,
    maxSlices,
  });

  const outDir = path.join(
    process.cwd(),
    "artifacts",
    "official-kr-product-source",
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
        publicVisible: false,
        databaseTouched: false,
        writeAttempted: false,
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
        publicVisible: false,
        databaseTouched: false,
        writeAttempted: false,
        productionTouched: false,
        paidApiUsed: false,
        captchaBypassAttempted: false,
        authenticatedScrapeAttempted: false,
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
