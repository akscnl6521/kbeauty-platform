#!/usr/bin/env node
/**
 * Safe concurrency defaults for catalog / check workers.
 * Windows + PowerShell friendly. No secrets. No DB writes.
 *
 * Usage:
 *   node scripts/catalog-worker-config.mjs
 *   import { recommendWorkerConfig } from './catalog-worker-config.mjs'
 */
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCK_DIR = path.join(root, "data", "pipeline", "runtime");
const WORKER_LOCK = path.join(LOCK_DIR, "worker.lock");
const CARE_LOCK = path.join(LOCK_DIR, "care-worker.lock");

export function logicalCpuCount() {
  return os.availableParallelism?.() ?? os.cpus().length ?? 4;
}

/**
 * @param {object} [opts]
 * @param {number} [opts.cpuRatio=0.75]
 * @param {number} [opts.maxCpuWorkers=32]
 * @param {number} [opts.httpMin=4]
 * @param {number} [opts.httpMax=8]
 */
export function recommendWorkerConfig(opts = {}) {
  const cpuRatio = opts.cpuRatio ?? 0.75;
  const maxCpuWorkers = opts.maxCpuWorkers ?? 32;
  const logical = logicalCpuCount();
  const cpuWorkers = Math.max(1, Math.min(maxCpuWorkers, Math.floor(logical * cpuRatio)));

  const totalGb = os.totalmem() / 1024 ** 3;
  const freeGb = os.freemem() / 1024 ** 3;
  // Cap batch RAM hint well below workstation capacity (never chase 768GB).
  const batchMemoryMb = Math.min(
    8192,
    Math.max(512, Math.floor(Math.min(freeGb * 0.15, 16) * 1024))
  );

  const httpConcurrency = Math.min(
    opts.httpMax ?? 8,
    Math.max(opts.httpMin ?? 4, Math.min(8, Math.floor(cpuWorkers / 4) || 4))
  );

  return {
    logicalCpu: logical,
    cpuWorkers,
    httpConcurrency,
    normalizeQueueWorkers: Math.min(cpuWorkers, 16),
    networkQueueWorkers: httpConcurrency,
    batchMemoryMb,
    totalMemoryGb: Math.round(totalGb * 10) / 10,
    freeMemoryGb: Math.round(freeGb * 10) / 10,
    maxRetries: 3,
    backoffMsBase: 500,
  };
}

export function readLock(lockPath) {
  if (!fs.existsSync(lockPath)) return null;
  try {
    const text = fs.readFileSync(lockPath, "utf8");
    const pidMatch = text.match(/pid=(\d+)/i);
    const atMatch = text.match(/at=([^\s;]+)/i);
    const mtime = fs.statSync(lockPath).mtimeMs;
    const ageMinutes = (Date.now() - mtime) / 60000;
    return {
      path: lockPath,
      pid: pidMatch ? Number(pidMatch[1]) : null,
      at: atMatch?.[1] ?? null,
      ageMinutes: Math.round(ageMinutes * 10) / 10,
      stale: ageMinutes >= 30,
    };
  } catch {
    return { path: lockPath, error: true };
  }
}

export function isPidAlive(pid) {
  if (!pid || !Number.isFinite(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Prevent duplicate catalog/care worker starts (Task Scheduler / manual).
 * Stale locks (>30m or dead PID) may be cleared by caller.
 */
export function assertSingleWorkerInstance(kind = "catalog") {
  const lockPath = kind === "care" ? CARE_LOCK : WORKER_LOCK;
  const lock = readLock(lockPath);
  if (!lock) return { ok: true, lockPath };
  if (lock.pid && isPidAlive(lock.pid) && !lock.stale) {
    return {
      ok: false,
      lockPath,
      reason: `worker already running pid=${lock.pid} age=${lock.ageMinutes}m`,
    };
  }
  if (lock.stale || (lock.pid && !isPidAlive(lock.pid))) {
    return { ok: true, lockPath, clearStale: true, previous: lock };
  }
  return { ok: false, lockPath, reason: "lock present", previous: lock };
}

export function writeWorkerLock(kind = "catalog") {
  fs.mkdirSync(LOCK_DIR, { recursive: true });
  const lockPath = kind === "care" ? CARE_LOCK : WORKER_LOCK;
  fs.writeFileSync(
    lockPath,
    `pid=${process.pid}; at=${new Date().toISOString()}\n`,
    "utf8"
  );
  return lockPath;
}

export function clearWorkerLock(kind = "catalog") {
  const lockPath = kind === "care" ? CARE_LOCK : WORKER_LOCK;
  try {
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  } catch {
    /* ignore */
  }
}

const isMain =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const cfg = recommendWorkerConfig();
  const catalog = assertSingleWorkerInstance("catalog");
  const care = assertSingleWorkerInstance("care");
  console.log(
    JSON.stringify(
      {
        config: cfg,
        locks: { catalog, care },
      },
      null,
      2
    )
  );
}
