#!/usr/bin/env node
/**
 * Local pipeline worker (dry_run default).
 * Usage:
 *   node --import tsx scripts/run-pipeline.mjs
 *   node scripts/run-pipeline.mjs --mode=dry_run --brands=5 --tick=10
 *
 * Does not print secrets. Uses Next-built server modules via dynamic import
 * when running under `npx tsx`.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const mode = args.find((a) => a.startsWith("--mode="))?.split("=")[1] ?? "dry_run";
const brands = args.find((a) => a.startsWith("--brands="))?.split("=")[1] ?? "5";
const tick = args.find((a) => a.startsWith("--tick="))?.split("=")[1] ?? "10";
const batchId = args.find((a) => a.startsWith("--batch="))?.split("=")[1];

console.log("[pipeline-worker] starting", { mode, brands, tick, batchId: batchId ?? "(new)" });

// Prefer tsx runner for TypeScript modules
const runner = path.join(root, "scripts", "pipeline-worker-entry.mjs");
const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", runner, `--mode=${mode}`, `--brands=${brands}`, `--tick=${tick}`, batchId ? `--batch=${batchId}` : ""].filter(Boolean),
  { cwd: root, stdio: "inherit", env: process.env }
);

process.exit(result.status ?? 1);
