#!/usr/bin/env node
/**
 * Run pipeline pure-function selftests via Next/tsx when available.
 * Fallback: print instructions if TypeScript loader unavailable.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(root, "scripts", "pipeline-selftest-entry.ts");

const tryTsx = spawnSync("npx", ["--yes", "tsx", entry], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

if (tryTsx.status === 0) process.exit(0);

console.error("[selftest] tsx failed — run via `npx tsx scripts/pipeline-selftest-entry.ts`");
process.exit(tryTsx.status ?? 1);
