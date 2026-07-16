/**
 * Catalog environment separation & ingestion execution gates.
 * Never prints secrets. Blocks shared Production DB ingest/migration.
 */

export type CatalogBlockedResult = {
  status: "blocked";
  code: "STAGING_DATABASE_REQUIRED" | "PRODUCTION_ENV" | "INGESTION_DISABLED" | "DRY_RUN_REQUIRED" | "MISSING_CONFIG";
  message: string;
};

export type CatalogAllowedResult = {
  status: "allowed";
  code: "STAGING_READY";
  message: string;
  dryRun: boolean;
  autoPromote: false;
};

export type CatalogEnvironmentAssessment = {
  projectRefMasked: string;
  previewProductionSameDb: boolean;
  realIngestionAllowed: boolean;
  reason: string;
  requiredNextStep: string;
  appEnv: string | null;
  catalogDatabaseEnv: string | null;
  ingestionEnabled: boolean;
  dryRun: boolean;
};

/** Documented shared operational project (Preview/Production currently identical). */
export const KNOWN_PRODUCTION_SUPABASE_REF = "rhfrmvkjsummaylpzmns";
/** @deprecated alias — prefer KNOWN_PRODUCTION_SUPABASE_REF */
export const KNOWN_SHARED_SUPABASE_REF = KNOWN_PRODUCTION_SUPABASE_REF;

export function maskProjectRef(ref: string): string {
  const r = ref.trim();
  if (!r) return "missing";
  if (r.length <= 8) return `${r.slice(0, 2)}***`;
  return `${r.slice(0, 4)}***${r.slice(-3)}`;
}

export function extractProjectRefFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const host = new URL(url.trim()).hostname;
    const ref = host.split(".")[0] ?? "";
    return ref || null;
  } catch {
    return null;
  }
}

export type CatalogEnvSnapshot = {
  appEnv: string | null;
  catalogDatabaseEnv: string | null;
  projectRef: string | null;
  productionProjectRef: string;
  ingestionEnabled: boolean;
  cronEnabled: boolean;
  dryRun: boolean;
  autoPromote: boolean;
  maxProductsPerSource: number;
};

/** Env bag for gates — accepts ProcessEnv or test fixtures (no secrets logged). */
export type CatalogEnvBag = Record<string, string | undefined>;

export function readCatalogEnvSnapshot(
  env: CatalogEnvBag = process.env
): CatalogEnvSnapshot {
  const projectRef =
    env.SUPABASE_PROJECT_REF?.trim() ||
    extractProjectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL) ||
    null;

  return {
    appEnv: env.APP_ENV?.trim().toLowerCase() || null,
    catalogDatabaseEnv: env.CATALOG_DATABASE_ENV?.trim().toLowerCase() || null,
    projectRef,
    productionProjectRef:
      env.PRODUCTION_SUPABASE_PROJECT_REF?.trim() || KNOWN_PRODUCTION_SUPABASE_REF,
    ingestionEnabled: env.CATALOG_INGESTION_ENABLED === "true",
    cronEnabled: env.CATALOG_CRON_ENABLED === "true",
    dryRun: env.CATALOG_DRY_RUN !== "false",
    autoPromote: env.CATALOG_AUTO_PROMOTE === "true",
    maxProductsPerSource: Number(env.CATALOG_MAX_PRODUCTS_PER_SOURCE ?? 20) || 20,
  };
}

export function assessCatalogEnvironment(input: {
  projectRef: string | null | undefined;
  explicitStagingProject?: boolean;
  appEnv?: string | null;
  catalogDatabaseEnv?: string | null;
  ingestionEnabled?: boolean;
  dryRun?: boolean;
  productionProjectRef?: string;
}): CatalogEnvironmentAssessment {
  const snap = {
    appEnv: input.appEnv ?? null,
    catalogDatabaseEnv: input.catalogDatabaseEnv ?? null,
    ingestionEnabled: input.ingestionEnabled === true,
    dryRun: input.dryRun !== false,
  };
  const productionRef =
    input.productionProjectRef?.trim() || KNOWN_PRODUCTION_SUPABASE_REF;
  const ref = String(input.projectRef ?? "").trim();
  const masked = ref ? maskProjectRef(ref) : "missing";

  if (snap.appEnv === "production") {
    return {
      projectRefMasked: masked,
      previewProductionSameDb: ref === productionRef,
      realIngestionAllowed: false,
      reason: "APP_ENV=production blocks catalog ingestion",
      requiredNextStep: "Use Preview staging project only",
      appEnv: snap.appEnv,
      catalogDatabaseEnv: snap.catalogDatabaseEnv,
      ingestionEnabled: snap.ingestionEnabled,
      dryRun: snap.dryRun,
    };
  }

  if (!ref) {
    return {
      projectRefMasked: masked,
      previewProductionSameDb: true,
      realIngestionAllowed: false,
      reason: "Supabase project ref unavailable",
      requiredNextStep: "Configure Preview-only staging Supabase project",
      appEnv: snap.appEnv,
      catalogDatabaseEnv: snap.catalogDatabaseEnv,
      ingestionEnabled: snap.ingestionEnabled,
      dryRun: snap.dryRun,
    };
  }

  const sameAsProduction = ref === productionRef;
  if (sameAsProduction && input.explicitStagingProject !== true) {
    return {
      projectRefMasked: masked,
      previewProductionSameDb: true,
      realIngestionAllowed: false,
      reason:
        "Preview and Production Supabase projects are identical; bulk real staging insert is blocked",
      requiredNextStep:
        "Create kbeauty-match-staging and point Preview env to that project",
      appEnv: snap.appEnv,
      catalogDatabaseEnv: snap.catalogDatabaseEnv,
      ingestionEnabled: snap.ingestionEnabled,
      dryRun: snap.dryRun,
    };
  }

  if (snap.catalogDatabaseEnv !== "staging") {
    return {
      projectRefMasked: masked,
      previewProductionSameDb: sameAsProduction,
      realIngestionAllowed: false,
      reason: "CATALOG_DATABASE_ENV must be staging",
      requiredNextStep: "Set CATALOG_DATABASE_ENV=staging on Preview",
      appEnv: snap.appEnv,
      catalogDatabaseEnv: snap.catalogDatabaseEnv,
      ingestionEnabled: snap.ingestionEnabled,
      dryRun: snap.dryRun,
    };
  }

  if (!snap.ingestionEnabled) {
    return {
      projectRefMasked: masked,
      previewProductionSameDb: sameAsProduction,
      realIngestionAllowed: false,
      reason: "CATALOG_INGESTION_ENABLED is not true",
      requiredNextStep: "Enable CATALOG_INGESTION_ENABLED=true on staging only",
      appEnv: snap.appEnv,
      catalogDatabaseEnv: snap.catalogDatabaseEnv,
      ingestionEnabled: snap.ingestionEnabled,
      dryRun: snap.dryRun,
    };
  }

  if (!snap.dryRun) {
    return {
      projectRefMasked: masked,
      previewProductionSameDb: sameAsProduction,
      realIngestionAllowed: false,
      reason: "CATALOG_DRY_RUN must remain true for initial staging runs",
      requiredNextStep: "Keep CATALOG_DRY_RUN=true",
      appEnv: snap.appEnv,
      catalogDatabaseEnv: snap.catalogDatabaseEnv,
      ingestionEnabled: snap.ingestionEnabled,
      dryRun: snap.dryRun,
    };
  }

  return {
    projectRefMasked: masked,
    previewProductionSameDb: false,
    realIngestionAllowed: true,
    reason: "Staging database gates passed",
    requiredNextStep: "Run dry-run against staging only",
    appEnv: snap.appEnv,
    catalogDatabaseEnv: snap.catalogDatabaseEnv,
    ingestionEnabled: snap.ingestionEnabled,
    dryRun: snap.dryRun,
  };
}

/** Pre-crawl / pre-insert / pre-migration gate. */
export function assertCatalogIngestionAllowed(
  env: CatalogEnvBag = process.env
): CatalogAllowedResult | CatalogBlockedResult {
  const snap = readCatalogEnvSnapshot(env);

  if (snap.appEnv === "production") {
    return {
      status: "blocked",
      code: "PRODUCTION_ENV",
      message: "Catalog ingestion is blocked when APP_ENV=production.",
    };
  }

  if (!snap.projectRef) {
    return {
      status: "blocked",
      code: "MISSING_CONFIG",
      message: "SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL is required.",
    };
  }

  if (snap.projectRef === snap.productionProjectRef) {
    return {
      status: "blocked",
      code: "STAGING_DATABASE_REQUIRED",
      message: "Preview and Production Supabase projects are identical.",
    };
  }

  if (snap.catalogDatabaseEnv !== "staging") {
    return {
      status: "blocked",
      code: "STAGING_DATABASE_REQUIRED",
      message: "CATALOG_DATABASE_ENV must be staging.",
    };
  }

  if (!snap.ingestionEnabled) {
    return {
      status: "blocked",
      code: "INGESTION_DISABLED",
      message: "CATALOG_INGESTION_ENABLED must be true.",
    };
  }

  if (!snap.dryRun) {
    return {
      status: "blocked",
      code: "DRY_RUN_REQUIRED",
      message: "CATALOG_DRY_RUN must be true for staging ingestion.",
    };
  }

  if (snap.autoPromote) {
    return {
      status: "blocked",
      code: "INGESTION_DISABLED",
      message: "CATALOG_AUTO_PROMOTE must remain false.",
    };
  }

  return {
    status: "allowed",
    code: "STAGING_READY",
    message: "Staging dry-run ingestion is allowed.",
    dryRun: true,
    autoPromote: false,
  };
}

/** Migration apply gate — never against production/shared ref. */
export function assertCatalogMigrationAllowed(
  env: CatalogEnvBag = process.env
): CatalogAllowedResult | CatalogBlockedResult {
  const snap = readCatalogEnvSnapshot(env);
  if (snap.appEnv === "production") {
    return {
      status: "blocked",
      code: "PRODUCTION_ENV",
      message: "Migrations must not target APP_ENV=production from catalog tooling.",
    };
  }
  if (!snap.projectRef || snap.projectRef === snap.productionProjectRef) {
    return {
      status: "blocked",
      code: "STAGING_DATABASE_REQUIRED",
      message: "Preview and Production Supabase projects are identical.",
    };
  }
  if (snap.catalogDatabaseEnv !== "staging") {
    return {
      status: "blocked",
      code: "STAGING_DATABASE_REQUIRED",
      message: "CATALOG_DATABASE_ENV must be staging before applying catalog migrations.",
    };
  }
  return {
    status: "allowed",
    code: "STAGING_READY",
    message: "Catalog migrations may be applied to staging only.",
    dryRun: true,
    autoPromote: false,
  };
}

export function isFixtureStagingRow(row: {
  is_fixture?: boolean | null;
  test_only?: boolean | null;
  source_type?: string | null;
}): boolean {
  if (row.is_fixture === true || row.test_only === true) return true;
  const st = String(row.source_type ?? "").toLowerCase();
  return st === "fixture" || st === "manual" || st === "test";
}

export function canPromoteStagingProduct(row: {
  is_fixture?: boolean | null;
  test_only?: boolean | null;
  product_status?: string | null;
}): { ok: false; reason: string } | { ok: true } {
  if (isFixtureStagingRow(row)) {
    return { ok: false, reason: "fixture_or_test_only" };
  }
  if (
    row.product_status === "rejected" ||
    row.product_status === "duplicate_candidate"
  ) {
    return { ok: false, reason: "status_not_promotable" };
  }
  return { ok: true };
}

export function countRealStagingProducts<
  T extends { is_fixture?: boolean | null },
>(rows: T[]): { total: number; fixture: number; real: number } {
  let fixture = 0;
  for (const r of rows) {
    if (isFixtureStagingRow(r)) fixture += 1;
  }
  return {
    total: rows.length,
    fixture,
    real: rows.length - fixture,
  };
}
