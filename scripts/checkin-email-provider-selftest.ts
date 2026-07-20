import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDisabledEmailProvider } from "../src/lib/email/provider/disabledProvider";
import {
  createDryRunEmailProvider,
  DryRunIdempotencyRegistry,
} from "../src/lib/email/provider/dryRunProvider";
import {
  createEmailProviderFromEnv,
  resolveEmailDeliveryMode,
} from "../src/lib/email/provider/getEmailProvider";
import {
  buildCheckinEmailSendRequest,
  isSafeCheckinUrlPath,
  isSafePreferenceUrlPath,
} from "../src/lib/retention/buildCheckinEmailPayload";
import { processCheckinEmailDryRun } from "../src/lib/retention/processCheckinEmailDryRun";
import type { CheckinEmailQueueItem } from "../src/lib/retention/checkinEmailQueuePolicy";
import { maskEmailAddress } from "../src/lib/retention/checkinEmailQueuePolicy";

function ok(cond: boolean, msg: string) {
  assert.equal(cond, true, msg);
}

function sampleItem(
  overrides: Partial<CheckinEmailQueueItem> = {}
): CheckinEmailQueueItem {
  const now = "2026-07-20T12:00:00.000Z";
  return {
    id: "q1",
    subjectId: "user1",
    checkInId: "ci_day7",
    milestone: "day7",
    kind: "checkin_due",
    recipientMask: "u***@example.com",
    locale: "ko",
    timezone: "Asia/Seoul",
    status: "pending",
    attemptCount: 0,
    nextAttemptAt: now,
    lastErrorCode: null,
    idempotencyKey: "checkin-email:user1:ci_day7:day7:checkin_due:2026-07-20",
    payload: {
      subjectKey: "email.checkin_due.day7.subject",
      bodyKey: "email.checkin_due.day7.body",
      locale: "ko",
      milestone: "day7",
      kind: "checkin_due",
      checkinUrlPath: "/my/check-ins/ci_day7",
      preferenceUrlPath: "/my/settings",
      scheduledAt: now,
    },
    createdAt: now,
    updatedAt: now,
    scheduledAt: now,
    sentAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

async function main() {
  let checks = 0;

  ok(resolveEmailDeliveryMode({}) === "disabled", "env unset → disabled");
  checks += 1;

  const disabled = createDisabledEmailProvider();
  const disabledResult = await disabled.send({
    to: "user@example.com",
    subject: "t",
    textBody: "b",
    locale: "ko",
    idempotencyKey: "k1",
    metadata: {
      kind: "checkin_due",
      milestone: "day7",
      checkInId: "ci",
      checkinUrlPath: "/my/check-ins/ci",
      preferenceUrlPath: "/my/settings",
    },
  });
  ok(!disabledResult.ok && disabledResult.errorCode === "provider_disabled", "disabled no send");
  checks += 1;

  ok(
    resolveEmailDeliveryMode({ EMAIL_DELIVERY_MODE: "dry_run" }) === "dry_run",
    "dry_run mode"
  );
  ok(
    createEmailProviderFromEnv({ EMAIL_DELIVERY_MODE: "dry_run" }).mode ===
      "dry_run",
    "dry_run provider selected"
  );
  checks += 1;

  const live = createEmailProviderFromEnv({ EMAIL_DELIVERY_MODE: "live" });
  const liveRes = await live.send({
    to: "user@example.com",
    subject: "t",
    textBody: "b",
    locale: "en",
    idempotencyKey: "live1",
    metadata: {
      kind: "checkin_due",
      milestone: "day3",
      checkInId: "ci",
      checkinUrlPath: "/my/check-ins/ci",
      preferenceUrlPath: "/my/settings",
    },
  });
  ok(!liveRes.ok && liveRes.errorCode === "live_mode_blocked", "live blocked");
  checks += 1;

  const registry = new DryRunIdempotencyRegistry();
  const item = sampleItem();
  const built = buildCheckinEmailSendRequest({
    item,
    recipientEmail: "user@example.com",
  });
  ok(built.ok === true, "payload build ok");
  if (!built.ok) throw new Error("build failed");
  ok(!/photo|affiliate|sponsored|https?:\/\//i.test(built.request.textBody), "safe body");
  ok(built.request.metadata.preferenceUrlPath === "/my/settings", "preference url");
  checks += 1;

  const dry = await processCheckinEmailDryRun({
    item,
    recipientEmail: "user@example.com",
    careCheckinConsent: true,
    careEmailChannelConsent: true,
    notificationsEnabled: true,
    registry,
  });
  ok(dry.outcome === "dry_run_completed", "valid → dry_run_completed");
  ok(dry.nextQueueStatus === "sent", "next status sent");
  checks += 1;

  const noConsent = await processCheckinEmailDryRun({
    item: sampleItem({ idempotencyKey: "k-noconsent" }),
    recipientEmail: "user@example.com",
    careCheckinConsent: false,
    careEmailChannelConsent: true,
  });
  ok(noConsent.outcome === "blocked" && noConsent.reasonCode === "consent_missing", "no care consent");
  checks += 1;

  const marketingOnly = await processCheckinEmailDryRun({
    item: sampleItem({ idempotencyKey: "k-mkt" }),
    recipientEmail: "user@example.com",
    careCheckinConsent: true,
    careEmailChannelConsent: false,
    marketingConsent: true,
  });
  ok(
    marketingOnly.outcome === "blocked" &&
      marketingOnly.reasonCode === "marketing_only_consent",
    "marketing only blocked"
  );
  checks += 1;

  const badEmail = await processCheckinEmailDryRun({
    item: sampleItem({ idempotencyKey: "k-bademail" }),
    recipientEmail: "not-an-email",
    careCheckinConsent: true,
    careEmailChannelConsent: true,
  });
  ok(badEmail.outcome === "blocked", "invalid email blocked");
  checks += 1;

  const already = await processCheckinEmailDryRun({
    item: sampleItem({ status: "sent", idempotencyKey: "k-sent" }),
    recipientEmail: "user@example.com",
    careCheckinConsent: true,
    careEmailChannelConsent: true,
  });
  ok(already.outcome === "blocked" && already.reasonCode === "already_processed", "sent blocked");
  checks += 1;

  const dup = await processCheckinEmailDryRun({
    item,
    recipientEmail: "user@example.com",
    careCheckinConsent: true,
    careEmailChannelConsent: true,
    registry,
  });
  ok(dup.outcome === "duplicate", "duplicate idempotency");
  checks += 1;

  const mask = maskEmailAddress("user@example.com");
  ok(mask.includes("***") && !mask.includes("user@example.com"), "email masked");
  checks += 1;

  ok(isSafeCheckinUrlPath("/my/check-ins/ci_day7"), "safe checkin path");
  ok(!isSafeCheckinUrlPath("https://evil.example/x"), "reject external");
  ok(!isSafeCheckinUrlPath("javascript:alert(1)"), "reject javascript");
  ok(isSafePreferenceUrlPath("/my/settings"), "safe preference");
  ok(!isSafePreferenceUrlPath("https://evil.example/settings"), "reject pref external");
  checks += 1;

  const unsafeBuild = buildCheckinEmailSendRequest({
    item: sampleItem({
      payload: {
        ...sampleItem().payload,
        checkinUrlPath: "https://evil.example/hack",
      },
      idempotencyKey: "k-unsafe-url",
    }),
    recipientEmail: "user@example.com",
  });
  ok(!unsafeBuild.ok && unsafeBuild.errorCode === "unsafe_payload", "unsafe url rejected");
  checks += 1;

  for (const locale of ["ko", "en", "ja"] as const) {
    const b = buildCheckinEmailSendRequest({
      item: sampleItem({
        locale,
        payload: { ...sampleItem().payload, locale },
        idempotencyKey: `k-loc-${locale}`,
      }),
      recipientEmail: "user@example.com",
    });
    ok(b.ok === true, `locale ${locale}`);
    if (b.ok) {
      ok(b.request.subject.length > 0 && b.request.textBody.length > 0, `${locale} content`);
      ok(!/sale|할인|sponsor/i.test(b.request.subject), `${locale} no marketing subject`);
    }
  }
  checks += 1;

  const tempProvider = createDryRunEmailProvider({
    registry: new DryRunIdempotencyRegistry(),
    simulateTemporaryFailureOnce: true,
  });
  const temp1 = await tempProvider.send(built.request);
  ok(
    !temp1.ok &&
      temp1.errorCode === "temporary_provider_error" &&
      temp1.retryable === true,
    "temporary retryable"
  );
  const temp2 = await tempProvider.send({
    ...built.request,
    idempotencyKey: "k-temp-2",
  });
  ok(temp2.ok === true, "temporary then success");
  checks += 1;

  const perm = await createDryRunEmailProvider().send({
    ...built.request,
    to: "bad",
    idempotencyKey: "k-perm",
  });
  ok(!perm.ok && perm.retryable === false, "permanent no retry");
  checks += 1;

  const policySrc = readFileSync("src/lib/email/provider/dryRunProvider.ts", "utf8");
  const getSrc = readFileSync("src/lib/email/provider/getEmailProvider.ts", "utf8");
  const typesSrc = readFileSync("src/lib/email/provider/types.ts", "utf8");
  ok(!/from ['\"]resend['\"]|@sendgrid|@aws-sdk\/client-ses|nodemailer/i.test(policySrc + getSrc + typesSrc), "no live SDK");
  ok(!getSrc.includes("fetch(") && !policySrc.includes("fetch("), "no fetch");
  checks += 1;

  console.log(`[checkin-email-provider] ${checks} checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
