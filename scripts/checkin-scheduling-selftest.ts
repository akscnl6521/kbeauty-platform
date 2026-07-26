import assert from "node:assert/strict";
import { createCheckInSchedule } from "../src/lib/care/schedule";
import { buildCheckinScheduleIfConsented } from "../src/lib/retention/checkinPolicy";
import {
  buildCheckinEmailIdempotencyKey,
  getRetrySchedule,
} from "../src/lib/retention/checkinEmailQueuePolicy";
import { enqueueCheckinEmail } from "../src/lib/retention/checkinEmailQueuePersistence";
import { FakeCheckinEmailQueueDb } from "../src/lib/retention/fakeCheckinEmailQueueDb";
import { runCheckinEmailQueueDryRunWorker } from "../src/lib/retention/processCheckinEmailQueueDryRunWorker";
import {
  deriveReminderCountFromQueueKeys,
  mapSettingsToEmailConsent,
  orchestrateCheckinScheduling,
  resolveCareNotificationLocale,
} from "../src/lib/retention/checkinSchedulingOrchestrator";
import type { CareCheckIn } from "../src/lib/care/types";
import type { EmailProvider, EmailSendRequest } from "../src/lib/email/provider/types";

let checks = 0;
function ok(cond: boolean, msg: string) {
  assert.equal(cond, true, msg);
  checks += 1;
}

async function main() {

const tz = "Asia/Seoul";
const start = "2026-07-01T01:00:00.000Z";
let n = 0;

// schedule 3/7/15/30
const schedule = createCheckInSchedule({
  analysisSessionId: "an1",
  routineId: "rt1",
  startAt: start,
  timezone: tz,
  idFactory: () => "ci_" + String(++n),
});
ok(schedule.length === 4, "schedule 4 milestones");
ok(
  schedule.map((c) => c.day).join(",") === "3,7,15,30",
  "days 3/7/15/30"
);

// timezone dueAt
ok(
  schedule.every((c) => typeof c.dueAt === "string" && c.dueAt.includes("T")),
  "timezone dueAt iso"
);
ok(
  schedule.every((c) => c.timezone === tz),
  "timezone stamped"
);

const consented = buildCheckinScheduleIfConsented({
  consent: { careCheckinConsent: true },
  analysisSessionId: "an2",
  routineId: null,
  startAt: start,
  timezone: tz,
  idFactory: () => "ci_" + String(++n),
});
ok(consented.length === 4, "consent gate allows");
const blocked = buildCheckinScheduleIfConsented({
  consent: { careCheckinConsent: false },
  analysisSessionId: "an3",
  routineId: null,
  startAt: start,
  timezone: tz,
  idFactory: () => "ci_" + String(++n),
});
ok(blocked.length === 0, "consent gate blocks");

ok(resolveCareNotificationLocale({ locale: "en" }) === "en", "locale en");
ok(resolveCareNotificationLocale({ locale: "ja" }) === "ja", "locale ja");
ok(resolveCareNotificationLocale({}) === "ko", "locale default ko");

const consentMap = mapSettingsToEmailConsent({
  notificationsEnabled: true,
  emailOptIn: true,
  careEmailChannelConsent: false,
  timezone: tz,
  locale: "en",
});
ok(consentMap.marketingConsent === true, "emailOptIn -> marketing");
ok(consentMap.careEmailChannelConsent === false, "care email false");
ok(consentMap.locale === "en", "locale on consent map");

const dueAt = "2026-07-10T00:00:00.000Z";
const dueCheckIn: CareCheckIn = {
  ...schedule[0]!,
  id: "check-due-1",
  status: "due",
  dueAt,
  scheduledFor: dueAt,
};

const nowDue = new Date("2026-07-10T12:00:00.000Z");
const orchDue = orchestrateCheckinScheduling({
  subjectId: "user-1",
  checkIns: [dueCheckIn],
  settings: {
    notificationsEnabled: true,
    emailOptIn: false,
    careEmailChannelConsent: true,
    timezone: tz,
    locale: "ja",
  },
  email: "user@example.com",
  now: nowDue,
  idFactory: () => "nt1",
});
ok(orchDue.items[0]!.inApp.deliver === true, "due -> in-app");
ok(orchDue.items[0]!.emailDue.eligible === true, "due -> email candidate");
ok(orchDue.items[0]!.emailDue.candidate?.locale === "ja", "locale on candidate");
ok(
  orchDue.actions.some((a) => a.type === "enqueue_email" && a.kind === "checkin_due"),
  "enqueue due action"
);
ok(
  orchDue.items[0]!.emailReminder.eligible === false,
  "reminder not ready at due"
);

// 48h one reminder
const nowRem = new Date(Date.parse(dueAt) + 48 * 3600_000 + 60_000);
const orchRem = orchestrateCheckinScheduling({
  subjectId: "user-1",
  checkIns: [dueCheckIn],
  settings: {
    notificationsEnabled: true,
    emailOptIn: false,
    careEmailChannelConsent: true,
    timezone: tz,
    locale: "ko",
  },
  email: "user@example.com",
  now: nowRem,
  existingEmailIdempotencyKeys: [
    buildCheckinEmailIdempotencyKey({
      subjectId: "user-1",
      checkInId: dueCheckIn.id,
      milestone: "day3",
      kind: "checkin_due",
    }),
  ],
});
ok(orchRem.items[0]!.emailReminder.eligible === true, "48h reminder once");
ok(
  orchRem.actions.filter((a) => a.type === "enqueue_email" && a.kind === "checkin_reminder")
    .length === 1,
  "one reminder enqueue"
);

const remKey = buildCheckinEmailIdempotencyKey({
  subjectId: "user-1",
  checkInId: dueCheckIn.id,
  milestone: "day3",
  kind: "checkin_reminder",
});
ok(
  deriveReminderCountFromQueueKeys(dueCheckIn.id, [remKey]) === 1,
  "derive reminder count"
);
const orchRem2 = orchestrateCheckinScheduling({
  subjectId: "user-1",
  checkIns: [dueCheckIn],
  settings: {
    notificationsEnabled: true,
    emailOptIn: false,
    careEmailChannelConsent: true,
    timezone: tz,
  },
  email: "user@example.com",
  now: nowRem,
  existingEmailIdempotencyKeys: [
    buildCheckinEmailIdempotencyKey({
      subjectId: "user-1",
      checkInId: dueCheckIn.id,
      milestone: "day3",
      kind: "checkin_due",
    }),
    remKey,
  ],
});
ok(orchRem2.items[0]!.emailReminder.eligible === false, "no double reminder");
ok(orchRem2.items[0]!.emailDue.reason === "duplicate", "no double due enqueue");

// consent opt-out
const optOut = orchestrateCheckinScheduling({
  subjectId: "user-1",
  checkIns: [dueCheckIn],
  settings: {
    notificationsEnabled: false,
    emailOptIn: false,
    careEmailChannelConsent: false,
    timezone: tz,
  },
  email: "user@example.com",
  now: nowDue,
});
ok(optOut.items[0]!.inApp.deliver === false, "in-app opt-out");
ok(optOut.items[0]!.emailDue.eligible === false, "email opt-out");

// marketing alone does not enable care email
const marketingOnly = mapSettingsToEmailConsent({
  notificationsEnabled: true,
  emailOptIn: true,
  careEmailChannelConsent: false,
  timezone: tz,
});
ok(marketingOnly.careEmailChannelConsent === false, "marketing != care channel");

// idempotency key shape
ok(
  remKey.startsWith("checkin-email:v1:") && remKey.endsWith(":email"),
  "idempotency v1 shape"
);

// retry delays exist
const r0 = getRetrySchedule(0, nowDue);
const r1 = getRetrySchedule(1, nowDue);
const r2 = getRetrySchedule(2, nowDue);
ok(r0.action === "retry" && r0.delayMs === 5 * 60_000, "retry delay 5m");
ok(r1.action === "retry" && r1.delayMs === 30 * 60_000, "retry delay 30m");
ok(r2.action === "retry" && r2.delayMs === 2 * 60 * 60_000, "retry delay 2h");

// dry-run worker still no live send
{
  const dryDb = new FakeCheckinEmailQueueDb();
  const dueKey = buildCheckinEmailIdempotencyKey({
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
    idempotencyKey: dueKey,
    recipientMask: "d***@example.com",
    locale: "ko",
    timezone: tz,
    payload: {
      subjectKey: "email.checkin_due.day3.subject",
      bodyKey: "email.checkin_due.day3.body",
      locale: "ko",
      milestone: "day3",
      kind: "checkin_due",
      checkinUrlPath: "/my/check-ins/ci-dry",
      preferenceUrlPath: "/my/settings",
      scheduledAt: nowDue.toISOString(),
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
  let rejected = false;
  try {
    await runCheckinEmailQueueDryRunWorker({ db: dryDb, provider: liveLike });
  } catch (e) {
    rejected = String(e).includes("dry_run_worker_rejects_live_provider");
  }
  ok(rejected, "dry-run rejects live");
  ok(liveHits === 0, "live never called");
}

// preview test key rejected by persistence
{
  const db = new FakeCheckinEmailQueueDb();
  let rejectedPreview = false;
  try {
    await enqueueCheckinEmail(db, {
      userId: "00000000-0000-4000-8000-0000000000p1",
      checkInId: "00000000-0000-4000-8000-0000000000p2",
      milestone: "day3",
      kind: "checkin_due",
      idempotencyKey: "preview-email-test:user:ci:day3:checkin_due:email",
      recipientMask: "p***@example.com",
      locale: "ko",
      timezone: tz,
      payload: {
        subjectKey: "email.checkin_due.day3.subject",
        bodyKey: "email.checkin_due.day3.body",
        locale: "ko",
        milestone: "day3",
        kind: "checkin_due",
        checkinUrlPath: "/my/check-ins/x",
        preferenceUrlPath: "/my/settings",
        scheduledAt: nowDue.toISOString(),
      },
    });
  } catch (e) {
    rejectedPreview =
      String(e).includes("enqueue_rejects_preview_test_key") ||
      String(e).includes("enqueue_requires_production_idempotency_v1");
  }
  ok(rejectedPreview, "preview test key rejected by persistence");
}

console.log(`[checkin-scheduling] ${checks} checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
