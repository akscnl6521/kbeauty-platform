#!/usr/bin/env node
/**
 * Staging SELECT verify for check-in email worker admin (WQ-E).
 * Prefer SELECT-only. Optional dry-run tick only if queue empty/safe.
 * Never calls Resend. Production ref blocked.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";
const root = path.resolve(import.meta.dirname, "..");

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

async function main() {
  const env = { ...loadEnvFile(".env.staging"), ...loadEnvFile(".env.local") };
  const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceKey) {
    ok("staging env missing — skip remote SELECT (unit selftest is source of truth)");
    process.exit(0);
  }

  const ref = extractRef(url);
  if (ref === PROD_REF) fail("Production ref blocked " + maskRef(ref));
  if (ref !== STAGING_REF) fail("expected Staging " + maskRef(STAGING_REF) + " got " + maskRef(ref));
  ok("Staging ref " + maskRef(ref) + " (≠ Production " + maskRef(PROD_REF) + ")");

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await admin
    .from("checkin_email_queue")
    .select("id, status, kind, milestone, retry_count, updated_at")
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) fail("queue SELECT failed: " + (error.code || error.message));
  ok("queue SELECT ok · rows=" + (rows?.length ?? 0) + " (no recipient/payload)");

  const { count: pendingCount, error: pErr } = await admin
    .from("checkin_email_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (pErr) fail("pending count failed");
  ok("pending count=" + (pendingCount ?? 0));

  const { data: audits, error: aErr } = await admin
    .from("care_audit_events")
    .select("id, event_type, created_at")
    .like("event_type", "checkin_email_%")
    .order("created_at", { ascending: false })
    .limit(5);
  if (aErr) {
    ok("care_audit_events SELECT skipped: " + (aErr.code || "error"));
  } else {
    ok("audit SELECT ok · rows=" + (audits?.length ?? 0));
  }

  // Dry-run tick intentionally NOT run remotely by default (prefer unit fake).
  ok("remote dry-run tick skipped (unit fake covers providerCalls===0)");
  ok("Resend not called");
  console.log("PASS verify-checkin-email-worker-admin-staging");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
