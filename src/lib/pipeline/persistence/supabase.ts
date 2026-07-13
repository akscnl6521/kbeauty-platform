import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { emptyProgress, recomputeProgress } from "@/lib/pipeline/progress";
import type {
  PipelineBatch,
  PipelineJob,
  PipelineMode,
  PipelineProgress,
  PipelineStage,
} from "@/lib/pipeline/types";
import type {
  BrandSiteStateInput,
  ChangeCandidateInput,
  CreateBatchInput,
  FieldProvenanceInput,
  PipelinePersistence,
  QualityScoreInput,
  SkinScoreInput,
} from "@/lib/pipeline/persistence/types";

type BatchRow = {
  id: string;
  mode: PipelineMode;
  status: PipelineBatch["status"];
  trigger_type: string;
  brand_limit: number;
  product_limit_per_brand: number;
  total_items: number;
  processed_items: number;
  success_items: number;
  review_items: number;
  failed_items: number;
  skipped_items: number;
  progress: PipelineProgress | Record<string, unknown>;
  stages_completed: string[] | null;
  notes: string[] | null;
  checkpoint: Record<string, unknown> | null;
  lock_owner: string | null;
  lock_heartbeat_at: string | null;
  safe_error_code: string | null;
  safe_error_message: string | null;
  started_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type JobRow = {
  id: string;
  batch_id: string;
  entity_type: PipelineJob["entityType"];
  entity_id: string;
  source_key: string | null;
  brand_name: string | null;
  entity_label: string;
  stage: string;
  status: PipelineJob["status"];
  attempts: number;
  max_attempts: number;
  next_retry_at: string | null;
  claimed_by: string | null;
  claim_heartbeat_at: string | null;
  failure_code: string | null;
  safe_failure_message: string | null;
  checkpoint: Record<string, unknown> | null;
  warnings: string[] | null;
  result_summary: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function progressFromBatch(row: BatchRow): PipelineProgress {
  const p = (row.progress ?? {}) as Partial<PipelineProgress>;
  return {
    totalItems: Number(p.totalItems ?? row.total_items ?? 0),
    processedItems: Number(p.processedItems ?? row.processed_items ?? 0),
    successItems: Number(p.successItems ?? row.success_items ?? 0),
    reviewItems: Number(p.reviewItems ?? row.review_items ?? 0),
    failedItems: Number(p.failedItems ?? row.failed_items ?? 0),
    skippedItems: Number(p.skippedItems ?? row.skipped_items ?? 0),
  };
}

function rowToBatch(row: BatchRow): PipelineBatch {
  return {
    batchId: row.id,
    mode: row.mode,
    status: row.status,
    triggerType: (row.trigger_type as PipelineBatch["triggerType"]) ?? "manual",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    pausedAt: row.paused_at,
    completedAt: row.completed_at,
    brandLimit: row.brand_limit,
    productLimitPerBrand: row.product_limit_per_brand,
    progress: progressFromBatch(row),
    stagesCompleted: (row.stages_completed ?? []) as PipelineStage[],
    notes: row.notes ?? [],
    checkpoint: row.checkpoint ?? {},
    lockOwner: row.lock_owner,
    lockHeartbeatAt: row.lock_heartbeat_at,
    safeErrorCode: row.safe_error_code,
    safeErrorMessage: row.safe_error_message,
  };
}

function rowToJob(row: JobRow): PipelineJob {
  return {
    jobId: row.id,
    batchId: row.batch_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    sourceKey: row.source_key,
    brandName: row.brand_name,
    entityLabel: row.entity_label,
    stage: row.stage as PipelineStage,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    nextRetryAt: row.next_retry_at,
    claimedBy: row.claimed_by,
    claimHeartbeatAt: row.claim_heartbeat_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    failureCode: row.failure_code,
    safeFailureMessage: row.safe_failure_message,
    checkpoint: row.checkpoint ?? {},
    warnings: row.warnings ?? [],
    resultSummary: row.result_summary,
  };
}

function batchToRow(batch: PipelineBatch) {
  const progress = batch.progress ?? emptyProgress();
  return {
    mode: batch.mode,
    status: batch.status,
    trigger_type: batch.triggerType ?? "manual",
    brand_limit: batch.brandLimit,
    product_limit_per_brand: batch.productLimitPerBrand,
    total_items: progress.totalItems,
    processed_items: progress.processedItems,
    success_items: progress.successItems,
    review_items: progress.reviewItems,
    failed_items: progress.failedItems,
    skipped_items: progress.skippedItems,
    progress,
    stages_completed: batch.stagesCompleted,
    notes: batch.notes,
    checkpoint: batch.checkpoint ?? {},
    lock_owner: batch.lockOwner,
    lock_heartbeat_at: batch.lockHeartbeatAt ?? null,
    safe_error_code: batch.safeErrorCode ?? null,
    safe_error_message: batch.safeErrorMessage ?? null,
    started_at: batch.startedAt,
    paused_at: batch.pausedAt ?? null,
    completed_at: batch.completedAt,
  };
}

function jobToRow(job: PipelineJob) {
  return {
    batch_id: job.batchId,
    entity_type: job.entityType,
    entity_id: job.entityId,
    source_key: job.sourceKey ?? `${job.entityType}:${job.entityId}:${job.stage}`,
    brand_name: job.brandName ?? null,
    entity_label: job.entityLabel,
    stage: job.stage,
    status: job.status,
    attempts: job.attempts,
    max_attempts: job.maxAttempts,
    next_retry_at: job.nextRetryAt,
    claimed_by: job.claimedBy ?? null,
    claim_heartbeat_at: job.claimHeartbeatAt ?? null,
    failure_code: job.failureCode,
    safe_failure_message: job.safeFailureMessage,
    checkpoint: job.checkpoint,
    warnings: job.warnings,
    result_summary: job.resultSummary,
    started_at: job.startedAt,
    completed_at: job.completedAt,
  };
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

/**
 * Supabase-backed pipeline persistence (service role).
 */
export function createSupabasePersistence(): PipelinePersistence {
  const client = createSupabaseAdminClient();

  return {
    backend: "supabase",

    async createBatch(input: CreateBatchInput): Promise<PipelineBatch> {
      const id = randomUUID();
      const progress = emptyProgress();
      const notes =
        input.notes ??
        [
          input.mode === "dry_run"
            ? "dry_run: 운영 discovery/products INSERT 없음"
            : "commit: 명시적 commit 배치만 candidate/queue 저장 (published 금지)",
        ];
      const { data, error } = await client
        .from("pipeline_batches")
        .insert({
          id,
          mode: input.mode,
          status: "queued",
          trigger_type: input.triggerType ?? "manual",
          brand_limit: input.brandLimit,
          product_limit_per_brand: input.productLimitPerBrand,
          progress,
          notes,
          checkpoint: {},
        })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error("pipeline batch create failed");
      }
      return rowToBatch(data as BatchRow);
    },

    async updateBatch(batch: PipelineBatch): Promise<void> {
      const { error } = await client
        .from("pipeline_batches")
        .update(batchToRow(batch))
        .eq("id", batch.batchId);
      if (error) throw new Error("pipeline batch update failed");
    },

    async getBatch(batchId: string): Promise<PipelineBatch | null> {
      const { data, error } = await client
        .from("pipeline_batches")
        .select("*")
        .eq("id", batchId)
        .maybeSingle();
      if (error) throw new Error("pipeline batch load failed");
      return data ? rowToBatch(data as BatchRow) : null;
    },

    async listBatches(limit = 50): Promise<PipelineBatch[]> {
      const { data, error } = await client
        .from("pipeline_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error("pipeline batch list failed");
      return (data as BatchRow[] | null)?.map(rowToBatch) ?? [];
    },

    async createJobs(jobs: PipelineJob[]): Promise<void> {
      if (!jobs.length) return;
      const rows = jobs.map((j) => ({ id: j.jobId, ...jobToRow(j) }));
      const { error } = await client.from("pipeline_jobs").upsert(rows, {
        onConflict: "batch_id,entity_type,entity_id,stage",
        ignoreDuplicates: true,
      });
      if (error) throw new Error("pipeline jobs create failed");
    },

    async updateJob(job: PipelineJob): Promise<void> {
      const { error } = await client
        .from("pipeline_jobs")
        .update(jobToRow(job))
        .eq("id", job.jobId);
      if (error) throw new Error("pipeline job update failed");
    },

    async listJobs(batchId: string): Promise<PipelineJob[]> {
      const { data, error } = await client
        .from("pipeline_jobs")
        .select("*")
        .eq("batch_id", batchId)
        .order("created_at", { ascending: true });
      if (error) throw new Error("pipeline jobs list failed");
      return (data as JobRow[] | null)?.map(rowToJob) ?? [];
    },

    async claimNextJobs(
      batchId: string,
      workerId: string,
      limit: number
    ): Promise<PipelineJob[]> {
      const { data, error } = await client.rpc("claim_pipeline_jobs", {
        p_batch_id: batchId,
        p_worker_id: workerId,
        p_limit: limit,
        p_stale_seconds: 300,
      });
      if (error) throw new Error("pipeline job claim failed");
      return (data as JobRow[] | null)?.map(rowToJob) ?? [];
    },

    async acquireWorkerLock(batchId: string, workerId: string): Promise<boolean> {
      const now = new Date().toISOString();
      const staleMs = 5 * 60 * 1000;
      const existing = await this.getBatch(batchId);
      if (!existing) return false;

      const heartbeat = existing.lockHeartbeatAt
        ? new Date(existing.lockHeartbeatAt).getTime()
        : 0;
      const isStale = !existing.lockOwner || Date.now() - heartbeat > staleMs;
      if (existing.lockOwner && existing.lockOwner !== workerId && !isStale) {
        return false;
      }

      const { error } = await client
        .from("pipeline_batches")
        .update({
          lock_owner: workerId,
          lock_heartbeat_at: now,
        })
        .eq("id", batchId);

      return !error;
    },

    async releaseWorkerLock(batchId: string, workerId?: string): Promise<void> {
      let q = client
        .from("pipeline_batches")
        .update({ lock_owner: null, lock_heartbeat_at: null })
        .eq("id", batchId);
      if (workerId) q = q.eq("lock_owner", workerId);
      await q;
    },

    async heartbeat(batchId: string, workerId: string): Promise<void> {
      const now = new Date().toISOString();
      await client
        .from("pipeline_batches")
        .update({ lock_heartbeat_at: now })
        .eq("id", batchId)
        .eq("lock_owner", workerId);
      await client
        .from("pipeline_jobs")
        .update({ claim_heartbeat_at: now })
        .eq("batch_id", batchId)
        .eq("claimed_by", workerId)
        .eq("status", "running");
    },

    async saveBrandResolution(input: BrandSiteStateInput): Promise<void> {
      const { error } = await client.from("brand_official_site_state").upsert(
        {
          brand_key: input.brandKey,
          canonical_name: input.canonicalName,
          candidate_url: input.candidateUrl ?? null,
          verified_url: input.verifiedUrl ?? null,
          official_domain: input.officialDomain ?? null,
          verification_status: input.verificationStatus,
          connector: input.connector ?? null,
          confidence: input.confidence,
          robots_status: input.robotsStatus ?? null,
          sitemap_status: input.sitemapStatus ?? null,
          crawl_status: input.crawlStatus ?? null,
          last_checked_at: new Date().toISOString(),
          last_crawled_at: new Date().toISOString(),
          last_error_code: input.lastErrorCode ?? null,
          safe_error_message: input.safeErrorMessage ?? null,
          source_metadata: input.sourceMetadata ?? {},
        },
        { onConflict: "brand_key" }
      );
      if (error) throw new Error("brand site state save failed");
    },

    async saveFieldProvenance(input: FieldProvenanceInput): Promise<void> {
      const valueHash =
        input.valueHash ??
        (input.valueSummary ? hashText(input.valueSummary) : hashText(input.fieldName));
      const { error } = await client.from("product_field_provenance").upsert(
        {
          entity_type: input.entityType,
          entity_id: input.entityId,
          product_id: input.productId ?? null,
          candidate_id: input.candidateId ?? null,
          field_name: input.fieldName,
          value_summary: input.valueSummary?.slice(0, 500) ?? null,
          value_hash: valueHash,
          source_url: input.sourceUrl ?? null,
          source_domain: input.sourceDomain ?? null,
          extraction_method: input.extractionMethod ?? null,
          confidence: input.confidence,
          raw_hash: input.rawHash ?? null,
          verified_status: input.verifiedStatus ?? "unverified",
          extracted_at: new Date().toISOString(),
        },
        { onConflict: "entity_type,entity_id,field_name,value_hash" }
      );
      if (error) throw new Error("field provenance save failed");
    },

    async saveQualityScore(input: QualityScoreInput): Promise<void> {
      const d = input.quality.dimensions;
      const { error } = await client.from("product_quality_scores").upsert(
        {
          entity_key: input.entityKey,
          product_id: input.productId ?? null,
          candidate_id: input.candidateId ?? null,
          identity_score: d.identity ?? 0,
          source_authority_score: d.source ?? 0,
          ingredient_completeness: d.ingredients ?? 0,
          offer_completeness: d.offer ?? 0,
          evidence_completeness: d.evidence ?? 0,
          safety_completeness: d.safety ?? 0,
          tone_completeness: d.tone ?? 0,
          freshness_score: d.freshness ?? 0,
          dedupe_confidence: d.dedupe ?? 0,
          total_score: input.quality.score,
          grade: input.quality.grade,
          publish_eligible: false,
          blockers: input.quality.blockers,
          dimensions: d,
          scoring_version: "v1",
          calculated_at: new Date().toISOString(),
        },
        { onConflict: "entity_key,scoring_version" }
      );
      if (error) throw new Error("quality score save failed");
    },

    async saveSkinMatchScore(input: SkinScoreInput): Promise<void> {
      const { error } = await client.from("product_skin_match_scores").upsert(
        {
          entity_key: input.entityKey,
          product_id: input.productId ?? null,
          candidate_id: input.candidateId ?? null,
          skin_types: input.skin.skinTypes,
          concerns: input.skin.concerns,
          usage_areas: input.skin.usageAreas,
          routine_steps: input.skin.routineSteps,
          tone_depth: input.tone.depths,
          undertone: input.tone.undertones,
          tone_relevance: input.tone.toneRelevance,
          match_score: input.tone.matchScore,
          confidence: Math.min(input.skin.confidence, input.tone.confidence),
          reasons: input.skin.reasons,
          cautions: input.tone.cautionReasons,
          scoring_version: "v1",
          calculated_at: new Date().toISOString(),
        },
        { onConflict: "entity_key,scoring_version" }
      );
      if (error) throw new Error("skin score save failed");
    },

    async saveChangeCandidate(input: ChangeCandidateInput): Promise<void> {
      const { error } = await client.from("product_change_candidates").upsert(
        {
          entity_type: input.entityType,
          entity_id: input.entityId,
          product_id: input.productId ?? null,
          change_type: input.changeType,
          old_hash: input.oldHash ?? null,
          new_hash: input.newHash ?? null,
          safe_summary: input.safeSummary ?? null,
          status: "needs_review",
          confidence: input.confidence ?? 0.5,
          source: input.source ?? "pipeline",
          payload: input.payload ?? {},
          detected_at: new Date().toISOString(),
        },
        {
          onConflict: "entity_type,entity_id,change_type,old_hash,new_hash",
          ignoreDuplicates: true,
        }
      );
      if (error) throw new Error("change candidate save failed");
    },
  };
}

export function syncBatchProgress(
  batch: PipelineBatch,
  jobs: PipelineJob[]
): PipelineBatch {
  const progress = recomputeProgress(jobs);
  return { ...batch, progress };
}
