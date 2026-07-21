import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  "supabase/migrations/DRAFT_DO_NOT_APPLY_checkin_email_queue.sql",
  "utf8"
);
const upper = sql
  .replace(/--.*$/gm, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .toUpperCase();

function ok(cond: unknown, label: string) {
  assert.ok(cond, label);
}

ok(/DRAFT ONLY|DO NOT APPLY/i.test(sql), "draft banner present");
ok(/CREATE TABLE IF NOT EXISTS PUBLIC\.CHECKIN_EMAIL_QUEUE/.test(upper), "create table");
ok(/ENABLE ROW LEVEL SECURITY/.test(upper), "RLS enabled");
ok(/GRANT SELECT, INSERT, UPDATE ON TABLE PUBLIC\.CHECKIN_EMAIL_QUEUE TO SERVICE_ROLE/.test(upper), "service_role min grants");
ok(!/\bGRANT[\s\S]{0,120}\bDELETE\b/.test(upper), "no DELETE grant");
ok(!/\bTRUNCATE\b/.test(upper), "no TRUNCATE");
ok(!/\bDROP\b/.test(upper), "no DROP");
ok(/REVOKE ALL ON TABLE PUBLIC\.CHECKIN_EMAIL_QUEUE FROM PUBLIC/.test(upper), "revoke PUBLIC");
ok(/REVOKE ALL ON TABLE PUBLIC\.CHECKIN_EMAIL_QUEUE FROM ANON/.test(upper), "revoke anon");
ok(/REVOKE ALL ON TABLE PUBLIC\.CHECKIN_EMAIL_QUEUE FROM AUTHENTICATED/.test(upper), "revoke authenticated");
ok(/RECIPIENT_MASK TEXT NOT NULL/.test(upper), "recipient_mask NOT NULL");
ok(!/RECIPIENT_HASH/.test(upper), "no recipient_hash");
ok(/IDEMPOTENCY_KEY TEXT NOT NULL/.test(upper), "idempotency_key NOT NULL");
ok(/CHECKIN_EMAIL_QUEUE_IDEMPOTENCY_KEY_UQ UNIQUE \(IDEMPOTENCY_KEY\)/.test(upper), "unique idempotency");
ok(/CHECKIN_EMAIL_QUEUE_STATUS_CHK/.test(upper), "status check named");
ok(/'PENDING'/.test(upper) && /'PROCESSING'/.test(upper) && /'SENT'/.test(upper), "status values");
ok(/'FAILED'/.test(upper) && /'SKIPPED_DUPLICATE'/.test(upper) && /'CANCELLED'/.test(upper), "status values 2");
ok(/CHANNEL TEXT NOT NULL DEFAULT 'EMAIL'/.test(upper), "channel email default");
ok(/CHECK \(CHANNEL = 'EMAIL'\)/.test(upper), "channel email only");
ok(/CHECKIN_ID UUID NOT NULL REFERENCES PUBLIC\.CARE_CHECK_INS/.test(upper), "checkin_id FK");
ok(/USER_ID UUID NOT NULL REFERENCES PUBLIC\.PROFILES/.test(upper), "user_id FK");
ok(/TEMPLATE_VERSION TEXT NOT NULL/.test(upper), "template_version column");
ok(/PROVIDER_MESSAGE_ID TEXT NULL/.test(upper), "provider_message_id nullable");
ok(/CLAIMED_AT TIMESTAMPTZ NULL/.test(upper), "claimed_at");
ok(/RETRY_COUNT INTEGER NOT NULL DEFAULT 0/.test(upper), "retry_count");
ok(/LAST_ERROR TEXT NULL/.test(upper), "last_error");
ok(!/SUBJECT TEXT/.test(upper) && !/BODY TEXT/.test(upper), "no subject/body columns");
ok(/NOT \(PAYLOAD \? 'RECIPIENT_EMAIL'\)/.test(upper) || /NOT \(PAYLOAD \? 'recipient_email'\)/.test(sql), "payload blocks recipient_email");

console.log("[checkin-email-queue-migration] static draft review passed");
