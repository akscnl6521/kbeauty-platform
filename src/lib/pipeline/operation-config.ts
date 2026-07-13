/**
 * Fixed pipeline operation config (file-based).
 * Scheduler/worker read this — CLI must not override ops limits or secrets.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

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
  maxNewProductsPerRun: number;
  maxNewIngredientsPerRun: number;
  ingredientMatchThreshold: number;
  draftProductQualityThreshold: number;
  /** Hard false: never insert "live" catalog products (use draft flag instead). */
  allowProductInsert: boolean;
  allowOfferInsert: boolean;
  allowVerifiedOfferInsert: boolean;
  allowPublish: boolean;
  allowDelete: boolean;
  allowIngredientWrite: boolean;
  allowExistingCandidateBulkUpdate: boolean;
  allowExistingProductOverwrite: boolean;
  allowBulkStatusRewrite: boolean;
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
] as const;

export const DEFAULT_PIPELINE_OPERATION: PipelineOperationConfig = {
  version: 2,
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
  maxNewProductsPerRun: 20,
  maxNewIngredientsPerRun: 5,
  ingredientMatchThreshold: 0.85,
  draftProductQualityThreshold: 0.65,
  allowProductInsert: false,
  allowOfferInsert: false,
  allowVerifiedOfferInsert: false,
  allowPublish: false,
  allowDelete: false,
  allowIngredientWrite: false,
  allowExistingCandidateBulkUpdate: false,
  allowExistingProductOverwrite: false,
  allowBulkStatusRewrite: false,
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
    maxNewProductsPerRun: asNum(o.maxNewProductsPerRun, d.maxNewProductsPerRun),
    maxNewIngredientsPerRun: asNum(
      o.maxNewIngredientsPerRun,
      d.maxNewIngredientsPerRun
    ),
    ingredientMatchThreshold: asNum(
      o.ingredientMatchThreshold,
      d.ingredientMatchThreshold
    ),
    draftProductQualityThreshold: asNum(
      o.draftProductQualityThreshold,
      d.draftProductQualityThreshold
    ),
    allowProductInsert: false,
    allowOfferInsert: false,
    allowVerifiedOfferInsert: false,
    allowPublish: false,
    allowDelete: false,
    allowIngredientWrite: false,
    allowExistingCandidateBulkUpdate: false,
    allowExistingProductOverwrite: false,
    allowBulkStatusRewrite: false,
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
  scheduleHint?: string;
};

export function savePipelineOperationOverrides(
  patch: PipelineOperationAdminPatch
): PipelineOperationConfig {
  const current = loadPipelineOperationConfig();
  const nextRaw = {
    ...current,
    ...patch,
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
        scheduleHint: c.scheduleHint,
        maxNewProductsPerRun: c.maxNewProductsPerRun,
        ingredientMatchThreshold: c.ingredientMatchThreshold,
        draftProductQualityThreshold: c.draftProductQualityThreshold,
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
