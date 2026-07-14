/**
 * Hard gate: never write product catalog data to Production Supabase.
 */
import {
  extractProjectRefFromUrl,
  KNOWN_PRODUCTION_SUPABASE_REF,
} from "@/lib/catalog/automation/ingestionGate";

export type StagingWriteGate =
  | { ok: true; projectRefMasked: string }
  | { ok: false; code: string; message: string };

function mask(ref: string): string {
  if (!ref) return "missing";
  if (ref.length <= 8) return `${ref.slice(0, 2)}***`;
  return `${ref.slice(0, 4)}***${ref.slice(-3)}`;
}

export function assertStagingCatalogWriteAllowed(
  env: NodeJS.ProcessEnv = process.env
): StagingWriteGate {
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const ref =
    env.SUPABASE_PROJECT_REF?.trim() ||
    extractProjectRefFromUrl(url) ||
    "";
  const productionRef =
    env.PRODUCTION_SUPABASE_PROJECT_REF?.trim() ||
    KNOWN_PRODUCTION_SUPABASE_REF;

  if (!ref) {
    return {
      ok: false,
      code: "MISSING_PROJECT_REF",
      message: "Supabase project ref is required for catalog writes.",
    };
  }
  if (ref === productionRef) {
    return {
      ok: false,
      code: "PRODUCTION_WRITE_BLOCKED",
      message:
        "Catalog product registration is blocked on the Production Supabase project.",
    };
  }
  if ((env.APP_ENV ?? "").toLowerCase() === "production") {
    return {
      ok: false,
      code: "PRODUCTION_ENV_BLOCKED",
      message: "Catalog product registration is blocked when APP_ENV=production.",
    };
  }
  const catalogDb = (env.CATALOG_DATABASE_ENV ?? "").toLowerCase();
  if (catalogDb && catalogDb !== "staging") {
    return {
      ok: false,
      code: "CATALOG_DATABASE_NOT_STAGING",
      message: "CATALOG_DATABASE_ENV must be staging for product registration.",
    };
  }

  return { ok: true, projectRefMasked: mask(ref) };
}
