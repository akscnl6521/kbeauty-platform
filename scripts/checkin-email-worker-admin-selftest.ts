/**
 * Self-test for Care check-in email worker admin (WQ-E).
 * Fake DB only — no Resend, no Staging writes required.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as NodeModule;

if (!process.env.SITE_URL && !process.env.NEXT_PUBLIC_SITE_URL) {
  process.env.SITE_URL = "https://example.com";
}

let checks = 0;
function ok(cond: boolean, msg: string) {
  assert.equal(cond, true, msg);
  checks += 1;
}

async function main() {
  const {
    assertCareWorkerAdminEnvironmentAllowed,
    assertSnapshotHasNoPiiFields,
    parseCareWorkerAdminActionBody,
    canManualRetryCheckinEmailJob,
    canManualCancelCheckinEmailJob,
  } = await import("../src/lib/admin/checkinEmailWorkerAdminPolicy");

  const {
    buildFailureReasonSummary,
    countStaleProcessing,
    manualCancelJob,
    manualRetryJob,
    runDryRunTick,
    toRecentJob,
  } = await import("../src/lib/admin/checkinEmailWorkerAdmin");

  const { FakeCheckinEmailQueueDb } = await import(
    "../src/lib/retention/fakeCheckinEmailQueueDb"
  );
  const { claimCheckinEmailJobs } = await import(
    "../src/lib/retention/checkinEmailQueuePersistence"
  );
  type CheckinEmailQueueRow = import("../src/lib/retention/checkinEmailQueuePersistence").CheckinEmailQueueRow;

  const stagingEnv = {
    VERCEL_ENV: "preview",
    APP_ENV: "staging",
    NEXT_PUBLIC_SUPABASE_URL: "https://jfnjufmldiqlgvgyugfd.supabase.co",
  };

  const prodEnv = {
    VERCEL_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: "https://jfnjufmldiqlgvgyugfd.supabase.co",
  };

  const prodRefEnv = {
    VERCEL_ENV: "preview",
    NEXT_PUBLIC_SUPABASE_URL: "https://rhfrmvkjsummaylpzmns.supabase.co",
  };

  ok(
    assertCareWorkerAdminEnvironmentAllowed(prodEnv).ok === false,
    "production vercel blocked"
  );
  ok(
    assertCareWorkerAdminEnvironmentAllowed(prodRefEnv).ok === false,
    "production ref blocked"
  );
  ok(
    assertCareWorkerAdminEnvironmentAllowed(stagingEnv).ok === true,
    "staging/preview allowed"
  );

  ok(
    parseCareWorkerAdminActionBody({ action: "dry_run_tick" }).ok === false,
    "missing confirm rejected"
  );
  ok(
    parseCareWorkerAdminActionBody({
      action: "dry_run_tick",
      confirm: "yes",
    }).ok === false,
    "invalid confirm rejected"
  );
  ok(
    parseCareWorkerAdminActionBody({
      action: "dry_run_tick",
      confirm: "CONFIRM",
    }).ok === true,
    "CONFIRM accepted"
  );

  ok(canManualRetryCheckinEmailJob({ status: "failed" }).ok, "retry failed ok");
  ok(
    !canManualRetryCheckinEmailJob({ status: "pending" }).ok,
    "retry pending blocked"
  );
  ok(
    canManualCancelCheckinEmailJob({ status: "pending" }).ok,
    "cancel pending ok"
  );
  ok(
    !canManualCancelCheckinEmailJob({ status: "sent" }).ok,
    "cancel sent blocked"
  );

  const payload = {
    subjectKey: "email.checkin_due.day7.subject",
    bodyKey: "email.checkin_due.day7.body",
    locale: "ko" as const,
    milestone: "day7" as const,
    kind: "checkin_due" as const,
    checkinUrlPath: "/my/check-ins/ci-a",
    preferenceUrlPath: "/my/settings",
  };

  function seedRow(
    overrides: Partial<CheckinEmailQueueRow> & {
      id: string;
      status: CheckinEmailQueueRow["status"];
    }
  ): CheckinEmailQueueRow {
    const now = new Date().toISOString();
    return {
      id: overrides.id,
      user_id: "00000000-0000-4000-8000-000000000001",
      checkin_id: "00000000-0000-4000-8000-0000000000a1",
      milestone: "day7",
      kind: "checkin_due",
      channel: "email",
      status: overrides.status,
      idempotency_key: `checkin-email:v1:u:ci:${overrides.id}:day7:checkin_due:email`,
      recipient_mask: "u***@example.com",
      locale: "ko",
      timezone: "Asia/Seoul",
      template_version: "v1",
      payload,
      provider_message_id: null,
      retry_count: overrides.retry_count ?? 2,
      last_error: overrides.last_error ?? null,
      next_attempt_at: overrides.next_attempt_at ?? now,
      created_at: now,
      updated_at: overrides.updated_at ?? now,
      scheduled_at: now,
      claimed_at: overrides.claimed_at ?? null,
      sent_at: null,
      failed_at: overrides.failed_at ?? null,
    };
  }

  const audits: Array<{ type: string; meta: Record<string, unknown> }> = [];
  const writeAudit = async (
    eventType: string,
    meta: Record<string, unknown>
  ) => {
    audits.push({ type: eventType, meta });
  };

  const db = new FakeCheckinEmailQueueDb();
  db.seed(
    seedRow({
      id: "job-pending-1",
      status: "pending",
      retry_count: 0,
      last_error: null,
    })
  );

  const tick = await runDryRunTick({
    adminId: "admin-1",
    db,
    writeAudit,
    env: stagingEnv,
    limit: 5,
  });
  ok(tick.claimed === 1, "dry-run claimed 1");
  ok(tick.completed === 1, "dry-run completed 1");
  ok(tick.providerCalls === 0, "providerCalls 0");
  ok(
    audits.some((a) => a.type === "checkin_email_dry_run"),
    "dry_run audit written"
  );

  const db2 = new FakeCheckinEmailQueueDb();
  const staleAt = new Date(Date.now() - 2000 * 1000).toISOString();
  db2.seed(
    seedRow({
      id: "job-stale",
      status: "processing",
      claimed_at: staleAt,
      updated_at: staleAt,
      retry_count: 0,
    })
  );
  const claimed = await claimCheckinEmailJobs(db2, {
    limit: 5,
    staleSeconds: 900,
  });
  ok(claimed.length === 1, "stale recovered and claimed");
  ok(claimed[0].id === "job-stale", "stale job id");
  ok(
    countStaleProcessing(
      [{ status: "processing", claimed_at: staleAt, updated_at: staleAt }],
      900
    ) === 1,
    "stale count"
  );

  const db3 = new FakeCheckinEmailQueueDb();
  db3.seed(
    seedRow({
      id: "job-failed",
      status: "failed",
      retry_count: 3,
      last_error: "provider_error for alice@example.com",
      failed_at: new Date().toISOString(),
    })
  );

  let rejected = false;
  try {
    await manualRetryJob({
      jobId: "job-failed",
      confirm: "nope",
      adminId: "admin-1",
      db: db3,
      writeAudit,
      env: stagingEnv,
    });
  } catch (e) {
    rejected = (e as { code?: string }).code === "confirmation_required";
  }
  ok(rejected, "invalid confirm rejected on retry");

  const retried = await manualRetryJob({
    jobId: "job-failed",
    confirm: "CONFIRM",
    adminId: "admin-1",
    db: db3,
    writeAudit,
    env: stagingEnv,
  });
  ok(retried.status === "pending", "retry → pending");
  ok(retried.retry_count === 0, "retry_count reset to 0");
  const rowAfter = db3.rows.get("job-failed")!;
  ok(rowAfter.last_error === null, "last_error cleared");

  const db4 = new FakeCheckinEmailQueueDb();
  db4.seed(
    seedRow({
      id: "job-cancel",
      status: "pending",
      retry_count: 0,
    })
  );
  const cancelled = await manualCancelJob({
    jobId: "job-cancel",
    confirm: "CONFIRM",
    adminId: "admin-1",
    db: db4,
    writeAudit,
    env: stagingEnv,
  });
  ok(cancelled.status === "cancelled", "cancel → cancelled");

  const jobView = toRecentJob(
    seedRow({
      id: "job-view",
      status: "failed",
      last_error: "boom alice@example.com",
    })
  );
  const snap = {
    counts: { failed: 1 },
    failureReasonSummary: buildFailureReasonSummary([
      "fail for bob@x.com",
      "fail for bob@x.com",
    ]),
    recentJobs: [jobView],
  };
  const pii = assertSnapshotHasNoPiiFields(snap);
  ok(pii.ok, "snapshot has no forbidden keys");
  ok(!JSON.stringify(snap).includes("@"), "sanitized errors have no email @");
  ok(!("recipient_mask" in jobView), "no recipient_mask on recent job");
  ok(!("payload" in jobView), "no payload on recent job");
  ok(!("user_id" in jobView), "no user_id on recent job");

  let prodBlocked = false;
  try {
    await runDryRunTick({
      adminId: "admin-1",
      db: new FakeCheckinEmailQueueDb(),
      writeAudit,
      env: prodEnv,
    });
  } catch (e) {
    prodBlocked = (e as { code?: string }).code === "production_blocked";
  }
  ok(prodBlocked, "dry-run blocked in production");

  console.log(`OK checkin-email-worker-admin-selftest (${checks} checks)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
