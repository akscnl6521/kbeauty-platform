#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const result = spawnSync(
  process.execPath,
  [path.join(root, "scripts", "run-pipeline-worker.mjs"), ...args],
  { cwd: root, stdio: "inherit", env: process.env }
);
process.exit(result.status ?? 1);
