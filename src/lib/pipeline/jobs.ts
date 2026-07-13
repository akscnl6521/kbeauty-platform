import "server-only";

import { listJobs, loadBatch, saveJob } from "@/lib/pipeline/checkpoint";
import type { PipelineJob, PipelineJobStatus } from "@/lib/pipeline/types";

/**
 * Job helpers for pipeline operations console / worker.
 */
export async function getBatchJobs(batchId: string): Promise<PipelineJob[]> {
  return listJobs(batchId);
}

export async function getJobsByStatus(
  batchId: string,
  status: PipelineJobStatus
): Promise<PipelineJob[]> {
  const jobs = await listJobs(batchId);
  return jobs.filter((j) => j.status === status);
}

export async function getNeedsReviewJobs(batchId: string): Promise<PipelineJob[]> {
  return getJobsByStatus(batchId, "needs_review");
}

export async function markJobPaused(jobId: string, batchId: string): Promise<boolean> {
  const jobs = await listJobs(batchId);
  const job = jobs.find((j) => j.jobId === jobId);
  if (!job) return false;
  if (!["queued", "retry_wait", "running"].includes(job.status)) return false;
  await saveJob({ ...job, status: "paused" });
  return true;
}

export async function assertBatchExists(batchId: string): Promise<boolean> {
  return Boolean(await loadBatch(batchId));
}
