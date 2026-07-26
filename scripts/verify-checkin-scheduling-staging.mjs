#!/usr/bin/env node
/**
 * Staging SELECT-only gate for check-in scheduling / queue readiness.
 * No INSERT. No real email. No Production.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function maskRef(ref) {
  if (!ref || ref.length < 8) return "***";
  return ref.slice(0, 4) + "***" + ref.slice(-3);
}

function loadEnvFile(name) {
  const p = path.join(root, name);
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
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

function extractRef(url) {
  const m = String(url || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : "";
}

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function ok(msg) {
  console.log("OK:", msg);
}

const env = {
  ...loadEnvFile(".env.staging"),
  ...loadEnvFile(".env.preview.staging"),
  ...loadEnvFile(".env.local"),
  ...process.env,
};

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.STAGING_SUPABASE_URL || "";
const serviceKey =
  env.SUPABASE_SERVICE_ROLE_KEY || env.STAGING_SUPABASE_SERVICE_ROLE_KEY || "";
const ref = extractRef(url) || env.SUPABASE_PROJECT_REF || "";

if (!url || !serviceKey) fail("missing Staging URL or service role key");
if (ref === PROD_REF) fail("Production ref blocked");
if (ref && ref !== STAGING_REF) {
  fail("ref is not Staging (" + maskRef(ref) + ")");
}
ok("Staging ref guard " + maskRef(ref || STAGING_REF));

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const requiredCols = [
  "id",
  "user_id",
  "checkin_id",
  "milestone",
  "kind",
  "channel",
  "status",
  "idempotency_key",
  "recipient_mask",
  "locale",
  "timezone",
  "payload",
  "retry_count",
  "created_at",
  "updated_at",
];

const { error } = await admin
  .from("checkin_email_queue")
  .select(requiredCols.join(","))
  .limit(1);

if (error) {
  fail("queue select failed: " + (error.code || "") + " " + (error.message || ""));
}
ok("Schema A columns selectable");

const { data: rows, error: countErr } = await admin
  .from("checkin_email_queue")
  .select("status")
  .limit(5000);

if (countErr) fail("status count select failed");

const counts = {};
for (const row of rows || []) {
  const s = String(row.status || "unknown");
  counts[s] = (counts[s] || 0) + 1;
}
ok(
  "queue status counts " +
    JSON.stringify(counts) +
    " total=" +
    Object.values(counts).reduce((a, b) => a + b, 0)
);

ok("dry-run worker remains separate (no live send in this gate)");
ok("verify:checkin-scheduling-staging passed (SELECT only)");
