/**
 * Fixed pipeline operation config (file-based).
 * Scheduler/worker read this — CLI must not override ops limits or secrets.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { MonitoringConfig } from "@/lib/admin/operations/types";
import { DEFAULT_MONITORING_CONFIG } from "@/lib/admin/operations/types";

export type PipelineOperationMode = "dry_run" | "gated_commit";

export type PipelineOperationConfig = {
  version: number;
  mode: PipelineOperationMode;
  paused: boolean;
  scheduleHint: string;
  brandsPerRun: number;
  productsPerBrand: number;
  tickLimit: number;
  maxTicks: number;
  allowCandidateInsert: boolean;
  allowQueueInsert: boolean;
  allowAuditInsert: boolean;
  allowDraftProductInsert: boolean;
  allowVariantInsert: boolean;
  allowProductIngredientInsert: boolean;
  allowUnverifiedIngredientInsert: boolean;
  allowSkinScoreUpsert: boolean;
  allowQualityScoreUpsert: boolean;
  allowCandidateAutoChecks: boolean;
  allowOfferCandidateInsert: boolean;
  allowVerifiedOfferUpsert: boolean;
  allowOfferFreshnessUpdate: boolean;
  allowOfferChangeCandidate: boolean;
  allowOfferReviewQueue: boolean;
  allowMarketplaceOfficialStore: boolean;
  allowMarketplaceSeller: boolean;
  allowUnverifiedPurchaseRecommendation: boolean;
  allowProductAutoVerify: boolean;
  allowProductAutoActivate: boolean;
  allowProductReevaluation: boolean;
  allowAutoApproveOfficialIngredients: boolean;
  allowProductVerifyReviewQueue: boolean;
  allowProductDemotion: boolean;
  maxNewProductsPerRun: number;
  maxNewIngredientsPerRun: number;
  maxOffersPerRun: number;
  maxRetailersPerProduct: number;
  maxProductVerificationsPerRun: number;
  offerFreshnessHours: number;
  officialOfferConfidenceThreshold: number;
  authorizedRetailerThreshold: number;
  ingredientMatchThreshold: number;
  draftProductQualityThreshold: number;
  productVerifyQualityGrades: string[];
  shippingCountriesPriority: string[];
  /** Hard false: ungated live product insert (use draft flag instead). */
  allowProductInsert: boolean;
  /** Hard false: ungated offer insert (use gated offer flags). */
  allowOfferInsert: boolean;
  /** Hard false: ungated verified offer insert. */
  allowVerifiedOfferInsert: boolean;
  allowPublish: boolean;
  allowDelete: boolean;
  allowIngredientWrite: boolean;
  allowExistingCandidateBulkUpdate: boolean;
  allowExistingProductOverwrite: boolean;
  allowBulkStatusRewrite: boolean;
  monitoring: MonitoringConfig;
  notes?: string[];
};

const HARD_FALSE_KEYS = [
  "allowProductInsert",
  "allowOfferInsert",
  "allowVerifiedOfferInsert",
  "allowPublish",
  "allowDelete",
  "allowIngredientWrite",
  "allowExistingCandidateBulkUpdate",
  "allowExistingProductOverwrite",
  "allowBulkStatusRewrite",
  "allowMarketplaceSeller",
  "allowUnverifiedPurchaseRecommendation",
  "allowProductDemotion",
] as const;

export const DEFAULT_PIPELINE_OPERATION: PipelineOperationConfig = {
  version: 5,
  mode: "gated_commit",
  paused: false,
  scheduleHint: "every_6_hours",
  brandsPerRun: 10,
  productsPerBrand: 50,
  tickLimit: 5,
  maxTicks: 60,
  allowCandidateInsert: true,
  allowQueueInsert: true,
  allowAuditInsert: true,
  allowDraftProductInsert: true,
  allowVariantInsert: true,
  allowProductIngredientInsert: true,
  allowUnverifiedIngredientInsert: false,
  allowSkinScoreUpsert: true,
  allowQualityScoreUpsert: true,
  allowCandidateAutoChecks: true,
  allowOfferCandidateInsert: true,
  allowVerifiedOfferUpsert: true,
  allowOfferFreshnessUpdate: true,
  allowOfferChangeCandidate: true,
  allowOfferReviewQueue: true,
  allowMarketplaceOfficialStore: true,
  allowMarketplaceSeller: false,
  allowUnverifiedPurchaseRecommendation: false,
  allowProductAutoVerify: true,
  allowProductAutoActivate: true,
  allowProductReevaluation: true,
  allowAutoApproveOfficialIngredients: true,
  allowProductVerifyReviewQueue: true,
  allowProductDemotion: false,
  maxNewProductsPerRun: 20,
  maxNewIngredientsPerRun: 5,
  maxOffersPerRun: 30,
  maxRetailersPerProduct: 5,
  maxProductVerificationsPerRun: 20,
  offerFreshnessHours: 48,
  officialOfferConfidenceThreshold: 0.8,
  authorizedRetailerThreshold: 0.75,
  ingredientMatchThreshold: 0.85,
  draftProductQualityThreshold: 0.65,
  productVerifyQualityGrades: ["A", "B"],
  shippingCountriesPriority: ["KR", "US", "JP"],
  allowProductInsert: false,
  allowOfferInsert: false,
  allowVerifiedOfferInsert: false,
  allowPublish: false,
  allowDelete: false,
  allowIngredientWrite: false,
  allowExistingCandidateBulkUpdate: false,
  allowExistingProductOverwrite: false,
  allowBulkStatusRewrite: false,
  monitoring: { ...DEFAULT_MONITORING_CONFIG },
};

function projectRoot(): string {
  return process.cwd();
}

export function pipelineOperationConfigPath(): string {
  return join(projectRoot(), "config", "pipeline-operation.json");
}

export function pipelineOperationOverridesPath(): string {
  return join(projectRoot(), "data", "pipeline", "operation-overrides.json");
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asNum(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function parseMonitoring(raw: unknown): MonitoringConfig {
  const d = DEFAULT_MONITORING_CONFIG;
  if (!raw || typeof raw !== "object") return { ...d };
  const m = raw as Record<string, unknown>;
  return {
    enabled: asBool(m.enabled, d.enabled),
    healthCheckIntervalMinutes: asNum(
      m.healthCheckIntervalMinutes,
      d.healthCheckIntervalMinutes
    ),
    noRecentRunMinutes: asNum(m.noRecentRunMinutes, d.noRecentRunMinutes),
    staleHeartbeatMinutes: asNum(
      m.staleHeartbeatMinutes,
      d.staleHeartbeatMinutes
    ),
    stuckJobMinutes: asNum(m.stuckJobMinutes, d.stuckJobMinutes),
    retryBacklogWarning: asNum(m.retryBacklogWarning, d.retryBacklogWarning),
    retryBacklogCritical: asNum(m.retryBacklogCritical, d.retryBacklogCritical),
    batchFailureRateWarning: asNum(
      m.batchFailureRateWarning,
      d.batchFailureRateWarning
    ),
    batchFailureRateCritical: asNum(
      m.batchFailureRateCritical,
      d.batchFailureRateCritical
    ),
    reviewBacklogWarning: asNum(m.reviewBacklogWarning, d.reviewBacklogWarning),
    reviewBacklogCritical: asNum(
      m.reviewBacklogCritical,
      d.reviewBacklogCritical
    ),
    reviewAgeWarningHours: asNum(
      m.reviewAgeWarningHours,
      d.reviewAgeWarningHours
    ),
    reviewAgeCriticalHours: asNum(
      m.reviewAgeCriticalHours,
      d.reviewAgeCriticalHours
    ),
    recommendationEligibleMinimum: asNum(
      m.recommendationEligibleMinimum,
      d.recommendationEligibleMinimum
    ),
    verifiedOfferMinimum: asNum(m.verifiedOfferMinimum, d.verifiedOfferMinimum),
    ingredientMatchMinimum: asNum(
      m.ingredientMatchMinimum,
      d.ingredientMatchMinimum
    ),
    officialSiteResolutionMinimum: asNum(
      m.officialSiteResolutionMinimum,
      d.officialSiteResolutionMinimum
    ),
    shippingCoverageMinimum: asNum(
      m.shippingCoverageMinimum,
      d.shippingCoverageMinimum
    ),
    alertCooldownMinutes: asNum(m.alertCooldownMinutes, d.alertCooldownMinutes),
    autoRecoveryEnabled: asBool(m.autoRecoveryEnabled, d.autoRecoveryEnabled),
  };
}

export function validatePipelineOperationConfig(
  raw: unknown
): { ok: true; config: PipelineOperationConfig } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: ["config must be an object"] };
  }
  const o = raw as Record<string, unknown>;
  const mode = o.mode;
  if (mode !== "dry_run" && mode !== "gated_commit") {
    errors.push("mode must be dry_run or gated_commit");
  }

  const num = (k: string, min: number, max: number) => {
    const v = o[k];
    if (v === undefined) return;
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) {
      errors.push(`${k} must be number ${min}..${max}`);
    }
  };
  num("brandsPerRun", 1, 50);
  num("productsPerBrand", 1, 200);
  num("tickLimit", 1, 50);
  num("maxTicks", 1, 500);
  num("maxNewProductsPerRun", 0, 200);
  num("maxNewIngredientsPerRun", 0, 100);
  num("maxOffersPerRun", 0, 200);
  num("maxRetailersPerProduct", 1, 20);
  num("maxProductVerificationsPerRun", 0, 200);
  num("offerFreshnessHours", 1, 720);
  num("officialOfferConfidenceThreshold", 0.5, 1);
  num("authorizedRetailerThreshold", 0.5, 1);
  num("ingredientMatchThreshold", 0.5, 1);
  num("draftProductQualityThreshold", 0.3, 1);

  for (const k of HARD_FALSE_KEYS) {
    if (o[k] === true) {
      errors.push(`${k} must remain false (hard policy)`);
    }
  }

  if (o.paused !== undefined && typeof o.paused !== "boolean") {
    errors.push("paused must be boolean");
  }

  if (errors.length) return { ok: false, errors };

  const d = DEFAULT_PIPELINE_OPERATION;
  const config: PipelineOperationConfig = {
    ...d,
    version: asNum(o.version, d.version),
    mode: (mode as PipelineOperationMode) ?? d.mode,
    paused: asBool(o.paused, d.paused),
    scheduleHint:
      typeof o.scheduleHint === "string" ? o.scheduleHint : d.scheduleHint,
    brandsPerRun: asNum(o.brandsPerRun, d.brandsPerRun),
    productsPerBrand: asNum(o.productsPerBrand, d.productsPerBrand),
    tickLimit: asNum(o.tickLimit, d.tickLimit),
    maxTicks: asNum(o.maxTicks, d.maxTicks),
    allowCandidateInsert: asBool(o.allowCandidateInsert, d.allowCandidateInsert),
    allowQueueInsert: asBool(o.allowQueueInsert, d.allowQueueInsert),
    allowAuditInsert: asBool(o.allowAuditInsert, d.allowAuditInsert),
    allowDraftProductInsert: asBool(
      o.allowDraftProductInsert,
      d.allowDraftProductInsert
    ),
    allowVariantInsert: asBool(o.allowVariantInsert, d.allowVariantInsert),
    allowProductIngredientInsert: asBool(
      o.allowProductIngredientInsert,
      d.allowProductIngredientInsert
    ),
    allowUnverifiedIngredientInsert: asBool(
      o.allowUnverifiedIngredientInsert,
      d.allowUnverifiedIngredientInsert
    ),
    allowSkinScoreUpsert: asBool(o.allowSkinScoreUpsert, d.allowSkinScoreUpsert),
    allowQualityScoreUpsert: asBool(
      o.allowQualityScoreUpsert,
      d.allowQualityScoreUpsert
    ),
    allowCandidateAutoChecks: asBool(
      o.allowCandidateAutoChecks,
      d.allowCandidateAutoChecks
    ),
    allowOfferCandidateInsert: asBool(
      o.allowOfferCandidateInsert,
      d.allowOfferCandidateInsert
    ),
    allowVerifiedOfferUpsert: asBool(
      o.allowVerifiedOfferUpsert,
      d.allowVerifiedOfferUpsert
    ),
    allowOfferFreshnessUpdate: asBool(
      o.allowOfferFreshnessUpdate,
      d.allowOfferFreshnessUpdate
    ),
    allowOfferChangeCandidate: asBool(
      o.allowOfferChangeCandidate,
      d.allowOfferChangeCandidate
    ),
    allowOfferReviewQueue: asBool(
      o.allowOfferReviewQueue,
      d.allowOfferReviewQueue
    ),
    allowMarketplaceOfficialStore: asBool(
      o.allowMarketplaceOfficialStore,
      d.allowMarketplaceOfficialStore
    ),
    allowMarketplaceSeller: false,
    allowUnverifiedPurchaseRecommendation: false,
    allowProductAutoVerify: asBool(
      o.allowProductAutoVerify,
      d.allowProductAutoVerify
    ),
    allowProductAutoActivate: asBool(
      o.allowProductAutoActivate,
      d.allowProductAutoActivate
    ),
    allowProductReevaluation: asBool(
      o.allowProductReevaluation,
      d.allowProductReevaluation
    ),
    allowAutoApproveOfficialIngredients: asBool(
      o.allowAutoApproveOfficialIngredients,
      d.allowAutoApproveOfficialIngredients
    ),
    allowProductVerifyReviewQueue: asBool(
      o.allowProductVerifyReviewQueue,
      d.allowProductVerifyReviewQueue
    ),
    allowProductDemotion: false,
    maxNewProductsPerRun: asNum(o.maxNewProductsPerRun, d.maxNewProductsPerRun),
    maxNewIngredientsPerRun: asNum(
      o.maxNewIngredientsPerRun,
      d.maxNewIngredientsPerRun
    ),
    maxOffersPerRun: asNum(o.maxOffersPerRun, d.maxOffersPerRun),
    maxRetailersPerProduct: asNum(
      o.maxRetailersPerProduct,
      d.maxRetailersPerProduct
    ),
    maxProductVerificationsPerRun: asNum(
      o.maxProductVerificationsPerRun,
      d.maxProductVerificationsPerRun
    ),
    offerFreshnessHours: asNum(o.offerFreshnessHours, d.offerFreshnessHours),
    officialOfferConfidenceThreshold: asNum(
      o.officialOfferConfidenceThreshold,
      d.officialOfferConfidenceThreshold
    ),
    authorizedRetailerThreshold: asNum(
      o.authorizedRetailerThreshold,
      d.authorizedRetailerThreshold
    ),
    ingredientMatchThreshold: asNum(
      o.ingredientMatchThreshold,
      d.ingredientMatchThreshold
    ),
    draftProductQualityThreshold: asNum(
      o.draftProductQualityThreshold,
      d.draftProductQualityThreshold
    ),
    productVerifyQualityGrades: Array.isArray(o.productVerifyQualityGrades)
      ? (o.productVerifyQualityGrades as unknown[]).filter(
          (x): x is string => typeof x === "string"
        )
      : d.productVerifyQualityGrades,
    shippingCountriesPriority: Array.isArray(o.shippingCountriesPriority)
      ? (o.shippingCountriesPriority as unknown[]).filter(
          (x): x is string => typeof x === "string"
        )
      : d.shippingCountriesPriority,
    allowProductInsert: false,
    allowOfferInsert: false,
    allowVerifiedOfferInsert: false,
    allowPublish: false,
    allowDelete: false,
    allowIngredientWrite: false,
    allowExistingCandidateBulkUpdate: false,
    allowExistingProductOverwrite: false,
    allowBulkStatusRewrite: false,
    monitoring: parseMonitoring(o.monitoring),
    notes: Array.isArray(o.notes)
      ? o.notes.filter((n): n is string => typeof n === "string")
      : d.notes,
  };

  return { ok: true, config };
}

function readJsonFile(path: string): unknown | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return null;
  }
}

export function loadPipelineOperationConfig(): PipelineOperationConfig {
  const baseRaw =
    readJsonFile(pipelineOperationConfigPath()) ?? DEFAULT_PIPELINE_OPERATION;
  const base = validatePipelineOperationConfig(baseRaw);
  if (!base.ok) {
    throw new Error(`Invalid pipeline-operation.json: ${base.errors.join("; ")}`);
  }

  const overrideRaw = readJsonFile(pipelineOperationOverridesPath());
  if (!overrideRaw) return base.config;

  const merged = {
    ...base.config,
    ...(typeof overrideRaw === "object" && overrideRaw
      ? (overrideRaw as Record<string, unknown>)
      : {}),
  };
  const validated = validatePipelineOperationConfig(merged);
  if (!validated.ok) {
    throw new Error(
      `Invalid operation-overrides.json: ${validated.errors.join("; ")}`
    );
  }
  return validated.config;
}

export type PipelineOperationAdminPatch = {
  mode?: PipelineOperationMode;
  paused?: boolean;
  brandsPerRun?: number;
  productsPerBrand?: number;
  allowCandidateInsert?: boolean;
  allowQueueInsert?: boolean;
  allowAuditInsert?: boolean;
  allowDraftProductInsert?: boolean;
  allowVariantInsert?: boolean;
  allowProductIngredientInsert?: boolean;
  allowSkinScoreUpsert?: boolean;
  allowQualityScoreUpsert?: boolean;
  allowCandidateAutoChecks?: boolean;
  allowOfferCandidateInsert?: boolean;
  allowVerifiedOfferUpsert?: boolean;
  allowOfferFreshnessUpdate?: boolean;
  allowOfferReviewQueue?: boolean;
  allowProductAutoVerify?: boolean;
  allowProductAutoActivate?: boolean;
  allowProductReevaluation?: boolean;
  monitoring?: Partial<MonitoringConfig>;
  scheduleHint?: string;
};

export function savePipelineOperationOverrides(
  patch: PipelineOperationAdminPatch
): PipelineOperationConfig {
  const current = loadPipelineOperationConfig();
  const nextRaw = {
    ...current,
    ...patch,
    monitoring: parseMonitoring({
      ...current.monitoring,
      ...(patch.monitoring ?? {}),
    }),
    allowProductInsert: false,
    allowOfferInsert: false,
    allowVerifiedOfferInsert: false,
    allowPublish: false,
    allowDelete: false,
    allowIngredientWrite: false,
    allowExistingCandidateBulkUpdate: false,
    allowExistingProductOverwrite: false,
    allowBulkStatusRewrite: false,
    allowUnverifiedIngredientInsert: false,
    allowMarketplaceSeller: false,
    allowUnverifiedPurchaseRecommendation: false,
    allowProductDemotion: false,
    updatedAt: new Date().toISOString(),
  };
  const validated = validatePipelineOperationConfig(nextRaw);
  if (!validated.ok) {
    throw new Error(validated.errors.join("; "));
  }

  const dir = join(projectRoot(), "data", "pipeline");
  mkdirSync(dir, { recursive: true });
  const c = validated.config;
  writeFileSync(
    pipelineOperationOverridesPath(),
    JSON.stringify(
      {
        mode: c.mode,
        paused: c.paused,
        brandsPerRun: c.brandsPerRun,
        productsPerBrand: c.productsPerBrand,
        tickLimit: c.tickLimit,
        maxTicks: c.maxTicks,
        allowCandidateInsert: c.allowCandidateInsert,
        allowQueueInsert: c.allowQueueInsert,
        allowAuditInsert: c.allowAuditInsert,
        allowDraftProductInsert: c.allowDraftProductInsert,
        allowVariantInsert: c.allowVariantInsert,
        allowProductIngredientInsert: c.allowProductIngredientInsert,
        allowSkinScoreUpsert: c.allowSkinScoreUpsert,
        allowQualityScoreUpsert: c.allowQualityScoreUpsert,
        allowCandidateAutoChecks: c.allowCandidateAutoChecks,
        allowOfferCandidateInsert: c.allowOfferCandidateInsert,
        allowVerifiedOfferUpsert: c.allowVerifiedOfferUpsert,
        allowOfferFreshnessUpdate: c.allowOfferFreshnessUpdate,
        allowOfferReviewQueue: c.allowOfferReviewQueue,
        allowProductAutoVerify: c.allowProductAutoVerify,
        allowProductAutoActivate: c.allowProductAutoActivate,
        allowProductReevaluation: c.allowProductReevaluation,
        scheduleHint: c.scheduleHint,
        maxNewProductsPerRun: c.maxNewProductsPerRun,
        maxOffersPerRun: c.maxOffersPerRun,
        maxProductVerificationsPerRun: c.maxProductVerificationsPerRun,
        offerFreshnessHours: c.offerFreshnessHours,
        ingredientMatchThreshold: c.ingredientMatchThreshold,
        draftProductQualityThreshold: c.draftProductQualityThreshold,
        productVerifyQualityGrades: c.productVerifyQualityGrades,
        monitoring: c.monitoring,
        allowMarketplaceSeller: false,
        allowUnverifiedPurchaseRecommendation: false,
        allowProductDemotion: false,
        allowProductInsert: false,
        allowOfferInsert: false,
        allowVerifiedOfferInsert: false,
        allowPublish: false,
        allowDelete: false,
        allowExistingProductOverwrite: false,
        allowBulkStatusRewrite: false,
        allowUnverifiedIngredientInsert: false,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf8"
  );
  return validated.config;
}

export function assertHardWritePolicy(config: PipelineOperationConfig): void {
  for (const k of HARD_FALSE_KEYS) {
    if (config[k] === true) {
      throw new Error(`Hard policy violation: ${k} must be false`);
    }
  }
}
