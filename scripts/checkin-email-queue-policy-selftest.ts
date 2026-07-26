import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { CareCheckIn } from "../src/lib/care/types";
import {
  applyCheckinEmailSendFailure,
  assertSafeCheckinEmailPayload,
  buildCheckinEmailCandidates,
  buildCheckinEmailIdempotencyKey,
  canTransitionCheckinEmailStatus,
  enqueueCheckinEmailCandidate,
  evaluateCheckinEmailEligibility,
  getRetrySchedule,
  isRetryableCheckinEmailFailure,
  isValidCheckinEmailAddress,
  maskEmailAddress,
  transitionCheckinEmailStatus,
  type CheckinEmailQueueItem,
} from "../src/lib/retention/checkinEmailQueuePolicy";
import {
  getCheckinEmailBody,
  getCheckinEmailDisclaimer,
  getCheckinEmailSubject,
} from "../src/lib/retention/checkinEmailCopy";
import { buildPreviewTestIdempotencyKey } from "../src/lib/admin/checkinEmailTestSendPolicy";

let checks = 0;
function ok(cond: boolean, msg: string) {
  assert.equal(cond, true, msg);
  checks += 1;
}

function baseCheckIn(overrides: Partial<CareCheckIn> = {}): CareCheckIn {
  return {
    id: "ci-day7",
    analysisSessionId: "an1",
    routineId: "rt1",
    day: 7,
    status: "due",
    scheduledFor: "2026-07-08T01:00:00.000Z",
    dueAt: "2026-07-08T01:00:00.000Z",
    completedAt: null,
    timezone: "Asia/Seoul",
    answers: null,
    progressDelta: null,
    referralLevel: "none",
    suggestionIds: [],
    ...overrides,
  };
}

const email = "user@example.com";
const nowDue = new Date("2026-07-10T12:00:00.000Z");
const nowBeforeDue = new Date("2026-07-07T12:00:00.000Z");
const nowReminder = new Date("2026-07-10T02:00:00.000Z"); // 48h after due

// email validation + masking
ok(isValidCheckinEmailAddress("  a@b.co  "), "valid email");
ok(!isValidCheckinEmailAddress("not-an-email"), "invalid no @");
ok(!isValidCheckinEmailAddress("a@b"), "invalid domain no dot");
ok(!isValidCheckinEmailAddress("a b@c.com"), "invalid whitespace");
ok(maskEmailAddress(email) === "u***@example.com", "mask");
ok(maskEmailAddress("bad") === "[invalid]", "mask invalid");

// care + email channel consent -> due candidate
const dueOk = evaluateCheckinEmailEligibility({
  subjectId: "user-1",
  checkIn: baseCheckIn(),
  kind: "checkin_due",
  email,
  careCheckinConsent: true,
  careEmailChannelConsent: true,
  marketingConsent: false,
  notificationsEnabled: true,
  locale: "ko",
  timezone: "Asia/Seoul",
  now: nowDue,
});
ok(dueOk.eligible && dueOk.candidate?.kind === "checkin_due", "due eligible");
ok(
  dueOk.candidate?.subjectKey === "email.checkin_due.day7.subject",
  "subject key"
);
ok(
  dueOk.candidate?.checkinUrlPath === "/my/check-ins/ci-day7",
  "checkin url"
);
ok(dueOk.candidate?.preferenceUrlPath === "/my/settings", "settings url");

// care consent missing
ok(
  evaluateCheckinEmailEligibility({
    subjectId: "user-1",
    checkIn: baseCheckIn(),
    kind: "checkin_due",
    email,
    careCheckinConsent: false,
    careEmailChannelConsent: true,
    marketingConsent: false,
    notificationsEnabled: true,
    locale: "ko",
    timezone: "Asia/Seoul",
    now: nowDue,
  }).reason === "missing_care_consent",
  "no care consent"
);

// email channel missing
ok(
  evaluateCheckinEmailEligibility({
    subjectId: "user-1",
    checkIn: baseCheckIn(),
    kind: "checkin_due",
    email,
    careCheckinConsent: true,
    careEmailChannelConsent: false,
    marketingConsent: false,
    notificationsEnabled: true,
    locale: "ko",
    timezone: "Asia/Seoul",
    now: nowDue,
  }).reason === "missing_email_channel_consent",
  "no email channel"
);

// marketing only
ok(
  evaluateCheckinEmailEligibility({
    subjectId: "user-1",
    checkIn: baseCheckIn(),
    kind: "checkin_due",
    email,
    careCheckinConsent: true,
    careEmailChannelConsent: false,
    marketingConsent: true,
    notificationsEnabled: true,
    locale: "ko",
    timezone: "Asia/Seoul",
    now: nowDue,
  }).reason === "marketing_only_consent",
  "marketing only"
);

// invalid email
ok(
  evaluateCheckinEmailEligibility({
    subjectId: "user-1",
    checkIn: baseCheckIn(),
    kind: "checkin_due",
    email: "nope",
    careCheckinConsent: true,
    careEmailChannelConsent: true,
    marketingConsent: false,
    notificationsEnabled: true,
    locale: "ko",
    timezone: "Asia/Seoul",
    now: nowDue,
  }).reason === "invalid_email",
  "invalid email"
);

// completed check-in
ok(
  evaluateCheckinEmailEligibility({
    subjectId: "user-1",
    checkIn: baseCheckIn({ status: "completed", completedAt: nowDue.toISOString() }),
    kind: "checkin_due",
    email,
    careCheckinConsent: true,
    careEmailChannelConsent: true,
    marketingConsent: false,
    notificationsEnabled: true,
    locale: "ko",
    timezone: "Asia/Seoul",
    now: nowDue,
  }).reason === "checkin_closed",
  "completed closed"
);

// not due yet
ok(
  evaluateCheckinEmailEligibility({
    subjectId: "user-1",
    checkIn: baseCheckIn(),
    kind: "checkin_due",
    email,
    careCheckinConsent: true,
    careEmailChannelConsent: true,
    marketingConsent: false,
    notificationsEnabled: true,
    locale: "ko",
    timezone: "Asia/Seoul",
    now: nowBeforeDue,
  }).reason === "not_due",
  "not due"
);

// reminder after 48h
const remOk = evaluateCheckinEmailEligibility({
  subjectId: "user-1",
  checkIn: baseCheckIn({ status: "due" }),
  kind: "checkin_reminder",
  email,
  careCheckinConsent: true,
  careEmailChannelConsent: true,
  marketingConsent: false,
  notificationsEnabled: true,
  locale: "en",
  timezone: "Asia/Seoul",
  now: nowReminder,
  reminderCount: 0,
});
ok(remOk.eligible && remOk.candidate?.kind === "checkin_reminder", "reminder ok");

// reminderCount >= 1 blocks
ok(
  evaluateCheckinEmailEligibility({
    subjectId: "user-1",
    checkIn: baseCheckIn(),
    kind: "checkin_reminder",
    email,
    careCheckinConsent: true,
    careEmailChannelConsent: true,
    marketingConsent: false,
    notificationsEnabled: true,
    locale: "en",
    timezone: "Asia/Seoul",
    now: nowReminder,
    reminderCount: 1,
  }).reason === "reminder_not_ready",
  "reminder exhausted"
);

// idempotency duplicate
const key = dueOk.candidate!.idempotencyKey;
ok(
  evaluateCheckinEmailEligibility({
    subjectId: "user-1",
    checkIn: baseCheckIn(),
    kind: "checkin_due",
    email,
    careCheckinConsent: true,
    careEmailChannelConsent: true,
    marketingConsent: false,
    notificationsEnabled: true,
    locale: "ko",
    timezone: "Asia/Seoul",
    now: nowDue,
    existingIdempotencyKeys: [key],
  }).reason === "duplicate",
  "duplicate key"
);

// idempotency v1 — exclude scheduleDate / locale / template_version / recipient
const k1 = buildCheckinEmailIdempotencyKey({
  subjectId: " User 1 ",
  checkInId: "CI-Day7",
  milestone: "day7",
  kind: "checkin_due",
});
const k2 = buildCheckinEmailIdempotencyKey({
  subjectId: "user 1",
  checkInId: "ci-day7",
  milestone: "day7",
  kind: "checkin_due",
});
ok(k1 === k2, "idempotency normalize");
ok(
  k1 === "checkin-email:v1:user 1:ci-day7:day7:checkin_due:email",
  "idempotency v1 shape"
);
ok(
  buildCheckinEmailIdempotencyKey({
    subjectId: "user 1",
    checkInId: "ci-day7",
    milestone: "day7",
    kind: "checkin_due",
  }) ===
    buildCheckinEmailIdempotencyKey({
      subjectId: "user 1",
      checkInId: "ci-day7",
      milestone: "day7",
      kind: "checkin_due",
    }),
  "same key ignores scheduleDate absence"
);
ok(
  buildCheckinEmailIdempotencyKey({
    subjectId: "user-1",
    checkInId: "ci-a",
    milestone: "day7",
    kind: "checkin_due",
  }) !==
    buildCheckinEmailIdempotencyKey({
      subjectId: "user-1",
      checkInId: "ci-a",
      milestone: "day7",
      kind: "checkin_reminder",
    }),
  "kind changes key"
);
ok(
  buildCheckinEmailIdempotencyKey({
    subjectId: "user-1",
    checkInId: "ci-a",
    milestone: "day7",
    kind: "checkin_due",
  }) !==
    buildCheckinEmailIdempotencyKey({
      subjectId: "user-1",
      checkInId: "ci-a",
      milestone: "day15",
      kind: "checkin_due",
    }),
  "milestone changes key"
);
ok(
  buildCheckinEmailIdempotencyKey({
    subjectId: "user-1",
    checkInId: "ci-a",
    milestone: "day7",
    kind: "checkin_due",
  }) !==
    buildCheckinEmailIdempotencyKey({
      subjectId: "user-1",
      checkInId: "ci-b",
      milestone: "day7",
      kind: "checkin_due",
    }),
  "checkin_id changes key"
);
ok(!k1.startsWith("preview-email-test"), "production key not preview prefix");

// alert suppressed
ok(
  evaluateCheckinEmailEligibility({
    subjectId: "user-1",
    checkIn: baseCheckIn(),
    kind: "checkin_due",
    email,
    careCheckinConsent: true,
    careEmailChannelConsent: true,
    marketingConsent: false,
    notificationsEnabled: true,
    locale: "ko",
    timezone: "Asia/Seoul",
    now: nowDue,
    alertSuppressed: true,
  }).reason === "alert_suppressed",
  "alert suppressed"
);

// build candidates accumulates keys
const built = buildCheckinEmailCandidates({
  subjectId: "user-1",
  checkIns: [baseCheckIn()],
  email,
  careCheckinConsent: true,
  careEmailChannelConsent: true,
  marketingConsent: false,
  notificationsEnabled: true,
  locale: "ko",
  timezone: "Asia/Seoul",
  now: nowReminder,
  reminderCountByCheckInId: { "ci-day7": 0 },
});
ok(built.candidates.length === 2, "due+reminder candidates");
ok(
  new Set(built.candidates.map((c) => c.idempotencyKey)).size === 2,
  "unique keys"
);

// enqueue stores mask only
const item = enqueueCheckinEmailCandidate({
  candidate: dueOk.candidate!,
  id: "q1",
  now: nowDue,
});
ok(item.status === "pending", "enqueue pending");
ok(item.recipientMask === "u***@example.com", "mask stored");
ok(!JSON.stringify(item).includes(email), "no raw email in item");
assertSafeCheckinEmailPayload(item.payload);
ok(true, "safe payload");

// unsafe payload rejected
let unsafeCaught = false;
try {
  assertSafeCheckinEmailPayload({
    ...item.payload,
    photoUrl: "https://example.com/face.jpg",
  } as never);
} catch {
  unsafeCaught = true;
}
ok(unsafeCaught, "reject photo payload");

let acuteCaught = false;
try {
  assertSafeCheckinEmailPayload({
    subjectKey: "x",
    bodyKey: "acuteSignals present",
    locale: "ko",
    milestone: "day7",
    kind: "checkin_due",
    checkinUrlPath: "/my/check-ins/x",
    preferenceUrlPath: "/my/settings",
    scheduledAt: nowDue.toISOString(),
  });
} catch {
  acuteCaught = true;
}
ok(acuteCaught, "reject acute content");

// status transitions
ok(canTransitionCheckinEmailStatus("pending", "scheduled"), "pending->scheduled");
ok(!canTransitionCheckinEmailStatus("sent", "failed"), "sent terminal");
ok(!canTransitionCheckinEmailStatus("pending", "sending"), "pending not to sending");

let q: CheckinEmailQueueItem = item;
q = transitionCheckinEmailStatus(q, "scheduled", nowDue);
q = transitionCheckinEmailStatus(q, "sending", nowDue);
q = transitionCheckinEmailStatus(q, "sent", nowDue);
ok(q.status === "sent" && q.sentAt != null, "happy path sent");

let bad = false;
try {
  transitionCheckinEmailStatus(q, "failed", nowDue);
} catch {
  bad = true;
}
ok(bad, "reject invalid transition");

// retryable / permanent
ok(isRetryableCheckinEmailFailure("timeout"), "timeout retryable");
ok(!isRetryableCheckinEmailFailure("invalid_email"), "invalid not retryable");

const s0 = getRetrySchedule(0, nowDue);
ok(s0.action === "retry" && s0.delayMs === 5 * 60_000, "retry 5m");
const s1 = getRetrySchedule(1, nowDue);
ok(s1.action === "retry" && s1.delayMs === 30 * 60_000, "retry 30m");
const s2 = getRetrySchedule(2, nowDue);
ok(s2.action === "retry" && s2.delayMs === 2 * 60 * 60_000, "retry 2h");
ok(getRetrySchedule(3, nowDue).action === "dead_letter", "dead letter after 3");

const sending: CheckinEmailQueueItem = {
  ...item,
  status: "sending",
  attemptCount: 0,
};
const retried = applyCheckinEmailSendFailure(sending, "timeout", nowDue);
ok(retried.status === "retry_scheduled", "temp -> retry_scheduled");
ok(retried.attemptCount === 1, "attempt bumped");
ok(retried.nextAttemptAt != null, "nextAttemptAt set");

const permanent = applyCheckinEmailSendFailure(
  { ...item, status: "sending", attemptCount: 0 },
  "user_unsubscribed",
  nowDue
);
ok(permanent.status === "suppressed", "permanent -> suppressed");

const exhausted = applyCheckinEmailSendFailure(
  { ...item, status: "sending", attemptCount: 3 },
  "rate_limited",
  nowDue
);
ok(exhausted.status === "dead_letter", "max retry -> dead_letter");

const rejected = applyCheckinEmailSendFailure(
  { ...item, status: "sending", attemptCount: 0 },
  "permanent_rejection",
  nowDue
);
ok(rejected.status === "dead_letter", "permanent_rejection -> dead_letter");

// copy labels
ok(getCheckinEmailSubject("due", "day7", "ko").includes("7"), "ko subject");
ok(getCheckinEmailBody("reminder", "day3", "en").includes("48"), "en reminder");
ok(
  getCheckinEmailDisclaimer("ko").includes("\uB9C8\uCF00\uD305") ||
    getCheckinEmailDisclaimer("en").toLowerCase().includes("marketing"),
  "disclaimer not marketing"
);

// organic / affiliate untouched (static)
const policySrc = readFileSync(
  "src/lib/retention/checkinEmailQueuePolicy.ts",
  "utf8"
);
ok(!/rankProducts|MATCH_WEIGHT|affiliate|sponsored/i.test(policySrc), "no rank/affiliate");
ok(!/resend|sendgrid|ses\.amazonaws|nodemailer/i.test(policySrc), "no provider");

const previewKey = buildPreviewTestIdempotencyKey({
  deploymentId: "d1",
  adminUserId: "admin-1",
  milestone: "day7",
  kind: "checkin_due",
  locale: "ko",
  now: nowDue,
});
ok(previewKey.startsWith("preview-email-test:"), "preview key prefix");
ok(
  previewKey !==
    buildCheckinEmailIdempotencyKey({
      subjectId: "admin-1",
      checkInId: "preview-email-test",
      milestone: "day7",
      kind: "checkin_due",
    }),
  "preview key != production queue key"
);

console.log(`[checkin-email-queue] ${checks} checks passed`);
