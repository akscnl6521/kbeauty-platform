#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  loadWorkQueue,
  getActiveTask,
  getNextQueuedTask,
} from "./lib/work-queue.mjs";

const PROD_MASK = "rhfr***mns";
const STAGING_MASK = "jfnj***gfd";

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return (r.stdout || "").trim();
}

export function buildProjectStateSummary(root = process.cwd()) {
  const branch =
    run("git", ["rev-parse", "--abbrev-ref", "HEAD"]) || "(unknown)";
  const lastCommit =
    run("git", ["log", "-1", "--oneline"]) || "(no commits)";
  const gitStatus =
    run("git", ["status", "--short"]) || "(clean)";

  let tasks = [];
  try {
    tasks = loadWorkQueue(root);
  } catch {
    tasks = [];
  }

  const active = getActiveTask(tasks);
  const next = getNextQueuedTask(tasks);

  return {
    branch,
    lastCommit,
    gitStatus,
    activeTask: active,
    nextTask: next,
    protection: {
      productionRef: PROD_MASK,
      stagingRef: STAGING_MASK,
      productionWritesBlocked: true,
      mainMergeBlocked: true,
    },
  };
}

export function printProjectStateSummary(root = process.cwd()) {
  const s = buildProjectStateSummary(root);
  console.log("=== Project State ===");
  console.log("branch:", s.branch);
  console.log("last_commit:", s.lastCommit);
  console.log("git_status:", s.gitStatus.replace(/\n/g, " | "));
  console.log(
    "active_task:",
    s.activeTask ? `${s.activeTask.id} (p${s.activeTask.priority})` : "(none)"
  );
  console.log(
    "next_queued:",
    s.nextTask ? `${s.nextTask.id} (p${s.nextTask.priority})` : "(none)"
  );
  console.log("staging:", s.protection.stagingRef, "| prod blocked:", s.protection.productionRef);
  return s;
}

import { pathToFileURL } from "node:url";

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isMainModule()) {
  printProjectStateSummary(path.resolve(import.meta.dirname, ".."));
}
