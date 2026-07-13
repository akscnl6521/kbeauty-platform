import type {
  PipelineBatch,
  PipelineJob,
  PipelineMode,
  PipelineStage,
  QualityScore,
  SkinClassification,
  ToneMatchResult,
} from "@/lib/pipeline/types";

export type PersistenceBackend = "supabase" | "file";

export type BrandSiteStateInput = {
  brandKey: string;
  canonicalName: string;
  candidateUrl?: string | null;
  verifiedUrl?: string | null;
  officialDomain?: string | null;
  verificationStatus:
    | "unverified"
    | "needs_review"
    | "verified"
    | "blocked"
    | "failed";
  connector?: string | null;
  confidence: number;
  robotsStatus?: string | null;
  sitemapStatus?: string | null;
  crawlStatus?: string | null;
  lastErrorCode?: string | null;
  safeErrorMessage?: string | null;
  sourceMetadata?: Record<string, unknown>;
};

export type FieldProvenanceInput = {
  entityType: "product" | "candidate" | "brand" | "job";
  entityId: string;
  productId?: number | null;
  candidateId?: string | null;
  fieldName: string;
  valueSummary?: string | null;
  valueHash?: string | null;
  sourceUrl?: string | null;
  sourceDomain?: string | null;
  extractionMethod?: string | null;
  confidence: number;
  rawHash?: string | null;
  verifiedStatus?: "unverified" | "needs_review" | "verified";
};

export type QualityScoreInput = {
  entityKey: string;
  productId?: number | null;
  candidateId?: string | null;
  quality: QualityScore;
  dimensions?: Record<string, number>;
};

export type SkinScoreInput = {
  entityKey: string;
  productId?: number | null;
  candidateId?: string | null;
  skin: SkinClassification;
  tone: ToneMatchResult;
};

export type ChangeCandidateInput = {
  entityType: "product" | "candidate" | "brand" | "offer";
  entityId: string;
  productId?: number | null;
  changeType: string;
  oldHash?: string | null;
  newHash?: string | null;
  safeSummary?: string | null;
  confidence?: number;
  source?: string | null;
  payload?: Record<string, unknown>;
};

export type CreateBatchInput = {
  mode: PipelineMode;
  triggerType?: "manual" | "scheduler" | "api" | "resume" | "retry";
  brandLimit: number;
  productLimitPerBrand: number;
  notes?: string[];
};

/**
 * Pipeline persistence contract (Supabase primary, file fallback).
 */
export interface PipelinePersistence {
  readonly backend: PersistenceBackend;

  createBatch(input: CreateBatchInput): Promise<PipelineBatch>;
  updateBatch(batch: PipelineBatch): Promise<void>;
  getBatch(batchId: string): Promise<PipelineBatch | null>;
  listBatches(limit?: number): Promise<PipelineBatch[]>;

  createJobs(jobs: PipelineJob[]): Promise<void>;
  updateJob(job: PipelineJob): Promise<void>;
  listJobs(batchId: string): Promise<PipelineJob[]>;
  claimNextJobs(
    batchId: string,
    workerId: string,
    limit: number
  ): Promise<PipelineJob[]>;

  acquireWorkerLock(batchId: string, workerId: string): Promise<boolean>;
  releaseWorkerLock(batchId: string, workerId?: string): Promise<void>;
  heartbeat(batchId: string, workerId: string): Promise<void>;

  saveBrandResolution(input: BrandSiteStateInput): Promise<void>;
  saveFieldProvenance(input: FieldProvenanceInput): Promise<void>;
  saveQualityScore(input: QualityScoreInput): Promise<void>;
  saveSkinMatchScore(input: SkinScoreInput): Promise<void>;
  saveChangeCandidate(input: ChangeCandidateInput): Promise<void>;
}

export type { PipelineBatch, PipelineJob, PipelineStage };
