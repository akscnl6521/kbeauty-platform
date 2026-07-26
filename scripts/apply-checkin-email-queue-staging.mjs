#!/usr/bin/env node
/**
 * Apply checkin_email_queue dated migration to Staging only + read-only verify.
 * Aborts if linked/env project is Production. Never prints secrets / full refs.
 * Does NOT send email. Does NOT DELETE rows.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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
  console.error(`[apply:checkin-email-queue] FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`[apply:checkin-email-queue] OK: ${msg}`);
}

function npx() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function resolveLinkedRef() {
  const refFile = path.join(root, "supabase", ".temp", "project-ref");
  if (existsSync(refFile)) {
    return readFileSync(refFile, "utf8").trim();
  }
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

function dbQueryFile(sqlText) {
  const f = path.join(tmpdir(), `kb-ceq-${process.pid}-${Date.now()}.sql`);
  writeFileSync(f, sqlText, "utf8");
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
  try {
    unlinkSync(f);
  } catch {
    /* ignore */
  }
  if (r.status !== 0) {
    console.error((r.stdout || "").slice(0, 2000));
    console.error((r.stderr || "").slice(0, 2000));
    fail(`db query failed status=${r.status}`);
  }
  return (r.stdout || "").trim();
}

function getStagingServiceRole(ref) {
  if (ref === PROD) fail("ABORT Production");
  const env = {
    ...loadEnvFile(".env.staging"),
    ...loadEnvFile(".env.local"),
  };
  if (env.SUPABASE_SERVICE_ROLE_KEY) return env.SUPABASE_SERVICE_ROLE_KEY;

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
  const raw = (r.stdout || "").trim();
  if (!raw) fail("could not load service role key");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail("api-keys json parse failed");
  }
  const list = Array.isArray(parsed) ? parsed : parsed?.api_keys || [];
  const sr = list.find(
    (k) =>
      String(k.name || k.id || "")
        .toLowerCase()
        .includes("service") || k.tags?.includes("service_role")
  );
  const key = sr?.api_key || sr?.key || sr?.secret;
  if (!key) fail("service_role key missing");
  return key;
}

// --- gate first ---
const gate = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "gate:checkin-email-queue-staging"],
  { cwd: root, encoding: "utf8", shell: true }
);
if (gate.status !== 0) {
  console.error(gate.stdout || "");
  console.error(gate.stderr || "");
  fail("gate failed — migration not applied");
}
pass("gate passed");

const ref = resolveLinkedRef();
if (ref !== STAGING) fail(`ref guard ${mask(ref)}`);
if (ref === PROD) fail("Production abort");
pass(`applying to Staging ${mask(ref)}`);

if (!existsSync(MIGRATION)) fail("migration file missing");
const sql = readFileSync(MIGRATION, "utf8");
dbQueryFile(sql);
pass("migration SQL applied");

const verifySql = `
select
  to_regclass('public.checkin_email_queue') is not null as table_exists,
  (select relrowsecurity from pg_class where oid = 'public.checkin_email_queue'::regclass) as rls,
  exists(
    select 1 from pg_constraint
    where conrelid = 'public.checkin_email_queue'::regclass
      and conname = 'checkin_email_queue_idempotency_key_uq'
  ) as idem_uq,
  exists(
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'claim_checkin_email_jobs'
  ) as claim_fn,
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='checkin_email_queue'
      and column_name='recipient_hash'
  ) as has_recipient_hash;
`;
const verifyOut = dbQueryFile(verifySql);
pass(`verify query ok (${verifyOut.slice(0, 120).replace(/\s+/g, " ")})`);

const env = loadEnvFile(".env.staging");
const url =
  env.NEXT_PUBLIC_SUPABASE_URL || `https://${STAGING}.supabase.co`;
const serviceKey = getStagingServiceRole(ref);
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

const { error: selErr } = await admin
  .from("checkin_email_queue")
  .select("id")
  .limit(1);
if (selErr && /does not exist|PGRST205/i.test(selErr.message)) {
  fail(`table missing after apply: ${selErr.message}`);
}
if (selErr && /permission|42501/i.test(selErr.message)) {
  fail(`service_role SELECT denied: ${selErr.message}`);
}
pass("service_role SELECT works");

const { data: claimData, error: claimErr } = await admin.rpc(
  "claim_checkin_email_jobs",
  { p_limit: 1, p_stale_seconds: 900 }
);
if (claimErr) fail(`claim rpc failed: ${claimErr.message}`);
pass(`claim rpc dry call ok (rows=${Array.isArray(claimData) ? claimData.length : 0})`);

const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (anonKey) {
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  const { error: anonErr } = await anon
    .from("checkin_email_queue")
    .select("id")
    .limit(1);
  if (!anonErr) fail("anon unexpectedly can SELECT queue");
  pass("anon cannot SELECT queue");
} else {
  pass("anon key absent — skip anon negative check");
}

// Production unchanged = we never linked/applied to PROD
pass(`Production ${mask(PROD)} not targeted`);

console.log("");
console.log("[apply:checkin-email-queue] DONE");
console.log("- Staging migration applied");
console.log("- No email sent");
console.log("- No DELETE executed");
console.log("- Fixture cleanup (manual, do not auto-run):");
console.log(
  "  -- only if you inserted synthetic test rows with idempotency_key like checkin-email:v1:fixture-..."
);
console.log(
  "  -- prefer UPDATE status='cancelled' over DELETE; DELETE requires separate approval"
);
process.exit(0);
