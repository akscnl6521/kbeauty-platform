#!/usr/bin/env node
/**
 * Care notification worker entry — dry-run by default.
 * npm run care:notify
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const r = spawnSync(
  process.execPath,
  [path.join(root, "scripts", "care-dry-run.mjs"), "--notify-only"],
  { cwd: root, encoding: "utf8", windowsHide: true }
);
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
process.exit(r.status ?? 1);
