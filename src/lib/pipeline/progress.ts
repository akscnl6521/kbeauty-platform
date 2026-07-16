import type { PipelineJob, PipelineProgress } from "@/lib/pipeline/types";

export function emptyProgress(): PipelineProgress {
  return {
    totalItems: 0,
    processedItems: 0,
    successItems: 0,
    reviewItems: 0,
    failedItems: 0,
    skippedItems: 0,
  };
}

/**
 * Aggregate job statuses into batch progress counters.
 */
export function recomputeProgress(jobs: PipelineJob[]): PipelineProgress {
  const progress = emptyProgress();
  progress.totalItems = jobs.length;
  for (const job of jobs) {
    if (
      ["completed", "completed_with_warnings", "needs_review", "failed", "cancelled"].includes(
        job.status
      )
    ) {
      progress.processedItems += 1;
    }
    if (job.status === "completed" || job.status === "completed_with_warnings") {
      progress.successItems += 1;
    } else if (job.status === "needs_review") {
      progress.reviewItems += 1;
    } else if (job.status === "failed") {
      progress.failedItems += 1;
    } else if (job.status === "cancelled") {
      progress.skippedItems += 1;
    }
  }
  return progress;
}

export function estimateRemaining(jobs: PipelineJob[]): number {
  return jobs.filter((j) =>
    ["queued", "running", "retry_wait", "paused"].includes(j.status)
  ).length;
}
