import "server-only";

import { randomUUID } from "node:crypto";
import {
  acquireBatchLock,
  listBatches as fileListBatches,
  listJobs as fileListJobs,
  loadBatch,
  releaseBatchLock,
  saveBatch,
  saveJob,
} from "@/lib/pipeline/checkpoint";
import { emptyProgress } from "@/lib/pipeline/progress";
import type { PipelineBatch, PipelineJob } from "@/lib/pipeline/types";
import type {
  BrandSiteStateInput,
  ChangeCandidateInput,
  CreateBatchInput,
  FieldProvenanceInput,
  PipelinePersistence,
  QualityScoreInput,
  SkinScoreInput,
} from "@/lib/pipeline/persistence/types";
import { pipelineLog } from "@/lib/pipeline/logger";

/**
 * File-based fallback (dev/emergency). Not multi-worker safe.
 * Extended score/provenance writes are logged only (no durable DB).
 */
export function createFilePersistence(): PipelinePersistence {
  return {
    backend: "file",

    async createBatch(input: CreateBatchInput): Promise<PipelineBatch> {
      const now = new Date().toISOString();
      const batch: PipelineBatch = {
        batchId: randomUUID(),
        mode: input.mode,
        status: "queued",
        triggerType: input.triggerType ?? "manual",
        createdAt: now,
        updatedAt: now,
        startedAt: null,
        pausedAt: null,
        completedAt: null,
        brandLimit: input.brandLimit,
        productLimitPerBrand: input.productLimitPerBrand,
        progress: emptyProgress(),
        stagesCompleted: [],
        notes: input.notes ?? [],
        checkpoint: {},
        lockOwner: null,
        lockHeartbeatAt: null,
        safeErrorCode: null,
        safeErrorMessage: null,
      };
      await saveBatch(batch);
      return batch;
    },

    async updateBatch(batch: PipelineBatch): Promise<void> {
      await saveBatch(batch);
    },

    async getBatch(batchId: string): Promise<PipelineBatch | null> {
      return loadBatch(batchId);
    },

    async listBatches(limit = 50): Promise<PipelineBatch[]> {
      const all = await fileListBatches();
      return all.slice(0, limit);
    },

    async createJobs(jobs: PipelineJob[]): Promise<void> {
      for (const job of jobs) await saveJob(job);
    },

    async updateJob(job: PipelineJob): Promise<void> {
      await saveJob(job);
    },

    async listJobs(batchId: string): Promise<PipelineJob[]> {
      return fileListJobs(batchId);
    },

    async claimNextJobs(
      batchId: string,
      workerId: string,
      limit: number
    ): Promise<PipelineJob[]> {
      const jobs = await fileListJobs(batchId);
      const now = Date.now();
      const runnable = jobs
        .filter((j) => {
          if (j.status === "queued") return true;
          if (j.status === "retry_wait") {
            if (!j.nextRetryAt) return true;
            return new Date(j.nextRetryAt).getTime() <= now;
          }
          return false;
        })
        .slice(0, limit);

      const claimed: PipelineJob[] = [];
      for (const job of runnable) {
        const next: PipelineJob = {
          ...job,
          status: "running",
          claimedBy: workerId,
          claimHeartbeatAt: new Date().toISOString(),
          startedAt: job.startedAt ?? new Date().toISOString(),
          attempts: job.attempts + 1,
        };
        await saveJob(next);
        claimed.push(next);
      }
      return claimed;
    },

    async acquireWorkerLock(batchId: string, workerId: string): Promise<boolean> {
      return acquireBatchLock(batchId, workerId);
    },

    async releaseWorkerLock(batchId: string): Promise<void> {
      await releaseBatchLock(batchId);
    },

    async heartbeat(batchId: string, workerId: string): Promise<void> {
      const batch = await loadBatch(batchId);
      if (!batch || batch.lockOwner !== workerId) return;
      await saveBatch({
        ...batch,
        lockHeartbeatAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },

    async saveBrandResolution(input: BrandSiteStateInput): Promise<void> {
      pipelineLog("info", "file persistence brand resolution (ephemeral)", {
        brandKey: input.brandKey,
        status: input.verificationStatus,
      });
    },

    async saveFieldProvenance(_input: FieldProvenanceInput): Promise<void> {
      /* file backend: no durable provenance */
    },

    async saveQualityScore(_input: QualityScoreInput): Promise<void> {
      /* file backend: no durable quality */
    },

    async saveSkinMatchScore(_input: SkinScoreInput): Promise<void> {
      /* file backend: no durable skin score */
    },

    async saveChangeCandidate(_input: ChangeCandidateInput): Promise<void> {
      /* file backend: no durable change candidate */
    },
  };
}
