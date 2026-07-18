#!/usr/bin/env node
/**
 * Read-only workstation capability report.
 * Never prints secret values from .env.local.
 *
 * Usage: npm run report:system
 */
import { execFileSync, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recommendWorkerConfig } from "./catalog-worker-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function safeExec(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, {
      encoding: "utf8",
      timeout: opts.timeout ?? 8000,
      stdio: ["ignore", "pipe", "pipe"],
      shell: opts.shell ?? false,
      windowsHide: true,
    }).trim();
  } catch {
    return null;
  }
}

function nodeVersion() {
  return process.version;
}

function npmVersion() {
  return safeExec("npm", ["-v"], { shell: true }) ?? "unknown";
}

function diskFreeGb() {
  try {
    if (process.platform === "win32") {
      const drive = path.parse(root).root.replace(/\\$/, "");
      const out = safeExec(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `(Get-PSDrive -Name '${drive.replace(":", "")}').Free`,
        ],
        { shell: false, timeout: 15000 }
      );
      const bytes = Number(out);
      if (Number.isFinite(bytes)) return Math.round((bytes / 1024 ** 3) * 10) / 10;
    } else {
      const out = safeExec("df", ["-k", root]);
      if (out) {
        const line = out.split(/\r?\n/)[1];
        const parts = line?.split(/\s+/) ?? [];
        const availKb = Number(parts[3]);
        if (Number.isFinite(availKb)) return Math.round((availKb / 1024 ** 2) * 10) / 10;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function nvidiaReport() {
  const smi = safeExec("nvidia-smi", [
    "--query-gpu=name,memory.total,driver_version",
    "--format=csv,noheader",
  ]);
  if (!smi) {
    return { available: false, gpus: [], cuda: false };
  }
  const gpus = smi.split(/\r?\n/).filter(Boolean).map((line) => {
    const [name, memory, driver] = line.split(",").map((s) => s.trim());
    return { name, memory, driver };
  });
  const nvcc = safeExec("nvcc", ["--version"]);
  return {
    available: gpus.length > 0,
    gpus,
    cuda: Boolean(nvcc) || gpus.length > 0,
    nvccPresent: Boolean(nvcc),
  };
}

function ollamaReport() {
  const version = safeExec("ollama", ["--version"], { shell: true });
  if (!version) {
    return { installed: false, running: false, models: [] };
  }
  const list = safeExec("ollama", ["list"], { shell: true, timeout: 12000 });
  const models = [];
  if (list) {
    for (const line of list.split(/\r?\n/).slice(1)) {
      const name = line.trim().split(/\s+/)[0];
      if (name) models.push(name);
    }
  }
  // Probe local API without printing payloads
  let running = false;
  try {
    const probe = spawnSync(
      process.execPath,
      [
        "-e",
        `fetch('http://127.0.0.1:11434/api/tags').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`,
      ],
      { timeout: 3000, windowsHide: true }
    );
    running = probe.status === 0;
  } catch {
    running = false;
  }
  return { installed: true, version, running, models };
}

function freememGb() {
  return Math.round((os.freemem() / 1024 ** 3) * 10) / 10;
}

function totalmemGb() {
  return Math.round((os.totalmem() / 1024 ** 3) * 10) / 10;
}

const logical = os.availableParallelism?.() ?? os.cpus().length;
const workers = recommendWorkerConfig();
const nvidia = nvidiaReport();
const ollama = ollamaReport();

const report = {
  generatedAt: new Date().toISOString(),
  platform: process.platform,
  arch: process.arch,
  node: nodeVersion(),
  npm: npmVersion(),
  cpu: {
    model: os.cpus()[0]?.model ?? "unknown",
    logicalProcessors: logical,
    recommendedCpuWorkers: workers.cpuWorkers,
    recommendedHttpConcurrency: workers.httpConcurrency,
  },
  memory: {
    totalGb: totalmemGb(),
    freeGb: freememGb(),
    recommendedBatchMb: workers.batchMemoryMb,
  },
  disk: {
    projectRoot: root,
    freeGb: diskFreeGb(),
  },
  gpu: nvidia,
  ollama,
  guidance: {
    useGpuFor: ollama.running
      ? [
          "product description draft",
          "INCI classification assist",
          "category tagging",
          "translation draft",
          "near-duplicate candidate grouping",
        ]
      : ["GPU idle for Next/npm tests — enable Ollama for local AI assists"],
    neverSendToExternalAi: ["user PII", "face photos", "secrets"],
    keepRuleEngineFor: ["recommendation scores", "safety filters"],
  },
};

console.log(JSON.stringify(report, null, 2));
