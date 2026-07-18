/**
 * Staging gate for verified-kbeauty-batch import.
 * Never writes DB. Never prints secrets.
 *
 * Usage: node scripts/check-verified-batch-staging-gate.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = "rhfrmvkjsummaylpzmns";
const STAGING = "jfnjufmldiqlgvgyugfd";

function loadEnvFile(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return null;
  const map = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    map[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return map;
}

function refFromUrl(url) {
  if (!url) return "";
  try {
    const host = new URL(url).hostname.toLowerCase();
    const m = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return m?.[1] ?? "";
  } catch {
    return "";
  }
}

const env =
  loadEnvFile(".env.staging") ||
  loadEnvFile(".env.local") ||
  loadEnvFile(".env") ||
  {};

const ref =
  (env.SUPABASE_PROJECT_REF || "").trim() ||
  refFromUrl(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "");
const hasService = Boolean((env.SUPABASE_SERVICE_ROLE_KEY || "").trim());
const isProd = ref === PROD;
const isStaging = ref === STAGING;
const allow = isStaging && !isProd && hasService;

const report = {
  ok: true,
  gate: allow
    ? "ALLOW_STAGING_WRITE"
    : isProd
      ? "BLOCK_PRODUCTION"
      : !hasService
        ? "BLOCK_NO_SERVICE_ROLE"
        : "BLOCK_NOT_STAGING_REF",
  db_write: allow ? "ALLOWED" : "SKIPPED",
  local_ref_present: Boolean(ref),
  is_production_ref: isProd,
  is_staging_ref: isStaging,
  has_service_role: hasService,
  expected_staging_ref: STAGING,
  required_env_names: [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ],
  note: allow
    ? "Safe to run Staging import preview/commit with needs_review only."
    : "Do not run import commit. Configure Staging env first.",
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
