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
  allowProductInsert: boolean;
  allowOfferInsert: boolean;
  allowPublish: boolean;
  allowDelete: boolean;
  allowIngredientWrite: boolean;
  allowExistingCandidateBulkUpdate: boolean;
  notes?: string[];
};

const HARD_FALSE_KEYS = [
  "allowProductInsert",
  "allowOfferInsert",
  "allowPublish",
  "allowDelete",
  "allowIngredientWrite",
  "allowExistingCandidateBulkUpdate",
] as const;

export const DEFAULT_PIPELINE_OPERATION: PipelineOperationConfig = {
  version: 1,
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
  allowProductInsert: false,
  allowOfferInsert: false,
  allowPublish: false,
  allowDelete: false,
  allowIngredientWrite: false,
  allowExistingCandidateBulkUpdate: false,
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
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) {
      errors.push(`${k} must be number ${min}..${max}`);
    }
  };
  num("brandsPerRun", 1, 50);
  num("productsPerBrand", 1, 200);
  num("tickLimit", 1, 50);
  num("maxTicks", 1, 500);

  for (const k of HARD_FALSE_KEYS) {
    if (o[k] === true) {
      errors.push(`${k} must remain false (hard policy)`);
    }
  }

  if (typeof o.paused !== "boolean") errors.push("paused must be boolean");
  if (typeof o.allowCandidateInsert !== "boolean") {
    errors.push("allowCandidateInsert must be boolean");
  }
  if (typeof o.allowQueueInsert !== "boolean") {
    errors.push("allowQueueInsert must be boolean");
  }
  if (typeof o.allowAuditInsert !== "boolean") {
    errors.push("allowAuditInsert must be boolean");
  }

  if (errors.length) return { ok: false, errors };

  const config: PipelineOperationConfig = {
    ...DEFAULT_PIPELINE_OPERATION,
    version: typeof o.version === "number" ? o.version : 1,
    mode: mode as PipelineOperationMode,
    paused: Boolean(o.paused),
    scheduleHint:
      typeof o.scheduleHint === "string" ? o.scheduleHint : "every_6_hours",
    brandsPerRun: Number(o.brandsPerRun),
    productsPerBrand: Number(o.productsPerBrand),
    tickLimit: Number(o.tickLimit),
    maxTicks: Number(o.maxTicks),
    allowCandidateInsert: Boolean(o.allowCandidateInsert),
    allowQueueInsert: Boolean(o.allowQueueInsert),
    allowAuditInsert: Boolean(o.allowAuditInsert),
    // hard locks — never trust file true for these
    allowProductInsert: false,
    allowOfferInsert: false,
    allowPublish: false,
    allowDelete: false,
    allowIngredientWrite: false,
    allowExistingCandidateBulkUpdate: false,
    notes: Array.isArray(o.notes)
      ? o.notes.filter((n): n is string => typeof n === "string")
      : DEFAULT_PIPELINE_OPERATION.notes,
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

/**
 * Merge base config + optional local overrides (admin UI writes overrides).
 */
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
  scheduleHint?: string;
};

/**
 * Persist admin-tunable overrides only (hard policy keys ignored).
 */
export function savePipelineOperationOverrides(
  patch: PipelineOperationAdminPatch
): PipelineOperationConfig {
  const current = loadPipelineOperationConfig();
  const nextRaw = {
    ...current,
    ...patch,
    allowProductInsert: false,
    allowOfferInsert: false,
    allowPublish: false,
    allowDelete: false,
    allowIngredientWrite: false,
    allowExistingCandidateBulkUpdate: false,
    updatedAt: new Date().toISOString(),
  };
  const validated = validatePipelineOperationConfig(nextRaw);
  if (!validated.ok) {
    throw new Error(validated.errors.join("; "));
  }

  const dir = join(projectRoot(), "data", "pipeline");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    pipelineOperationOverridesPath(),
    JSON.stringify(
      {
        mode: validated.config.mode,
        paused: validated.config.paused,
        brandsPerRun: validated.config.brandsPerRun,
        productsPerBrand: validated.config.productsPerBrand,
        tickLimit: validated.config.tickLimit,
        maxTicks: validated.config.maxTicks,
        allowCandidateInsert: validated.config.allowCandidateInsert,
        allowQueueInsert: validated.config.allowQueueInsert,
        allowAuditInsert: validated.config.allowAuditInsert,
        scheduleHint: validated.config.scheduleHint,
        allowProductInsert: false,
        allowOfferInsert: false,
        allowPublish: false,
        allowDelete: false,
        allowIngredientWrite: false,
        allowExistingCandidateBulkUpdate: false,
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
