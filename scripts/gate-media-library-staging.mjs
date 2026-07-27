#!/usr/bin/env node
/**
 * Offline gate for the §36.4 media asset library migration.
 * Runs before any Staging apply. Touches no database.
 *
 * Fails if: the migration is missing, it contains a destructive or
 * privilege-widening statement, the linked project is Production, or the
 * domain/migration self-tests do not pass.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD_REF = "rhfrmvkjsummaylpzmns";
const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const MIGRATION = path.join(
  root,
  "supabase/migrations/20260727120000_create_media_asset_library.sql"
);

function fail(msg) {
  console.error(`[gate:media-library] FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`[gate:media-library] OK: ${msg}`);
}

function maskRef(ref) {
  if (!ref || ref.length < 8) return "***";
  return `${ref.slice(0, 4)}***${ref.slice(-3)}`;
}

function loadEnvFile(name) {
  const p = path.join(root, name);
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function resolveLinkedRef() {
  const refFile = path.join(root, "supabase", ".temp", "project-ref");
  if (existsSync(refFile)) return readFileSync(refFile, "utf8").trim();
  for (const name of [".env.staging", ".env.local"]) {
    const env = loadEnvFile(name);
    if (env.SUPABASE_PROJECT_REF) return env.SUPABASE_PROJECT_REF;
    const m = (env.NEXT_PUBLIC_SUPABASE_URL || "").match(
      /https:\/\/([a-z0-9]+)\.supabase\.co/i
    );
    if (m) return m[1];
  }
  return "";
}

// --- 1. migration present ----------------------------------------------------
if (!existsSync(MIGRATION)) fail("migration file missing");
const sql = readFileSync(MIGRATION, "utf8");
const upper = sql
  .replace(/--.*$/gm, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .toUpperCase();
pass("migration file present");

// --- 2. destructive statement ban -------------------------------------------
for (const [pattern, label] of [
  [/\bDROP\b/, "DROP"],
  [/\bTRUNCATE\b/, "TRUNCATE"],
  [/\bDELETE FROM\b/, "DELETE FROM"],
  [/\bALTER TABLE[^;]*\bDROP COLUMN\b/, "DROP COLUMN"],
  [/CREATE OR REPLACE POLICY/, "CREATE OR REPLACE POLICY (invalid in PostgreSQL)"],
]) {
  if (pattern.test(upper)) fail(`migration contains ${label}`);
}
pass("no destructive statement");

// --- 3. privilege ban --------------------------------------------------------
if (/\bGRANT[^;]*\bTO\s+ANON\b/.test(upper)) {
  fail("migration grants privileges to anon — display is a separate approval");
}
if (/\bGRANT[^;]*\bTO\s+AUTHENTICATED\b/.test(upper)) {
  fail("migration grants privileges to authenticated — not in this track");
}
if (/\bGRANT[^;]*\bDELETE\b/.test(upper)) {
  fail("migration grants DELETE");
}
pass("no anon / authenticated / DELETE grant");

// --- 4. RLS on every new table ----------------------------------------------
const tables = [...upper.matchAll(/CREATE TABLE IF NOT EXISTS PUBLIC\.(\w+)/g)].map(
  (m) => m[1]
);
if (tables.length === 0) fail("no tables found in migration");
for (const table of tables) {
  if (
    !new RegExp(`ALTER TABLE PUBLIC\\.${table} ENABLE ROW LEVEL SECURITY`).test(
      upper
    )
  ) {
    fail(`RLS not enabled on ${table}`);
  }
}
pass(`RLS enabled on all ${tables.length} tables`);

// --- 5. target is not Production --------------------------------------------
const ref = resolveLinkedRef();
if (!ref) fail("could not resolve target project ref");
if (ref === PROD_REF) fail("linked project is Production — refusing");
if (ref !== STAGING_REF) fail(`unexpected project ref ${maskRef(ref)}`);
pass(`target is Staging ${maskRef(ref)}`);

// --- 6. self-tests -----------------------------------------------------------
const test = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "test:media-asset-library"],
  { cwd: root, encoding: "utf8", shell: true }
);
if (test.status !== 0) {
  console.error((test.stdout || "").slice(-2000));
  console.error((test.stderr || "").slice(-2000));
  fail("media asset library self-tests failed");
}
pass("self-tests passed");

console.log("");
console.log("[gate:media-library] PASS — safe to apply to Staging");
process.exit(0);
