/**
 * P3-T05 — Run focused/integration/security/build suite and write human review package.
 *
 * Default: run required npm scripts. Never merges main, never deploys Production,
 * never writes Staging/Production DB, never claims Staging import executed.
 *
 * Usage:
 *   npm run check:staging-import-package
 *   npm run check:staging-import-package -- --skip-commands
 *   npm run check:staging-import-package -- --no-artifacts
 *   npm run check:staging-import-package -- --mode=dry_run
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  STAGING_IMPORT_AUTOMATED_COMMANDS,
  assertNoStagingImportOrProductionWrite,
  buildStagingImportHumanReviewPackage,
  formatStagingImportHumanReviewMarkdown,
  runStagingImportPackage,
  type StagingImportCommandRunResult,
  type StagingImportMode,
} from "../src/lib/onboarding/stagingImportPackage";

const root = process.cwd();
const outDir = path.join(root, "artifacts", "staging-import-package");

function parseArgs(argv: string[]) {
  let skipCommands = false;
  let writeArtifacts = true;
  let mode: StagingImportMode = "fixture";
  for (const arg of argv) {
    if (arg === "--skip-commands") skipCommands = true;
    if (arg === "--no-artifacts") writeArtifacts = false;
    if (arg.startsWith("--mode=")) {
      mode = arg.slice("--mode=".length) as StagingImportMode;
    }
  }
  return { skipCommands, writeArtifacts, mode };
}

function runCommand(cmd: {
  npmScript: string;
  nodeArgs: readonly string[];
}): { exitCode: number; notesKo: string } {
  const npmResult = spawnSync("npm", ["run", cmd.npmScript], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    shell: true,
  });
  if (!npmResult.error) {
    const exitCode = npmResult.status ?? 1;
    return {
      exitCode,
      notesKo: exitCode === 0 ? "통과" : "실패 — 로그를 Agent가 판독",
    };
  }

  const nodeResult = spawnSync(process.execPath, [...cmd.nodeArgs], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    shell: false,
  });
  if (nodeResult.error) {
    return {
      exitCode: 1,
      notesKo: `실행 오류: npm=${npmResult.error.message}; node=${nodeResult.error.message}`,
    };
  }
  const exitCode = nodeResult.status ?? 1;
  return {
    exitCode,
    notesKo: exitCode === 0 ? "통과 (nodeArgs fallback)" : "실패 — nodeArgs fallback",
  };
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  const { skipCommands, writeArtifacts, mode } = parseArgs(process.argv.slice(2));
  if (mode === "live_blocked") {
    throw new Error(
      "live_blocked: 실 Staging import는 사람 승인 후. 러너는 fixture/dry_run만 허용.",
    );
  }

  const commandResults: StagingImportCommandRunResult[] = [];

  for (const cmd of STAGING_IMPORT_AUTOMATED_COMMANDS) {
    if (!cmd.requiredForGate) continue;
    // Avoid recursive self-invocation when this runner is listed.
    if (cmd.id === "staging_import_package" && !skipCommands) {
      // Run focused selftest via nodeArgs directly (not npm check).
      console.log(`\n[P3-T05] running focused selftest …`);
      const nodeResult = spawnSync(
        process.execPath,
        ["--import", "tsx", "scripts/staging-import-package-selftest.ts"],
        { cwd: root, encoding: "utf8", env: process.env, shell: false },
      );
      const exitCode = nodeResult.status ?? 1;
      commandResults.push({
        commandId: cmd.id,
        npmScript: cmd.npmScript,
        status: exitCode === 0 ? "pass" : "fail",
        exitCode,
        notesKo: exitCode === 0 ? "통과 (focused selftest)" : "실패 — selftest",
      });
      if (exitCode !== 0) {
        console.error(`[P3-T05] FAIL: focused selftest exit=${exitCode}`);
        if (nodeResult.stderr) console.error(nodeResult.stderr);
      } else {
        console.log(`[P3-T05] PASS: focused selftest`);
      }
      continue;
    }

    if (skipCommands) {
      commandResults.push({
        commandId: cmd.id,
        npmScript: cmd.npmScript,
        status: "skipped",
        exitCode: null,
        notesKo: "--skip-commands · 패키지 구조만 생성",
      });
      continue;
    }

    console.log(`\n[P3-T05] running npm run ${cmd.npmScript} …`);
    const { exitCode, notesKo } = runCommand(cmd);
    commandResults.push({
      commandId: cmd.id,
      npmScript: cmd.npmScript,
      status: exitCode === 0 ? "pass" : "fail",
      exitCode,
      notesKo,
    });
    if (exitCode !== 0) {
      console.error(`[P3-T05] FAIL: ${cmd.npmScript} exit=${exitCode}`);
    } else {
      console.log(`[P3-T05] PASS: ${cmd.npmScript}`);
    }
  }

  const packageResult = runStagingImportPackage({
    mode,
    now: new Date().toISOString(),
  });
  assertNoStagingImportOrProductionWrite(packageResult);

  const report = buildStagingImportHumanReviewPackage(
    commandResults,
    packageResult,
  );
  const markdown = formatStagingImportHumanReviewMarkdown(report);

  if (writeArtifacts) {
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    writeJson(path.join(outDir, "latest-result.json"), report);
    writeFileSync(path.join(outDir, "latest-summary.md"), markdown, "utf8");
    writeJson(path.join(outDir, "audit-latest.json"), packageResult.audit);
    writeJson(path.join(outDir, "rows-latest.json"), {
      runId: packageResult.runId,
      rows: packageResult.rows,
      stagingImportExecuted: false,
      publishAllowed: false,
    });
    writeFileSync(
      path.join(outDir, "rows-latest.csv"),
      `${packageResult.csvSummary}\n`,
      "utf8",
    );
    writeJson(path.join(outDir, "summary-latest.json"), {
      taskId: packageResult.taskId,
      mode: packageResult.mode,
      runId: packageResult.runId,
      generatedAt: packageResult.generatedAt,
      totals: packageResult.totals,
      publishAllowed: false,
      publicVisible: false,
      stagingImportExecuted: false,
      databaseTouched: false,
      writeAttempted: false,
      productionTouched: false,
    });
    console.log(`\n[P3-T05] artifacts → ${outDir}`);
  }

  console.log(
    `\n[P3-T05] summary: pass=${report.summary.automatedPassed} fail=${report.summary.automatedFailed} skipped=${report.summary.automatedSkipped}`,
  );
  console.log(
    "[P3-T05] honesty: stagingImportExecuted=false stagingImportApprovalClaimed=false publishAllowed=false",
  );

  if (report.summary.automatedFailed > 0) {
    process.exitCode = 1;
  }
}

main();
