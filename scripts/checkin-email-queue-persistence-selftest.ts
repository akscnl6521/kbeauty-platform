import assert from "node:assert/strict";
import { buildCheckinEmailIdempotencyKey } from "../src/lib/retention/checkinEmailQueuePolicy";
import { sanitizeCheckinEmailError } from "../src/lib/retention/checkinEmailErrorSanitize";
import { memoryStatusToDbStatus } from "../src/lib/retention/checkinEmailQueueStatusMap";
import {
  claimCheckinEmailJobs,
  enqueueCheckinEmail,
  markCheckinEmailFailed,
  markCheckinEmailSent,
} from "../src/lib/retention/checkinEmailQueuePersistence";
import { FakeCheckinEmailQueueDb } from "../src/lib/retention/fakeCheckinEmailQueueDb";
import { runCheckinEmailQueueDryRunWorker } from "../src/lib/retention/processCheckinEmailQueueDryRunWorker";
import { buildPreviewTestIdempotencyKey } from "../src/lib/admin/checkinEmailTestSendPolicy";
import type { EmailProvider, EmailSendRequest } from "../src/lib/email/provider/types";

// Synthetic origin for dry-run absolute links (no network).
if (!process.env.SITE_URL && !process.env.NEXT_PUBLIC_SITE_URL) {
  process.env.SITE_URL = "https://example.com";
}

let checks = 0;
function ok(cond: boolean, msg: string) {
  assert.equal(cond, true, msg);
  checks += 1;
}

const payload = {
  subjectKey: "email.checkin_due.day7.subject",
  bodyKey: "email.checkin_due.day7.body",
  locale: "ko" as const,
  milestone: "day7" as const,
  kind: "checkin_due" as const,
  checkinUrlPath: "/my/check-ins/ci-a",
  preferenceUrlPath: "/my/settings",
};

// status mapping
ok(memoryStatusToDbStatus("scheduled") === "pending", "scheduled→pending");
ok(memoryStatusToDbStatus("sending") === "processing", "sending→processing");
ok(memoryStatusToDbStatus("retry_scheduled") === "pending", "retry→pending");
ok(memoryStatusToDbStatus("duplicate") === "skipped_duplicate", "dup map");
ok(memoryStatusToDbStatus("dead_letter") === "failed", "dead→failed");

// idempotency: scheduleDate / locale / template ignored by key builder
const baseKey = buildCheckinEmailIdempotencyKey({
  subjectId: "user-1",
  checkInId: "ci-a",
  milestone: "day7",
  kind: "checkin_due",
});
ok(
  baseKey ===
    buildCheckinEmailIdempotencyKey({
      subjectId: "user-1",
      checkInId: "ci-a",
      milestone: "day7",
      kind: "checkin_due",
    }),
  "same key regardless of scheduleDate absence"
);
ok(baseKey.includes(":day7:checkin_due:email"), "v1 shape");
ok(
  buildCheckinEmailIdempotencyKey({
    subjectId: "user-1",
    checkInId: "ci-a",
    milestone: "day7",
    kind: "checkin_reminder",
  }) !== baseKey,
  "kind changes key"
);
ok(
  buildCheckinEmailIdempotencyKey({
    subjectId: "user-1",
    checkInId: "ci-a",
    milestone: "day15",
    kind: "checkin_due",
  }) !== baseKey,
  "milestone changes key"
);
ok(
  buildCheckinEmailIdempotencyKey({
    subjectId: "user-1",
    checkInId: "ci-b",
    milestone: "day7",
    kind: "checkin_due",
  }) !== baseKey,
  "checkin_id changes key"
);

const previewKey = buildPreviewTestIdempotencyKey({
  deploymentId: "preview-dep",
  adminUserId: "admin-1",
  milestone: "day7",
  kind: "checkin_due",
  locale: "ko",
  now: new Date("2026-07-22T01:00:00.000Z"),
});
ok(previewKey.startsWith("preview-email-test:"), "preview prefix");
ok(!previewKey.startsWith("checkin-email:v1:"), "preview not production");
ok(!baseKey.startsWith("preview-email-test:"), "production not preview");

// error sanitizer
ok(
  !sanitizeCheckinEmailError("fail for alice@example.com").includes("@"),
  "email stripped"
);
ok(
  sanitizeCheckinEmailError("Authorization: Bearer secret") === "provider_error",
  "auth dumped → fallback"
);

async function main() {
  const db = new FakeCheckinEmailQueueDb();

  const enq1 = await enqueueCheckinEmail(db, {
    userId: "00000000-0000-4000-8000-000000000001",
    checkInId: "00000000-0000-4000-8000-0000000000a1",
    milestone: "day7",
    kind: "checkin_due",
    idempotencyKey: baseKey,
    recipientMask: "u***@example.com",
    locale: "ko",
    timezone: "Asia/Seoul",
    payload,
  });
  ok(enq1.outcome === "inserted", "enqueue insert");

  const enq2 = await enqueueCheckinEmail(db, {
    userId: "00000000-0000-4000-8000-000000000001",
    checkInId: "00000000-0000-4000-8000-0000000000a1",
    milestone: "day7",
    kind: "checkin_due",
    idempotencyKey: baseKey,
    recipientMask: "u***@example.com",
    locale: "en",
    timezone: "Asia/Seoul",
    templateVersion: "v9",
    payload,
  });
  ok(enq2.outcome === "duplicate", "duplicate enqueue same key");
  ok(enq2.row.id === enq1.row.id, "duplicate returns existing");

  // concurrent claim: held lock prevents duplicate claim of same row
  const rowId = enq1.row.id;
  const claimedWhileLocked = await db.withHeldLock(rowId, async () => {
    return claimCheckinEmailJobs(db, { limit: 5 });
  });
  ok(
    !claimedWhileLocked.some((r) => r.id === rowId),
    "SKIP LOCKED: locked row not claimed"
  );

  const claimed = await claimCheckinEmailJobs(db, { limit: 5 });
  ok(claimed.length === 1 && claimed[0].id === rowId, "claim pending row");
  ok(claimed[0].status === "processing", "claim → processing");

  const secondClaim = await claimCheckinEmailJobs(db, { limit: 5 });
  ok(secondClaim.length === 0, "already processing not re-claimed");

  // retry then fail
  let cur = claimed[0];
  cur = await markCheckinEmailFailed(db, {
    id: cur.id,
    error: "timeout for bob@x.com",
    retryable: true,
    retryCount: cur.retry_count,
  });
  ok(cur.status === "pending", "retry → pending");
  ok(cur.retry_count === 1, "retry_count++");
  ok(!!cur.next_attempt_at, "next_attempt_at set");
  ok(!String(cur.last_error).includes("@"), "last_error sanitized");

  // force due
  cur.next_attempt_at = new Date(Date.now() - 1000).toISOString();
  db.seed(cur);

  for (let i = 0; i < 3; i++) {
    const batch = await claimCheckinEmailJobs(db, { limit: 1 });
    ok(batch.length === 1, `claim retry loop ${i}`);
    cur = await markCheckinEmailFailed(db, {
      id: batch[0].id,
      error: "timeout",
      retryable: true,
      retryCount: batch[0].retry_count,
    });
    if (cur.status === "pending") {
      cur.next_attempt_at = new Date(Date.now() - 1000).toISOString();
      db.seed(cur);
    }
  }
  ok(cur.status === "failed", "max retry → failed");

  // dry-run worker does not call live provider; counting dry provider only
  const dryDb = new FakeCheckinEmailQueueDb();
  const dryKey = buildCheckinEmailIdempotencyKey({
    subjectId: "user-dry",
    checkInId: "ci-dry",
    milestone: "day3",
    kind: "checkin_due",
  });
  await enqueueCheckinEmail(dryDb, {
    userId: "00000000-0000-4000-8000-0000000000d1",
    checkInId: "00000000-0000-4000-8000-0000000000d2",
    milestone: "day3",
    kind: "checkin_due",
    idempotencyKey: dryKey,
    recipientMask: "d***@example.com",
    locale: "ko",
    timezone: "Asia/Seoul",
    payload: {
      ...payload,
      milestone: "day3",
      subjectKey: "email.checkin_due.day3.subject",
      bodyKey: "email.checkin_due.day3.body",
      checkinUrlPath: "/my/check-ins/ci-dry",
    },
  });

  let liveHits = 0;
  const liveLike: EmailProvider = {
    name: "resend",
    async send(_req: EmailSendRequest) {
      liveHits += 1;
      return {
        ok: true,
        messageId: "should-not",
        errorCode: null,
        retryable: false,
      };
    },
  };

  let rejectedLive = false;
  try {
    await runCheckinEmailQueueDryRunWorker({
      db: dryDb,
      provider: liveLike,
    });
  } catch (e) {
    rejectedLive = String(e).includes("dry_run_worker_rejects_live_provider");
  }
  ok(rejectedLive, "dry-run rejects live provider");
  ok(liveHits === 0, "live provider never called");

  const dryResult = await runCheckinEmailQueueDryRunWorker({
    db: dryDb,
    limit: 5,
  });
  ok(dryResult.claimed === 1, "dry-run claimed");
  ok(dryResult.completed === 1, "dry-run completed");
  ok(dryResult.providerCalls === 0, "default dry-run providerCalls 0 (env dry_run)");

  const sentRow = [...dryDb.rows.values()][0];
  ok(sentRow.status === "sent", "dry-run marked sent");
  await markCheckinEmailSent(dryDb, { id: sentRow.id, providerMessageId: "x" });

  console.log(`[checkin-email-queue-persistence] ${checks} checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
