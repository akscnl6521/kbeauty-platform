#!/usr/bin/env node
import assert from "node:assert/strict";
import { evaluateCommandOrSql } from "./safe-command-gate.mjs";

const allow = [
  "SELECT * FROM checkin_email_queue LIMIT 1",
  "GRANT SELECT, INSERT, UPDATE ON TABLE public.checkin_email_queue TO service_role",
  "CREATE TABLE IF NOT EXISTS public.foo (id uuid primary key)",
  "npm run test:checkin-email-queue",
  "git push origin feature/my-branch",
  "vercel deploy",
];

for (const a of allow) {
  const r = evaluateCommandOrSql(a);
  assert.equal(r.ok, true, `should allow: ${a} -> ${r.reasons}`);
}

const block = [
  "supabase link --project-ref rhfrmvkjsummaylpzmns",
  "git checkout main",
  "git merge main",
  "vercel deploy --prod",
  "DROP TABLE users",
  "TRUNCATE checkin_email_queue",
  "DELETE FROM products WHERE id = 1",
  "RESEND_API_KEY=re_abc123secret",
  "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig",
];

for (const b of block) {
  const r = evaluateCommandOrSql(b);
  assert.equal(r.ok, false, `should block: ${b}`);
}

const allowDelete = evaluateCommandOrSql(
  "DELETE FROM synthetic_test_rows WHERE run_id = 'fixture-1'"
);
assert.equal(allowDelete.ok, true);

console.log("safe-command-gate-selftest OK");
