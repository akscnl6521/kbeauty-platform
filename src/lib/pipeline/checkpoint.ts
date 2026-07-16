import "server-only";

import { mkdir, readFile, rename, writeFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import type { PipelineBatch, PipelineJob } from "@/lib/pipeline/types";

const ROOT = path.join(process.cwd(), "data", "pipeline", "runtime");

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

function batchDir(batchId: string) {
  return path.join(ROOT, "batches", batchId);
}

function jobsDir(batchId: string) {
  return path.join(batchDir(batchId), "jobs");
}

/**
 * File-based pipeline persistence (Phase 1).
 * Not a substitute for DB tables in multi-instance production.
 */
export async function ensurePipelineStore(): Promise<void> {
  await ensureDir(path.join(ROOT, "batches"));
  await ensureDir(path.join(ROOT, "locks"));
}

export async function writeJsonAtomic(
  filePath: string,
  data: unknown
): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await rename(tmp, filePath);
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function saveBatch(batch: PipelineBatch): Promise<void> {
  await ensurePipelineStore();
  await writeJsonAtomic(path.join(batchDir(batch.batchId), "batch.json"), batch);
}

export async function loadBatch(batchId: string): Promise<PipelineBatch | null> {
  return readJsonFile<PipelineBatch>(
    path.join(batchDir(batchId), "batch.json")
  );
}

export async function listBatches(): Promise<PipelineBatch[]> {
  await ensurePipelineStore();
  const root = path.join(ROOT, "batches");
  let names: string[] = [];
  try {
    names = await readdir(root);
  } catch {
    return [];
  }
  const batches: PipelineBatch[] = [];
  for (const name of names) {
    const batch = await loadBatch(name);
    if (batch) batches.push(batch);
  }
  return batches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveJob(job: PipelineJob): Promise<void> {
  await ensureDir(jobsDir(job.batchId));
  await writeJsonAtomic(
    path.join(jobsDir(job.batchId), `${job.jobId}.json`),
    job
  );
}

export async function loadJob(
  batchId: string,
  jobId: string
): Promise<PipelineJob | null> {
  return readJsonFile<PipelineJob>(
    path.join(jobsDir(batchId), `${jobId}.json`)
  );
}

export async function listJobs(batchId: string): Promise<PipelineJob[]> {
  const dir = jobsDir(batchId);
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const jobs: PipelineJob[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const job = await readJsonFile<PipelineJob>(path.join(dir, name));
    if (job) jobs.push(job);
  }
  return jobs.sort((a, b) => a.entityLabel.localeCompare(b.entityLabel));
}

export async function acquireBatchLock(
  batchId: string,
  owner: string
): Promise<boolean> {
  await ensurePipelineStore();
  const lockPath = path.join(ROOT, "locks", `${batchId}.lock`);
  try {
    await writeFile(lockPath, JSON.stringify({ owner, at: new Date().toISOString() }), {
      flag: "wx",
      encoding: "utf8",
    });
    return true;
  } catch {
    const existing = await readJsonFile<{ owner: string }>(lockPath);
    return existing?.owner === owner;
  }
}

export async function releaseBatchLock(batchId: string): Promise<void> {
  const lockPath = path.join(ROOT, "locks", `${batchId}.lock`);
  try {
    await unlink(lockPath);
  } catch {
    /* ignore */
  }
}

export function getPipelineRuntimeRoot(): string {
  return ROOT;
}
