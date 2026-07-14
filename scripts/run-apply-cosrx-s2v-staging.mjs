#!/usr/bin/env node
/**
 * Staging-only: ensure minimum SELECT/INSERT(/UPDATE) grants (no DELETE),
 * then apply COSRX Search-to-Verified case once and exit.
 * Aborts on Production. Never prints secrets.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = "rhfrmvkjsummaylpzmns";
const EXPECTED = "jfnjufmldiqlgvgyugfd";
const GRANT_SQL = path.join(
  root,
  "supabase/migrations/20260714060000_grant_service_role_s2v_case_apply.sql"
);

function mask(ref) {
  if (!ref) return "missing";
  if (ref.length <= 8) return `${ref.slice(0, 2)}***`;
  return `${ref.slice(0, 4)}***${ref.slice(-3)}`;
}

function npx() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function extractJson(raw) {
  const startArr = raw.indexOf("[");
  const startObj = raw.indexOf("{");
  let start = -1;
  if (startArr >= 0 && startObj >= 0) start = Math.min(startArr, startObj);
  else start = Math.max(startArr, startObj);
  if (start < 0) return null;
  const slice = raw.slice(start).trim();
  try {
    return JSON.parse(slice);
  } catch {
    const end = Math.max(slice.lastIndexOf("]"), slice.lastIndexOf("}"));
    if (end > 0) {
      try {
        return JSON.parse(slice.slice(0, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function dbFile(sqlText) {
  const f = path.join(tmpdir(), `kb-s2v-${process.pid}-${Date.now()}.sql`);
  writeFileSync(f, sqlText.trim() + "\n", "utf8");
  try {
    const r = spawnSync(
      npx(),
      ["supabase", "db", "query", "--linked", "--file", f],
      {
        cwd: root,
        encoding: "utf8",
        shell: true,
        env: { ...process.env, npm_config_loglevel: "silent" },
      }
    );
    if (r.status !== 0) {
      throw new Error(`db_query_failed status=${r.status} ${(r.stderr || "").slice(0, 200)}`);
    }
    return (r.stdout || "").trim();
  } finally {
    try {
      unlinkSync(f);
    } catch {
      /* ignore */
    }
  }
}

function getStagingServiceRole(ref) {
  if (ref === PROD) throw new Error("ABORT Production");
  const r = spawnSync(
    npx(),
    [
      "supabase",
      "projects",
      "api-keys",
      "--project-ref",
      ref,
      "--reveal",
      "-o",
      "json",
    ],
    {
      cwd: root,
      encoding: "utf8",
      shell: true,
      env: { ...process.env, npm_config_loglevel: "silent" },
    }
  );
  const keys = extractJson((r.stdout || "").trim());
  if (!Array.isArray(keys)) throw new Error("api-keys not array");
  for (const k of keys) {
    const id = String(k.id ?? "");
    const name = String(k.name ?? "");
    const val = k.api_key ?? k.key;
    if ((id === "service_role" || name === "service_role") && val) {
      return String(val);
    }
  }
  throw new Error("service_role missing");
}

function assertGrantSqlSafe(sql) {
  const noComments = sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const upper = noComments.toUpperCase();
  if (/\bDROP\b/.test(upper) || /\bTRUNCATE\b/.test(upper)) {
    throw new Error("ABORT: grant SQL contains DROP/TRUNCATE");
  }
  if (/GRANT[\s\S]{0,80}\bDELETE\b/.test(upper)) {
    throw new Error("ABORT: grant SQL grants DELETE");
  }
  if (!/\bGRANT\b/.test(upper)) throw new Error("ABORT: not a grant SQL");
}

const linked = existsSync(path.join(root, "supabase", ".temp", "project-ref"))
  ? readFileSync(path.join(root, "supabase", ".temp", "project-ref"), "utf8").trim()
  : "";
const ref = linked || EXPECTED;
console.log(`[s2v-apply] linked=${mask(ref)}`);
if (ref === PROD || ref !== EXPECTED) {
  console.error("[s2v-apply] refused: not expected staging");
  process.exit(1);
}

if (!existsSync(GRANT_SQL)) {
  console.error("[s2v-apply] grant migration missing");
  process.exit(1);
}
const grantSql = readFileSync(GRANT_SQL, "utf8");
assertGrantSqlSafe(grantSql);
console.log("[s2v-apply] ensuring_minimum_grants (no DELETE)");
dbFile(grantSql);

const privCheck = dbFile(`
SELECT COALESCE(bool_or(has_table_privilege('service_role', format('public.%I', tablename), 'DELETE')), false) AS any_delete,
       COALESCE(bool_and(has_table_privilege('service_role', format('public.%I', tablename), 'SELECT')), false) AS all_select,
       COALESCE(bool_and(has_table_privilege('service_role', format('public.%I', tablename), 'INSERT')), false) AS all_insert
FROM (VALUES
  ('data_sources'),('product_discovery_candidates'),('verification_queue'),
  ('product_field_provenance'),('product_change_history'),('product_offers')
) AS v(tablename);
`);
const privNorm = privCheck.replace(/\s+/g, " ");
console.log("[s2v-apply] privileges_checked");
if (/"any_delete"\s*:\s*true/.test(privNorm)) {
  console.error("[s2v-apply] ABORT: unexpected DELETE privilege");
  process.exit(2);
}
if (!/"all_select"\s*:\s*true/.test(privNorm)) {
  console.error("[s2v-apply] ABORT: SELECT grants incomplete");
  process.exit(2);
}
if (!/"all_insert"\s*:\s*true/.test(privNorm)) {
  console.error("[s2v-apply] ABORT: INSERT grants incomplete");
  process.exit(2);
}

const serviceRole = getStagingServiceRole(ref);
console.log(`[s2v-apply] service_ready len=${serviceRole.length}`);

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  SUPABASE_SERVICE_ROLE_KEY: serviceRole,
  SUPABASE_PROJECT_REF: ref,
  APP_ENV: "preview",
  CATALOG_DATABASE_ENV: "staging",
  PRODUCTION_SUPABASE_PROJECT_REF: PROD,
  npm_config_loglevel: "silent",
};
delete env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

const require = createRequire(import.meta.url);
const tsxEntry = require.resolve("tsx/esm");
const register = pathToFileURL(
  path.join(root, "scripts", "register-server-only.mjs")
).href;
const tsxLoader = pathToFileURL(tsxEntry).href;
const entry = path.join(root, "scripts", "apply-cosrx-s2v-staging.ts");

console.log("[s2v-apply] running_apply_once");
const result = spawnSync(
  process.execPath,
  ["--import", register, "--import", tsxLoader, entry],
  { cwd: root, stdio: "inherit", env, shell: false }
);

process.exit(result.status ?? 1);
