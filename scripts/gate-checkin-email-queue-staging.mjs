#!/usr/bin/env node
/**
 * Pre-apply gate for checkin_email_queue Staging migration.
 * Never applies SQL. Never prints secrets or full project refs.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = "rhfrmvkjsummaylpzmns";
const STAGING = "jfnjufmldiqlgvgyugfd";
const MIGRATION = path.join(
  root,
  "supabase/migrations/20260722010000_create_checkin_email_queue.sql"
);

function mask(ref) {
  if (!ref || ref.length < 8) return "***";
  return `${ref.slice(0, 4)}***${ref.slice(-3)}`;
}

function fail(msg) {
  console.error(`[gate:checkin-email-queue] FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`[gate:checkin-email-queue] OK: ${msg}`);
}

function resolveLinkedRef() {
  const refFile = path.join(root, "supabase", ".temp", "project-ref");
  if (existsSync(refFile)) {
    return readFileSync(refFile, "utf8").trim();
  }
  // Fallback: STAGING_SUPABASE_PROJECT_REF or URL host from .env.staging
  for (const envName of [".env.staging", ".env.preview.staging", ".env.local"]) {
    const p = path.join(root, envName);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    const refMatch = text.match(/SUPABASE_PROJECT_REF\s*=\s*([^\r\n#]+)/);
    if (refMatch) return refMatch[1].trim();
    const urlMatch = text.match(
      /NEXT_PUBLIC_SUPABASE_URL\s*=\s*https?:\/\/([a-z0-9]+)\.supabase\.co/i
    );
    if (urlMatch) return urlMatch[1];
  }
  return "";
}

function run(cmd, args) {
  const bin = process.platform === "win32" && cmd === "npx" ? "npx.cmd" : cmd;
  const r = spawnSync(bin, args, {
    cwd: root,
    encoding: "utf8",
    shell: true,
    env: { ...process.env, npm_config_loglevel: "silent" },
  });
  return r;
}

const ref = resolveLinkedRef();
if (!ref) fail("project ref unresolved (link Staging or set .env.staging)");
if (ref === PROD) fail(`linked Production ${mask(ref)} — abort`);
if (ref !== STAGING) fail(`expected Staging ${mask(STAGING)}, got ${mask(ref)}`);
pass(`project ref is Staging ${mask(ref)}`);
pass(`Production differs (${mask(PROD)})`);

if (!existsSync(MIGRATION)) fail("dated migration missing");
const sql = readFileSync(MIGRATION, "utf8");
const upper = sql
  .replace(/--.*$/gm, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .toUpperCase();

const sqlNoFkDelete = upper.replace(/ON DELETE CASCADE/g, "ON REMOVE CASCADE");
if (/\bDROP\b/.test(sqlNoFkDelete)) fail("DROP found in migration");
if (/\bTRUNCATE\b/.test(sqlNoFkDelete)) fail("TRUNCATE found");
if (/\bDELETE\b/.test(sqlNoFkDelete)) fail("DELETE found");
pass("no DROP/TRUNCATE/DELETE (ON DELETE CASCADE FK allowed)");

if (!/ENABLE ROW LEVEL SECURITY/.test(upper)) fail("RLS missing");
pass("RLS enabled");

if (!/GRANT SELECT, INSERT, UPDATE ON TABLE PUBLIC\.CHECKIN_EMAIL_QUEUE TO SERVICE_ROLE/.test(upper)) {
  fail("service_role grants not minimal SELECT/INSERT/UPDATE");
}
if (/\bGRANT[\s\S]{0,160}\bDELETE\b/.test(upper)) fail("DELETE grant present");
pass("service_role SELECT/INSERT/UPDATE only");

if (/RECIPIENT_HASH/.test(upper)) fail("recipient_hash present");
pass("no recipient_hash");

if (/RECIPIENT_EMAIL TEXT|SUBJECT TEXT|BODY TEXT/.test(upper)) {
  fail("plaintext email/subject/body column present");
}
pass("no plaintext email/subject/body columns");

if (!/FOR UPDATE SKIP LOCKED/.test(upper)) fail("claim SKIP LOCKED missing");
pass("claim uses FOR UPDATE SKIP LOCKED");

if (!/CHECKIN-EMAIL:V1:/.test(sql.toUpperCase()) && !/checkin-email:v1:/.test(sql)) {
  // comment documents v1 — require comment presence
  if (!/checkin-email:v1/.test(sql)) fail("idempotency v1 not documented");
}
pass("idempotency v1 documented");

const tests = [
  ["npm", ["run", "test:checkin-email-queue-migration"]],
  ["npm", ["run", "test:checkin-email-queue"]],
  ["npm", ["run", "test:checkin-email-queue-persistence"]],
  ["npm", ["run", "test:admin-care-readiness"]],
  ["npm", ["run", "test:checkin-email-test-api"]],
];

for (const [cmd, args] of tests) {
  const label = args.join(" ");
  const r = run(cmd, args);
  if (r.status !== 0) {
    console.error(r.stdout || "");
    console.error(r.stderr || "");
    fail(`test failed: ${label}`);
  }
  pass(label);
}

const buildEnv = { ...process.env };
// Prefer staging env file for build when present
const stagingEnvPath = path.join(root, ".env.staging");
if (existsSync(stagingEnvPath)) {
  for (const line of readFileSync(stagingEnvPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (buildEnv[m[1]] === undefined) buildEnv[m[1]] = v;
  }
}
buildEnv.APP_ENV = buildEnv.APP_ENV || "staging";
buildEnv.CATALOG_DATABASE_ENV = buildEnv.CATALOG_DATABASE_ENV || "staging";

const build = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "build"],
  {
    cwd: root,
    encoding: "utf8",
    shell: true,
    env: buildEnv,
  }
);
if (build.status !== 0) {
  console.error(build.stdout?.slice(-4000) || "");
  console.error(build.stderr?.slice(-2000) || "");
  fail("npm run build failed");
}
pass("npm run build");

console.log("[gate:checkin-email-queue] ALL GATES PASSED — safe to apply Staging migration");
process.exit(0);
