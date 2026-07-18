/**
 * Staging gate for verified-kbeauty-batch import.
 * Loads ONLY `.env.staging` via shared loader (never `.env.local`).
 * Never writes DB. Never prints secrets.
 *
 * Usage: node scripts/check-verified-batch-staging-gate.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateStagingWriteGate,
  STAGING_ENV_FILE,
  STAGING_SUPABASE_REF,
} from "./load-env-staging.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { allow, gate, meta } = evaluateStagingWriteGate(root);

const report = {
  ok: true,
  gate,
  db_write: allow ? "ALLOWED" : "SKIPPED",
  env_file: STAGING_ENV_FILE,
  env_file_loaded: meta.loaded,
  falls_back_to_env_local: false,
  local_ref_present: Boolean(meta.ref),
  is_production_ref: meta.isProduction,
  is_staging_ref: meta.isStaging,
  has_service_role: meta.hasServiceRole,
  has_anon_key: meta.hasAnonKey,
  key_lengths: meta.lengths,
  expected_staging_ref: STAGING_SUPABASE_REF,
  required_env_names: [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ],
  note: allow
    ? "Safe to run Staging import preview (commit still manual)."
    : `Do not run import. Fill ${STAGING_ENV_FILE} with Staging keys only (never Production).`,
};

const out = path.join(root, "reports", "verified-batch-staging-gate.json");
const prev = fs.existsSync(out)
  ? JSON.parse(fs.readFileSync(out, "utf8"))
  : {};
fs.writeFileSync(
  out,
  JSON.stringify(
    {
      ...prev,
      ...report,
      checked_at: new Date().toISOString(),
      bundle: "imports/verified-kbeauty-batch",
      auto_verified: false,
      import_preview: allow ? "READY_TO_RUN" : "NOT_RUN",
      import_commit: "NOT_RUN",
    },
    null,
    2
  ) + "\n"
);

console.log(JSON.stringify(report, null, 2));
process.exit(allow ? 0 : 2);
