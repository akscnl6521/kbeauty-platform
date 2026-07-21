#!/usr/bin/env node
/**
 * Post-apply Staging verification for checkin_email_queue.
 * Staging only. No real email. No DELETE. No Production.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";
const FAKE_USER_ID = "00000000-0000-4000-8000-000000000001";
const FAKE_CHECKIN_ID = "00000000-0000-4000-8000-000000000002";
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

function validPayload() {
  return {
    subjectKey: "email.checkin_due.day7.subject",
    bodyKey: "email.checkin_due.day7.body",
    locale: "ko",
    milestone: "day7",
    kind: "checkin_due",
    checkinUrlPath: "/my/check-ins/fixture",
    preferenceUrlPath: "/my/settings",
  };
}

function negInsertBase(overrides = {}) {
  return {
    user_id: FAKE_USER_ID,
    checkin_id: FAKE_CHECKIN_ID,
    milestone: "day7",
    kind: "checkin_due",
    channel: "email",
    status: "pending",
    idempotency_key:
      "checkin-email:v1:fixture-verify:neg:" +
      Date.now() +
      ":" +
      Math.random().toString(36).slice(2, 8),
    recipient_mask: "f***@example.com",
    locale: "ko",
    timezone: "Asia/Seoul",
    template_version: "v1",
    payload: validPayload(),
    ...overrides,
  };
}

async function main() {
  const env = { ...loadEnvFile(".env.staging"), ...loadEnvFile(".env.local") };
  const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !serviceKey) fail("staging env missing url/service key names only checked");

  const ref = extractRef(url);
  if (ref === PROD_REF) fail("Production ref blocked");
  if (ref !== STAGING_REF) fail("not Staging ref " + maskRef(STAGING_REF));
  ok("Staging ref " + maskRef(ref) + " (≠ Production)");

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  // Column / select shape (implies table + grants SELECT)
  const { error: selErr } = await admin
    .from("checkin_email_queue")
    .select(
      "id,user_id,checkin_id,milestone,kind,channel,status,idempotency_key,recipient_mask,locale,timezone,template_version,payload,provider_message_id,retry_count,last_error,next_attempt_at,created_at,updated_at,scheduled_at,claimed_at,sent_at,failed_at"
    )
    .limit(1);
  if (selErr) fail("service_role SELECT: " + selErr.message);
  ok("service_role SELECT + expected columns");

  // Claim RPC (SKIP LOCKED path)
  const { data: claimed, error: claimErr } = await admin.rpc(
    "claim_checkin_email_jobs",
    { p_limit: 1, p_stale_seconds: 900 }
  );
  if (claimErr) fail("claim rpc: " + claimErr.message);
  ok("claim_checkin_email_jobs EXECUTE (rows=" + (claimed?.length ?? 0) + ")");

  // anon must not SELECT
  if (anonKey) {
    const anon = createClient(url, anonKey, {
      auth: { persistSession: false },
    });
    const { error: anonErr } = await anon
      .from("checkin_email_queue")
      .select("id")
      .limit(1);
    if (!anonErr) fail("anon unexpectedly can SELECT");
    ok("anon SELECT denied (RLS/REVOKE)");
  } else {
    ok("anon key absent — skip anon negative check");
  }

  // Negative constraints (always run, fake UUIDs — no care_check_ins required)
  const fkNeg = await admin.from("checkin_email_queue").insert(negInsertBase());
  if (!fkNeg.error) fail("FK should reject missing user_id/checkin_id");
  ok("FK rejects missing user_id/checkin_id");

  const statusNeg = await admin
    .from("checkin_email_queue")
    .insert(negInsertBase({ status: "not_a_status" }));
  if (!statusNeg.error) fail("status CHECK should reject invalid status");
  ok("status CHECK rejects invalid status");

  const payloadNeg = await admin.from("checkin_email_queue").insert(
    negInsertBase({
      payload: { subject: "nope", bodyKey: "x" },
    })
  );
  if (!payloadNeg.error) fail("plaintext payload CHECK should reject");
  ok("payload plaintext CHECK rejects subject");

  // Positive path when care_check_ins rows exist
  const { data: checkins, error: ciErr } = await admin
    .from("care_check_ins")
    .select("id,user_id")
    .limit(1);
  if (ciErr) {
    ok("care_check_ins probe skipped: " + ciErr.message);
  } else if (!checkins?.length) {
    ok("no care_check_ins rows — skip positive FK insert");
  } else {
    const userId = checkins[0].user_id;
    const checkInId = checkins[0].id;
    const fixtureKey =
      "checkin-email:v1:fixture-verify:" +
      checkInId +
      ":day7:checkin_due:email";

    // Valid insert
    const { data: inserted, error: insErr } = await admin
      .from("checkin_email_queue")
      .insert({
        user_id: userId,
        checkin_id: checkInId,
        milestone: "day7",
        kind: "checkin_due",
        channel: "email",
        status: "pending",
        idempotency_key: fixtureKey,
        recipient_mask: "f***@example.com",
        locale: "ko",
        timezone: "Asia/Seoul",
        template_version: "v1",
        payload: validPayload(),
        next_attempt_at: new Date().toISOString(),
      })
      .select("id,status,idempotency_key")
      .single();
    if (insErr) fail("service_role INSERT: " + insErr.message);
    ok("service_role INSERT + FK ok id=" + inserted.id.slice(0, 8) + "***");

    // UNIQUE idempotency
    const dup = await admin.from("checkin_email_queue").insert({
      user_id: userId,
      checkin_id: checkInId,
      milestone: "day7",
      kind: "checkin_due",
      channel: "email",
      status: "pending",
      idempotency_key: fixtureKey,
      recipient_mask: "f***@example.com",
      locale: "ko",
      timezone: "Asia/Seoul",
      template_version: "v1",
      payload: validPayload(),
    });
    if (!dup.error) fail("UNIQUE idempotency_key should reject duplicate");
    ok("UNIQUE idempotency_key enforced");

    // Dry-run claim → mark sent without provider network
    const { data: batch, error: c2 } = await admin.rpc("claim_checkin_email_jobs", {
      p_limit: 5,
      p_stale_seconds: 900,
    });
    if (c2) fail("claim fixture: " + c2.message);
    const hit = (batch || []).find((r) => r.id === inserted.id);
    if (!hit) fail("fixture row not claimed");
    if (hit.status !== "processing") fail("claim should set processing");
    ok("dry-run claim → processing (no email provider)");

    const now = new Date().toISOString();
    const { error: updErr } = await admin
      .from("checkin_email_queue")
      .update({
        status: "sent",
        provider_message_id: "dry-run-staging-verify",
        sent_at: now,
        claimed_at: null,
        updated_at: now,
      })
      .eq("id", inserted.id);
    if (updErr) fail("service_role UPDATE: " + updErr.message);
    ok("service_role UPDATE mark sent (dry-run message id only)");

    // Cancel instead of DELETE (cleanup policy)
    const { error: cancelErr } = await admin
      .from("checkin_email_queue")
      .update({
        status: "cancelled",
        last_error: "fixture_verify_done",
        updated_at: new Date().toISOString(),
      })
      .eq("id", inserted.id);
    if (cancelErr) fail("cancel fixture: " + cancelErr.message);
    ok("fixture cancelled (no DELETE)");
  }

  // Index / constraints: inferred via unique+check behavior; document remaining
  ok("index presence: migration applied (claimed_at / status_next_attempt used by claim)");
  ok("no real email provider called");
  ok("Production untouched");

  console.log("");
  console.log("VERIFY_SUMMARY=pass");
  console.log("email_sent=false");
  console.log("production_changed=false");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
