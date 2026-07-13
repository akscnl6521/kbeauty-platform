import "server-only";

import {
  createPipelineBatch,
  retryFailedJobs,
  setPipelineBatchStatus,
  tickPipelineBatch,
} from "@/lib/pipeline/orchestrator";
import { pipelineLog } from "@/lib/pipeline/logger";
import { evaluateBatchCommitReadiness } from "@/lib/pipeline/quality-gate";
import {
  assertHardWritePolicy,
  loadPipelineOperationConfig,
  type PipelineOperationConfig,
} from "@/lib/pipeline/operation-config";
import type { PipelineMode } from "@/lib/pipeline/types";

export type WorkerRunOptions = {
  mode?: PipelineMode | "autonomous";
  brandLimit?: number;
  productLimitPerBrand?: number;
  tickLimit?: number;
  maxTicks?: number;
  batchId?: string;
  workerId?: string;
  triggerType?: "manual" | "scheduler" | "api" | "resume" | "retry";
};

/**
 * Scheduler entry: load fixed operation config (no CLI knobs).
 */
export async function runPipelineWorkerFromConfig(options?: {
  workerId?: string;
  triggerType?: WorkerRunOptions["triggerType"];
}) {
  const config = loadPipelineOperationConfig();
  assertHardWritePolicy(config);

  if (config.paused) {
    pipelineLog("info", "worker skipped — paused in operation config", {});
    return {
      batchId: null as string | null,
      ticks: 0,
      skipped: "paused" as const,
      writeScope: "none" as const,
    };
  }

  const workerId = options?.workerId ?? `local-${process.pid}`;
  const triggerType = options?.triggerType ?? "scheduler";

  if (config.mode === "dry_run") {
    return runConfiguredDryRun(config, workerId, triggerType);
  }

  if (!config.allowCandidateInsert) {
    pipelineLog("info", "worker dry_run only — candidate insert disabled", {});
    return runConfiguredDryRun(config, workerId, triggerType);
  }

  return runAutonomousGatedCandidateIntake({
    brandLimit: config.brandsPerRun,
    productLimitPerBrand: config.productsPerBrand,
    tickLimit: config.tickLimit,
    maxTicks: config.maxTicks,
    workerId,
    triggerType,
    config,
  });
}

async function runConfiguredDryRun(
  config: PipelineOperationConfig,
  workerId: string,
  triggerType: NonNullable<WorkerRunOptions["triggerType"]>
) {
  const batch = await createPipelineBatch({
    mode: "dry_run",
    brandLimit: config.brandsPerRun,
    productLimitPerBrand: config.productsPerBrand,
    triggerType,
  });
  const result = await tickUntilDone(batch.batchId, {
    tickLimit: config.tickLimit,
    maxTicks: config.maxTicks,
    workerId,
  });
  return {
    ...result,
    mode: "dry_run" as const,
    committed: false,
    writeScope: "none" as const,
  };
}

/**
 * @deprecated Prefer runPipelineWorkerFromConfig for scheduler.
 * Kept for admin API manual starts with explicit options.
 */
export async function runPipelineWorker(options: WorkerRunOptions = {}) {
  const workerId = options.workerId ?? `local-${process.pid}`;
  const tickLimit = options.tickLimit ?? 5;
  const maxTicks = options.maxTicks ?? 50;
  const requested = options.mode ?? "dry_run";

  if (requested === "autonomous") {
    const config = loadPipelineOperationConfig();
    assertHardWritePolicy(config);
    return runAutonomousGatedCandidateIntake({
      brandLimit: options.brandLimit ?? config.brandsPerRun,
      productLimitPerBrand:
        options.productLimitPerBrand ?? config.productsPerBrand,
      tickLimit,
      maxTicks,
      workerId,
      triggerType: options.triggerType ?? "api",
      config,
    });
  }

  const mode: PipelineMode = requested === "commit" ? "commit" : "dry_run";
  let batchId = options.batchId;
  if (!batchId) {
    const batch = await createPipelineBatch({
      mode,
      brandLimit: options.brandLimit ?? 10,
      productLimitPerBrand: options.productLimitPerBrand ?? 20,
      triggerType: options.triggerType ?? "scheduler",
    });
    batchId = batch.batchId;
    pipelineLog("info", "worker created batch", { batchId, workerId, mode });
  }

  return tickUntilDone(batchId, { tickLimit, maxTicks, workerId });
}

async function tickUntilDone(
  batchId: string,
  options: { tickLimit: number; maxTicks: number; workerId: string }
) {
  let ticks = 0;
  while (ticks < options.maxTicks) {
    ticks += 1;
    const { batch, processed } = await tickPipelineBatch(batchId, {
      limit: options.tickLimit,
      workerId: options.workerId,
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

async function runAutonomousGatedCandidateIntake(input: {
  brandLimit: number;
  productLimitPerBrand: number;
  tickLimit: number;
  maxTicks: number;
  workerId: string;
  triggerType: "manual" | "scheduler" | "api" | "resume" | "retry";
  config: PipelineOperationConfig;
}) {
  assertHardWritePolicy(input.config);

  const dry = await createPipelineBatch({
    mode: "dry_run",
    brandLimit: input.brandLimit,
    productLimitPerBrand: input.productLimitPerBrand,
    triggerType: input.triggerType,
  });
  pipelineLog("info", "autonomous dry_run started", { batchId: dry.batchId });
  const dryResult = await tickUntilDone(dry.batchId, {
    tickLimit: input.tickLimit,
    maxTicks: input.maxTicks,
    workerId: input.workerId,
  });

  const { getPipelinePersistence } = await import("@/lib/pipeline/persistence");
  const persistence = getPipelinePersistence({ requireSupabase: true });
  const dryBatch = await persistence.getBatch(dry.batchId);
  const readiness = evaluateBatchCommitReadiness({
    successItems: dryBatch?.progress.successItems ?? 0,
    reviewItems: dryBatch?.progress.reviewItems ?? 0,
    failedItems: dryBatch?.progress.failedItems ?? 0,
    processedItems: dryBatch?.progress.processedItems ?? 0,
  });

  pipelineLog("info", "autonomous readiness", {
    dryBatchId: dry.batchId,
    pass: readiness.pass,
    blockers: readiness.blockers,
    progress: dryBatch?.progress,
  });

  if (!readiness.pass || !input.config.allowCandidateInsert) {
    return {
      batchId: dry.batchId,
      ticks: dryResult.ticks,
      commitBatchId: null as string | null,
      mode: "autonomous" as const,
      committed: false,
      writeScope: "none" as const,
    };
  }

  const commit = await createPipelineBatch({
    mode: "commit",
    brandLimit: input.brandLimit,
    productLimitPerBrand: input.productLimitPerBrand,
    triggerType: input.triggerType,
  });
  pipelineLog("info", "autonomous gated candidate insert started", {
    batchId: commit.batchId,
    writeScope: "gated_new_candidates",
  });
  const commitResult = await tickUntilDone(commit.batchId, {
    tickLimit: input.tickLimit,
    maxTicks: input.maxTicks,
    workerId: `${input.workerId}-gated-candidates`,
  });

  let productReeval: Awaited<
    ReturnType<
      typeof import("@/lib/pipeline/product-verify/product-reeval").reevaluateProductsForActivation
    >
  > | null = null;

  if (
    input.config.allowProductReevaluation ||
    input.config.allowProductAutoVerify
  ) {
    try {
      const { createSupabaseAdminClient } = await import(
        "@/lib/supabase/admin"
      );
      const { reevaluateProductsForActivation } = await import(
        "@/lib/pipeline/product-verify/product-reeval"
      );
      const client = createSupabaseAdminClient();
      productReeval = await reevaluateProductsForActivation(client, {
        batchId: commit.batchId,
        limit: input.config.maxProductVerificationsPerRun,
      });
      pipelineLog("info", "product reevaluation complete", {
        batchId: commit.batchId,
        ...productReeval,
      });
    } catch (e) {
      pipelineLog("warn", "product reevaluation skipped", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    batchId: dry.batchId,
    ticks: dryResult.ticks + commitResult.ticks,
    commitBatchId: commit.batchId,
    mode: "autonomous" as const,
    committed: true,
    writeScope: "gated_new_candidates" as const,
    productReeval,
  };
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
