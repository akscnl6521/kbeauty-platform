/**
 * P3-T02 dry-run runner — writes machine-readable audit under artifacts/.
 * Default: fixture mode. Never publishes. Never writes Production DB.
 *
 * Usage:
 *   npx tsx scripts/run-verified-product-pool.ts
 *   npx tsx scripts/run-verified-product-pool.ts --mode=fixture
 *   npx tsx scripts/run-verified-product-pool.ts --mode=dry_run
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  createVerifiedPoolFixtures,
  runVerifiedPoolExpansion,
} from "../src/lib/catalog/verifiedProductPool";
import type { VerifiedPoolMode } from "../src/lib/catalog/verifiedProductPool";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function main() {
  const modeRaw = argValue("mode") ?? "fixture";
  const mode = modeRaw as VerifiedPoolMode;
  if (mode !== "fixture" && mode !== "dry_run" && mode !== "live_blocked") {
    throw new Error(`unsupported mode: ${modeRaw}`);
  }
  if (mode === "live_blocked") {
    throw new Error(
      "live_blocked: 실 수집·공개 Top 5는 사람 승인 후. 이 러너는 fixture/dry_run만 허용.",
    );
  }

  const result = runVerifiedPoolExpansion({
    mode,
    records: createVerifiedPoolFixtures(),
  });

  const outDir = path.join(
    process.cwd(),
    "artifacts",
    "verified-product-pool",
  );
  mkdirSync(outDir, { recursive: true });
  const stamp = result.generatedAt.replace(/[:.]/g, "-");
  const auditFile = path.join(outDir, `audit-${stamp}.json`);
  const candidatesFile = path.join(outDir, `candidates-${stamp}.json`);

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
        publicTop5: result.publicTop5.map((c) => c.candidateId),
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
    path.join(outDir, "audit-latest.json"),
    JSON.stringify(result.audit, null, 2),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        ok: result.audit.ok,
        taskId: result.taskId,
        mode: result.mode,
        runId: result.runId,
        totals: result.totals,
        publicTop5Count: result.publicTop5.length,
        auditFile: path.relative(process.cwd(), auditFile),
        candidatesFile: path.relative(process.cwd(), candidatesFile),
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

  if (!result.audit.ok) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
