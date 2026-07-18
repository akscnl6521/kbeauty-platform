#!/usr/bin/env node
/**
 * Care scheduler entry — delegates to care-worker with schedule focus.
 * Default: dry-run. Production blocked.
 * npm run care:scheduler
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (!args.includes("--apply")) args.push("--dry-run-flag");
const r = spawnSync(
  process.execPath,
  [path.join(root, "scripts", "care-dry-run.mjs"), ...args],
  { cwd: root, encoding: "utf8", windowsHide: true }
);
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
process.exit(r.status ?? 1);
