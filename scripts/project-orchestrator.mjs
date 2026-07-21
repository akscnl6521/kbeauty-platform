#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  loadWorkQueue,
  getActiveTask,
  getNextQueuedTask,
  setTaskStatus,
  markCompleted,
} from "./lib/work-queue.mjs";
import { printProjectStateSummary } from "./project-state-summary.mjs";
import { verifyCurrentTask } from "./verify-current-task.mjs";
import { evaluateCommandOrSql } from "./safe-command-gate.mjs";

const root = path.resolve(import.meta.dirname, "..");
const cmd = process.argv[2] || "status";
const forceDocsOnly = process.argv.includes("--force-docs-only");
const doCommit = process.argv.includes("--commit");
const skipBuild = process.argv.includes("--skip-build");

function gitHead() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return (r.stdout || "").trim();
}

function demoteOtherActive(exceptId) {
  const tasks = loadWorkQueue(root);
  for (const t of tasks) {
    if (t.status === "active" && t.id !== exceptId) {
      setTaskStatus(root, t.id, "queued");
      console.log("Demoted previous active:", t.id);
    }
  }
}

function cmdStatus() {
  printProjectStateSummary(root);
  return 0;
}

function cmdNext() {
  const tasks = loadWorkQueue(root);
  const active = getActiveTask(tasks);
  if (active) {
    console.log("Active task already set:", active.id);
    console.log("Complete it first or use project:complete");
    return 1;
  }
  const next = getNextQueuedTask(tasks);
  if (!next) {
    console.log("No eligible queued task");
    return 0;
  }
  setTaskStatus(root, next.id, "active");
  console.log("Activated:", next.id);
  return 0;
}

async function cmdVerify() {
  const r = await verifyCurrentTask({ skipBuild });
  return r.code;
}

async function cmdComplete() {
  const tasks = loadWorkQueue(root);
  const active = getActiveTask(tasks);
  if (!active) {
    console.error("No active task to complete");
    return 1;
  }

  if (active.approval_required && !forceDocsOnly) {
    console.error(
      "Task requires approval (approval_required: true). Use --force-docs-only after explicit user approval."
    );
    return 1;
  }

  if (!forceDocsOnly) {
    const v = await verifyCurrentTask({ skipBuild });
    if (!v.ok) {
      console.error("Verify failed; not completing");
      return v.code;
    }
  }

  const hash = gitHead();
  markCompleted(root, active.id, hash);
  console.log("Completed:", active.id, "commit:", hash.slice(0, 8));
  console.log("");
  console.log("Next steps:");
  console.log("  1. Update PROJECT_STATUS.md (one-line status for this task)");
  console.log("  2. npm run project:next");
  console.log("  3. git commit (agent/manual) — orchestrator does not auto-commit by default");

  if (doCommit) {
    const commitMsg = `complete: ${active.id}`;
    const gate = evaluateCommandOrSql(`git commit -m "${commitMsg}"`);
    if (!gate.ok) {
      console.error("Commit blocked by safe gate");
      return 1;
    }
    const add = spawnSync("git", ["add", "WORK_QUEUE.md"], {
      cwd: root,
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    if (add.status !== 0) return add.status ?? 1;
    const c = spawnSync("git", ["commit", "-m", commitMsg], {
      cwd: root,
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    if (c.status !== 0) {
      console.error("git commit failed (maybe nothing to commit)");
      return c.status ?? 1;
    }
    console.log("Committed WORK_QUEUE.md");
  }

  return 0;
}

function printDashboardBlock(task) {
  const file = task.dashboard_sql_file || "supabase/migrations/20260722010000_create_checkin_email_queue.sql";
  console.log("");
  console.log("=== 사람 확인 필요 (Staging Dashboard SQL) ===");
  console.log("1. Supabase Dashboard → Staging 프로젝트 (jfnj***gfd) 열기");
  console.log("2. SQL Editor → New query");
  console.log(`3. 로컬 파일 내용 전체 복사: ${file}`);
  console.log("4. Run 실행 (Production 아님 확인)");
  console.log("5. 완료 후: node scripts/probe-checkin-email-queue-staging.mjs");
  console.log("6. ready 나오면 npm run project:verify 재실행");
  console.log("");
}

async function cmdContinue() {
  cmdStatus();
  const tasks = loadWorkQueue(root);
  let active = getActiveTask(tasks);

  if (!active) {
    const code = cmdNext();
    if (code !== 0) return code;
    active = getActiveTask(loadWorkQueue(root));
  }

  if (active?.dashboard_sql === true || active?.dashboard_sql === "true") {
    printDashboardBlock(active);
    return 2;
  }

  return cmdVerify();
}

async function main() {
  switch (cmd) {
    case "status":
      return cmdStatus();
    case "next":
      return cmdNext();
    case "verify":
      return cmdVerify();
    case "complete":
      return cmdComplete();
    case "continue":
      return cmdContinue();
    default:
      console.error("Unknown command:", cmd);
      console.error("Usage: status | next | verify | complete | continue");
      return 2;
  }
}

main().then((code) => process.exit(code ?? 0));
