#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { loadWorkQueue, getActiveTask } from "./lib/work-queue.mjs";
import { evaluateCommandOrSql } from "./safe-command-gate.mjs";

const root = path.resolve(import.meta.dirname, "..");
const skipBuild = process.argv.includes("--skip-build");

const SECRET_PATTERNS = [
  { re: /sk_live_[a-zA-Z0-9]{8,}/, label: "sk_live secret" },
  {
    re: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/,
    label: "JWT-like service_role token",
  },
  { re: /RESEND_API_KEY\s*=\s*re_[a-zA-Z0-9]+/, label: "RESEND_API_KEY value" },
];

function runShell(command) {
  console.log(">>", command);
  const r = spawnSync(command, {
    cwd: root,
    encoding: "utf8",
    shell: true,
    env: { ...process.env, npm_config_loglevel: "silent" },
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status ?? 1;
}

function gitDiff() {
  const r = spawnSync("git", ["diff", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const unstaged = spawnSync("git", ["diff"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return (r.stdout || "") + (unstaged.stdout || "");
}

function scanSecrets(diff) {
  const hits = [];
  for (const { re, label } of SECRET_PATTERNS) {
    if (re.test(diff)) hits.push(label);
  }
  return hits;
}

export async function verifyCurrentTask(options = {}) {
  const skip = options.skipBuild ?? skipBuild;
  const tasks = loadWorkQueue(root);
  const active = getActiveTask(tasks);
  if (!active) {
    console.error("No active task in WORK_QUEUE.md");
    return { ok: false, code: 1 };
  }

  console.log("Verifying active task:", active.id);

  for (const testCmd of active.tests || []) {
    const code = runShell(testCmd);
    if (code !== 0) {
      console.error("Test failed:", testCmd);
      return { ok: false, code };
    }
  }

  if (!skip) {
    const buildCode = runShell("npm run build");
    if (buildCode !== 0) {
      console.error("Build failed (use --skip-build to skip)");
      return { ok: false, code: buildCode };
    }
  }

  const diff = gitDiff();
  const gate = evaluateCommandOrSql(diff);
  if (!gate.ok) {
    console.error("Safe gate failed on git diff:");
    for (const r of gate.reasons) console.error(" -", r);
    return { ok: false, code: 1 };
  }

  const secrets = scanSecrets(diff);
  if (secrets.length) {
    console.error("Secret pattern scan failed:", secrets.join(", "));
    return { ok: false, code: 1 };
  }

  console.log("VERIFY OK:", active.id);
  return { ok: true, code: 0, task: active };
}

import { pathToFileURL } from "node:url";

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isMainModule()) {
  verifyCurrentTask().then((r) => process.exit(r.code));
}
