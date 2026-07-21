import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

function ok(cond: unknown, label: string) {
  assert.ok(cond, label);
}

const datedPath = "supabase/migrations/20260722010000_create_checkin_email_queue.sql";
const draftPath = "supabase/migrations/DRAFT_DO_NOT_APPLY_checkin_email_queue.sql";

ok(existsSync(datedPath), "dated migration exists");
ok(existsSync(draftPath), "draft retained as reference");

const sql = readFileSync(datedPath, "utf8");
const upper = sql
  .replace(/--.*$/gm, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .toUpperCase();

ok(!/^\s*--\s*DRAFT ONLY/im.test(sql), "dated is not DRAFT ONLY file");
ok(/CREATE TABLE IF NOT EXISTS PUBLIC\.CHECKIN_EMAIL_QUEUE/.test(upper), "create table");
ok(/ENABLE ROW LEVEL SECURITY/.test(upper), "RLS enabled");
ok(/GRANT SELECT, INSERT, UPDATE ON TABLE PUBLIC\.CHECKIN_EMAIL_QUEUE TO SERVICE_ROLE/.test(upper), "service_role min grants");
ok(!/\bGRANT[\s\S]{0,120}\bDELETE\b/.test(upper), "no DELETE grant");
ok(!/\bTRUNCATE\b/.test(upper), "no TRUNCATE");
ok(!/\bDROP\b/.test(upper), "no DROP");
ok(!/\bDELETE FROM\b/.test(upper), "no DELETE FROM");
ok((upper.match(/\bDELETE\b/g) || []).length === (upper.match(/ON DELETE CASCADE/g) || []).length, "DELETE only as ON DELETE CASCADE");
ok(/REVOKE ALL ON TABLE PUBLIC\.CHECKIN_EMAIL_QUEUE FROM PUBLIC/.test(upper), "revoke PUBLIC");
ok(/REVOKE ALL ON TABLE PUBLIC\.CHECKIN_EMAIL_QUEUE FROM ANON/.test(upper), "revoke anon");
ok(/REVOKE ALL ON TABLE PUBLIC\.CHECKIN_EMAIL_QUEUE FROM AUTHENTICATED/.test(upper), "revoke authenticated");
ok(/RECIPIENT_MASK TEXT NOT NULL/.test(upper), "recipient_mask NOT NULL");
ok(!/RECIPIENT_HASH/.test(upper), "no recipient_hash");
ok(/CHECKIN_EMAIL_QUEUE_IDEMPOTENCY_KEY_UQ UNIQUE \(IDEMPOTENCY_KEY\)/.test(upper), "unique idempotency");
ok(/'PENDING'/.test(upper) && /'PROCESSING'/.test(upper) && /'SENT'/.test(upper), "status values");
ok(/'FAILED'/.test(upper) && /'SKIPPED_DUPLICATE'/.test(upper) && /'CANCELLED'/.test(upper), "status values 2");
ok(/CLAIM_CHECKIN_EMAIL_JOBS/.test(upper), "claim function");
ok(/FOR UPDATE SKIP LOCKED/.test(upper), "SKIP LOCKED");
ok(/GRANT EXECUTE ON FUNCTION PUBLIC\.CLAIM_CHECKIN_EMAIL_JOBS/.test(upper), "claim execute service_role");
ok(/CHECKIN_ID UUID NOT NULL REFERENCES PUBLIC\.CARE_CHECK_INS/.test(upper), "checkin_id FK");
ok(!/SUBJECT TEXT/.test(upper) && !/BODY TEXT/.test(upper), "no subject/body columns");
ok(/NOT \(PAYLOAD \? 'RECIPIENT_EMAIL'\)/.test(upper) || /NOT \(PAYLOAD \? 'recipient_email'\)/.test(sql), "payload blocks recipient_email");

// DRAFT still documents Schema A (reference only)
const draft = readFileSync(draftPath, "utf8");
ok(/DRAFT ONLY|DO NOT APPLY/i.test(draft), "draft banner retained");

console.log("[checkin-email-queue-migration] dated migration static review passed");
