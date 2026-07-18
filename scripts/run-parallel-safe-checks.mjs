#!/usr/bin/env node
/**
 * Run independent static checks with bounded concurrency.
 * Does not write to any database. Safe on Windows PowerShell.
 *
 * Usage: npm run check:parallel
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recommendWorkerConfig } from "./catalog-worker-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = recommendWorkerConfig();

/** Independent read-only checks (no shared mutable files). */
const CHECKS = [
  { id: "smoke", npm: "test:smoke", env: { SMOKE_MODE: "static" } },
  { id: "journey", npm: "test:journey" },
  { id: "quality", npm: "test:quality" },
  { id: "release-security", npm: "check:release-security" },
  { id: "responsive", npm: "check:responsive" },
  { id: "production-safety", npm: "check:production" },
];

const concurrency = Math.min(cfg.cpuWorkers, CHECKS.length, 8);
const startedAt = Date.now();
const results = [];
let peakRss = process.memoryUsage().rss;
let active = 0;
let maxActive = 0;
let cursor = 0;

function sampleRss() {
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}

function runNpm(script, env = {}) {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", script], {
      cwd: root,
      env: { ...process.env, ...env, PARALLEL_SAFE_CHECK: "1" },
      shell: true,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => {
      stdout += d;
      sampleRss();
    });
    child.stderr?.on("data", (d) => {
      stderr += d;
      sampleRss();
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function worker() {
  while (cursor < CHECKS.length) {
    const index = cursor++;
    const check = CHECKS[index];
    active++;
    maxActive = Math.max(maxActive, active);
    const t0 = Date.now();
    console.log(`[parallel] start ${check.id}`);
    const outcome = await runNpm(check.npm, check.env);
    const ms = Date.now() - t0;
    const status = outcome.code === 0 ? "PASS" : "FAIL";
    results.push({ id: check.id, status, code: outcome.code, ms });
    console.log(`[parallel] ${check.id} → ${status} (${ms}ms)`);
    active--;
  }
}

console.log(
  `[parallel] logicalCPU=${cfg.logicalCpu} workers=${concurrency} httpHint=${cfg.httpConcurrency}`
);

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const elapsedMs = Date.now() - startedAt;
const summary = {
  elapsedMs,
  concurrency,
  maxActive,
  peakRssMb: Math.round(peakRss / 1024 / 1024),
  pass: results.filter((r) => r.status === "PASS").length,
  fail: results.filter((r) => r.status === "FAIL").length,
  skipped: 0,
  retries: 0,
  results,
};

console.log("\n======== [parallel] SUMMARY ========");
console.log(JSON.stringify(summary, null, 2));

if (summary.fail > 0) process.exit(1);
process.exit(0);
