/**
 * P2-T05 — Run Phase 2 automated validation and write evidence package artifacts.
 *
 * Default: run required `npm run <script>` via shell (PATH-safe on WSL/Windows).
 * Never merges main, never deploys Production, never writes Staging/Production DB.
 * Never claims visual/device/Dashboard approval.
 *
 * Usage:
 *   npm run check:phase2-final-evidence
 *   npm run check:phase2-final-evidence -- --skip-commands
 *   npm run check:phase2-final-evidence -- --no-artifacts
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  PHASE2_AUTOMATED_COMMANDS,
  buildPhase2EvidencePackageReport,
  formatPhase2EvidenceMarkdown,
  type Phase2CommandRunResult,
} from "../src/lib/release/phase2FinalEvidencePackage";

const root = process.cwd();
const outDir = path.join(root, "artifacts", "phase2-final-evidence");

function parseArgs(argv: string[]) {
  let skipCommands = false;
  let writeArtifacts = true;
  for (const arg of argv) {
    if (arg === "--skip-commands") skipCommands = true;
    if (arg === "--no-artifacts") writeArtifacts = false;
  }
  return { skipCommands, writeArtifacts };
}

/**
 * Prefer shell `npm run` so Windows/WSL PATH resolves npm.cmd / npm shim.
 * Falls back to documented nodeArgs only if npm is missing (rare).
 */
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

function main() {
  const { skipCommands, writeArtifacts } = parseArgs(process.argv.slice(2));
  const commandResults: Phase2CommandRunResult[] = [];

  for (const cmd of PHASE2_AUTOMATED_COMMANDS) {
    if (!cmd.requiredForPhase2Gate) continue;
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
    console.log(`\n[P2-T05] running npm run ${cmd.npmScript} …`);
    const { exitCode, notesKo } = runCommand(cmd);
    commandResults.push({
      commandId: cmd.id,
      npmScript: cmd.npmScript,
      status: exitCode === 0 ? "pass" : "fail",
      exitCode,
      notesKo,
    });
    if (exitCode !== 0) {
      console.error(`[P2-T05] FAIL: ${cmd.npmScript} exit=${exitCode}`);
    } else {
      console.log(`[P2-T05] PASS: ${cmd.npmScript}`);
    }
  }

  const report = buildPhase2EvidencePackageReport(commandResults);
  const markdown = formatPhase2EvidenceMarkdown(report);

  if (writeArtifacts) {
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    writeFileSync(
      path.join(outDir, "latest-result.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8"
    );
    writeFileSync(path.join(outDir, "latest-summary.md"), markdown, "utf8");
    console.log(`\n[P2-T05] artifacts → ${outDir}`);
  }

  console.log(
    `\n[P2-T05] summary: pass=${report.summary.automatedPassed} fail=${report.summary.automatedFailed} skipped=${report.summary.automatedSkipped}`
  );
  console.log(
    "[P2-T05] honesty: visualApprovalClaimed=false deviceApprovalClaimed=false releaseReadyClaimed=false"
  );

  if (report.summary.automatedFailed > 0) {
    process.exitCode = 1;
  }
}

main();
