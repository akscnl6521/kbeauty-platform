import "server-only";

import {
  createPipelineBatch,
  retryFailedJobs,
  setPipelineBatchStatus,
  tickPipelineBatch,
} from "@/lib/pipeline/orchestrator";
import { pipelineLog } from "@/lib/pipeline/logger";
import type { PipelineMode } from "@/lib/pipeline/types";

export type WorkerRunOptions = {
  mode?: PipelineMode;
  brandLimit?: number;
  productLimitPerBrand?: number;
  tickLimit?: number;
  maxTicks?: number;
  batchId?: string;
  workerId?: string;
};

/**
 * Unattended local worker loop: create or resume a batch, tick until idle/paused.
 * File-checkpoint based — not multi-instance safe without DB migration.
 */
export async function runPipelineWorker(options: WorkerRunOptions = {}) {
  const workerId = options.workerId ?? `local-${process.pid}`;
  const tickLimit = options.tickLimit ?? 5;
  const maxTicks = options.maxTicks ?? 50;

  let batchId = options.batchId;
  if (!batchId) {
    const batch = await createPipelineBatch({
      mode: options.mode ?? "dry_run",
      brandLimit: options.brandLimit ?? 10,
      productLimitPerBrand: options.productLimitPerBrand ?? 20,
    });
    batchId = batch.batchId;
    pipelineLog("info", "worker created batch", { batchId, workerId });
  }

  let ticks = 0;
  while (ticks < maxTicks) {
    ticks += 1;
    const { batch, processed } = await tickPipelineBatch(batchId, {
      limit: tickLimit,
      workerId,
    });

    pipelineLog("info", "worker tick", {
      batchId,
      ticks,
      processed,
      status: batch.status,
      progress: batch.progress,
    });

    if (batch.status === "paused" || batch.status === "cancelled") break;
    if (
      batch.status === "completed" ||
      batch.status === "completed_with_warnings" ||
      batch.status === "failed"
    ) {
      break;
    }
    if (processed === 0) break;
  }

  return { batchId, ticks };
}

export async function pauseWorkerBatch(batchId: string) {
  return setPipelineBatchStatus(batchId, "paused");
}

export async function resumeWorkerBatch(batchId: string) {
  return setPipelineBatchStatus(batchId, "queued");
}

export async function retryWorkerBatch(batchId: string) {
  return retryFailedJobs(batchId);
}
