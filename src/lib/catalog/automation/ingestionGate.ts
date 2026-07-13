/**
 * Real catalog ingestion gates.
 * Blocks promotion of fixtures and blocks live ingest on shared Production DB.
 */

export type CatalogEnvironmentAssessment = {
  projectRefMasked: string;
  previewProductionSameDb: boolean;
  realIngestionAllowed: boolean;
  reason: string;
  requiredNextStep: string;
};

/**
 * Single known operational project (docs + local + MCP).
 * Until a dedicated staging project exists, treat as shared Production DB.
 */
export const KNOWN_SHARED_SUPABASE_REF = "rhfrmvkjsummaylpzmns";

export function maskProjectRef(ref: string): string {
  const r = ref.trim();
  if (r.length <= 8) return `${r.slice(0, 2)}***`;
  return `${r.slice(0, 4)}***${r.slice(-3)}`;
}

export function assessCatalogEnvironment(input: {
  projectRef: string | null | undefined;
  explicitStagingProject?: boolean;
}): CatalogEnvironmentAssessment {
  const ref = String(input.projectRef ?? "").trim();
  const masked = ref ? maskProjectRef(ref) : "missing";

  if (!ref) {
    return {
      projectRefMasked: masked,
      previewProductionSameDb: true,
      realIngestionAllowed: false,
      reason: "Supabase project ref unavailable",
      requiredNextStep: "Configure Preview-only staging Supabase project",
    };
  }

  if (input.explicitStagingProject === true) {
    return {
      projectRefMasked: masked,
      previewProductionSameDb: false,
      realIngestionAllowed: true,
      reason: "Explicit staging project flag set",
      requiredNextStep: "Proceed with permission-reviewed official sources only",
    };
  }

  // Current workspace uses one documented project for local/Preview/ops.
  if (ref === KNOWN_SHARED_SUPABASE_REF) {
    return {
      projectRefMasked: masked,
      previewProductionSameDb: true,
      realIngestionAllowed: false,
      reason:
        "Preview and Production point at the same shared Supabase project; bulk real staging insert is blocked",
      requiredNextStep:
        "Create a dedicated staging Supabase project for Preview catalog ingestion",
    };
  }

  return {
    projectRefMasked: masked,
    previewProductionSameDb: false,
    realIngestionAllowed: false,
    reason: "Unknown project — require explicit staging confirmation",
    requiredNextStep: "Confirm project is Preview-only staging before ingest",
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

/** Fixtures must never be promoted to products / product_offers. */
export function canPromoteStagingProduct(row: {
  is_fixture?: boolean | null;
  test_only?: boolean | null;
  product_status?: string | null;
}): { ok: false; reason: string } | { ok: true } {
  if (isFixtureStagingRow(row)) {
    return { ok: false, reason: "fixture_or_test_only" };
  }
  if (row.product_status === "rejected" || row.product_status === "duplicate_candidate") {
    return { ok: false, reason: "status_not_promotable" };
  }
  return { ok: true };
}

export function countRealStagingProducts<T extends { is_fixture?: boolean | null }>(
  rows: T[]
): { total: number; fixture: number; real: number } {
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
