import "server-only";

import { getPipelinePersistence } from "@/lib/pipeline/persistence";
import type { PipelineJob, PipelineJobStatus } from "@/lib/pipeline/types";

/**
 * Job helpers for pipeline operations console / worker.
 */
export async function getBatchJobs(batchId: string): Promise<PipelineJob[]> {
  return getPipelinePersistence({ requireSupabase: true }).listJobs(batchId);
}

export async function getJobsByStatus(
  batchId: string,
  status: PipelineJobStatus
): Promise<PipelineJob[]> {
  const jobs = await getBatchJobs(batchId);
  return jobs.filter((j) => j.status === status);
}

export async function getNeedsReviewJobs(batchId: string): Promise<PipelineJob[]> {
  return getJobsByStatus(batchId, "needs_review");
}

export async function markJobPaused(jobId: string, batchId: string): Promise<boolean> {
  const persistence = getPipelinePersistence({ requireSupabase: true });
  const jobs = await persistence.listJobs(batchId);
  const job = jobs.find((j) => j.jobId === jobId);
  if (!job) return false;
  if (!["queued", "retry_wait", "running"].includes(job.status)) return false;
  await persistence.updateJob({ ...job, status: "paused", claimedBy: null });
  return true;
}

export async function assertBatchExists(batchId: string): Promise<boolean> {
  return Boolean(
    await getPipelinePersistence({ requireSupabase: true }).getBatch(batchId)
  );
}
