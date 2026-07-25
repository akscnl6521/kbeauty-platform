import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadDotEnvLocal } from "./_loadDotEnvLocal";
import {
  isProductionEmailEnvironment,
  resolveEmailRuntimeEnvironment,
} from "../src/lib/email/provider/emailEnvironment";

loadDotEnvLocal();
import { validateEmailFromAddress } from "../src/lib/email/provider/emailFromAddress";
import {
  evaluateEmailLiveProviderGate,
  isEmailLiveKillSwitchEnabled,
} from "../src/lib/email/provider/emailLiveGate";
import {
  createEmailProviderFromEnv,
  resolveEmailDeliveryMode,
  resolveEmailProviderName,
} from "../src/lib/email/provider/getEmailProvider";
import { normalizeResendError } from "../src/lib/email/provider/normalizeResendError";
import {
  createResendEmailProvider,
  type ResendTransport,
} from "../src/lib/email/provider/resendProvider";
import {
  isRecipientAllowlisted,
  parseRecipientAllowlist,
} from "../src/lib/email/provider/recipientAllowlist";
import { buildCheckinEmailSendRequest } from "../src/lib/retention/buildCheckinEmailPayload";
import type { CheckinEmailQueueItem } from "../src/lib/retention/checkinEmailQueuePolicy";
import {
  LiveSendIdempotencyRegistry,
  processCheckinEmailLive,
} from "../src/lib/retention/processCheckinEmailLive";

const FIXTURE_API_KEY = "re_test_example_only";
const FROM = "K-Beauty Match <care@example.com>";
const ALLOWED = "allowed@example.com";

let fetchCallsToResend = 0;
const originalFetch = globalThis.fetch;

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes("resend.com")) {
    fetchCallsToResend += 1;
    throw new Error("unexpected live fetch to resend.com");
  }
  return originalFetch(input, init);
}) as typeof fetch;

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
    recipientMask: "a***@example.com",
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

function liveEnv(overrides: Record<string, string> = {}) {
  return {
    EMAIL_DELIVERY_MODE: "live",
    EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: FIXTURE_API_KEY,
    EMAIL_FROM_ADDRESS: FROM,
    EMAIL_LIVE_KILL_SWITCH: "true",
    APP_ENV: "preview",
    EMAIL_STAGING_RECIPIENT_ALLOWLIST: ALLOWED,
    ...overrides,
  };
}

function mockTransport(
  handler: (input: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }) => { data?: { id?: string }; error?: unknown }
): ResendTransport {
  return {
    async send(input) {
      return handler(input);
    },
  };
}

async function main() {
  let checks = 0;

  ok(resolveEmailRuntimeEnvironment({}) === "local_test", "default local_test");
  ok(
    resolveEmailRuntimeEnvironment({ VERCEL_ENV: "preview" }) ===
      "preview_staging",
    "vercel preview"
  );
  ok(
    resolveEmailRuntimeEnvironment({ APP_ENV: "staging" }) === "preview_staging",
    "app staging"
  );
  ok(
    resolveEmailRuntimeEnvironment({ APP_ENV: "production" }) === "production",
    "app production"
  );
  ok(isProductionEmailEnvironment({ APP_ENV: "production" }), "prod env flag");
  checks += 1;

  ok(validateEmailFromAddress(FROM).ok === true, "display from ok");
  ok(validateEmailFromAddress("care@example.com").ok === true, "plain from ok");
  ok(!validateEmailFromAddress("bad").ok, "invalid from");
  ok(!validateEmailFromAddress("a@b.com, b@c.com").ok, "multiple from");
  ok(!validateEmailFromAddress("Name\n<care@example.com>").ok, "newline from");
  checks += 1;

  const allow = parseRecipientAllowlist(` ${ALLOWED}, *, @example.com, bad `);
  ok(allow.size === 1 && allow.has(ALLOWED), "allowlist parse");
  ok(isRecipientAllowlisted(ALLOWED, allow), "allowlisted");
  ok(!isRecipientAllowlisted("other@example.com", allow), "not allowlisted");
  ok(!isRecipientAllowlisted(ALLOWED, new Set()), "empty allowlist false");
  checks += 1;

  ok(!isEmailLiveKillSwitchEnabled({ EMAIL_LIVE_KILL_SWITCH: "false" }), "kill off");
  ok(isEmailLiveKillSwitchEnabled({ EMAIL_LIVE_KILL_SWITCH: "TRUE" }), "kill on");
  ok(
    evaluateEmailLiveProviderGate({ EMAIL_DELIVERY_MODE: "dry_run" }).ok ===
      false,
    "gate dry_run blocked"
  );
  ok(
    evaluateEmailLiveProviderGate(liveEnv({ EMAIL_PROVIDER: "none" })).errorCode ===
      "live_mode_blocked",
    "gate non-resend blocked"
  );
  ok(
    evaluateEmailLiveProviderGate(liveEnv({ APP_ENV: "production" }))
      .errorCode === "live_mode_blocked",
    "gate production blocked"
  );
  ok(
    evaluateEmailLiveProviderGate(liveEnv({ EMAIL_LIVE_KILL_SWITCH: "false" }))
      .errorCode === "live_mode_blocked",
    "gate kill switch blocked"
  );
  ok(
    evaluateEmailLiveProviderGate(
      liveEnv({ RESEND_API_KEY: "", EMAIL_LIVE_KILL_SWITCH: "true" })
    ).errorCode === "provider_configuration_missing",
    "gate missing api key"
  );
  ok(
    evaluateEmailLiveProviderGate(
      liveEnv({ EMAIL_FROM_ADDRESS: "", EMAIL_LIVE_KILL_SWITCH: "true" })
    ).errorCode === "provider_configuration_missing",
    "gate missing from"
  );
  ok(evaluateEmailLiveProviderGate(liveEnv()).ok === true, "gate fully open");
  checks += 1;

  ok(
    normalizeResendError(new Error("429 rate limit")).errorCode ===
      "temporary_provider_error",
    "normalize rate limit"
  );
  ok(
    normalizeResendError(new Error("invalid recipient")).errorCode ===
      "invalid_recipient",
    "normalize invalid recipient"
  );
  ok(
    normalizeResendError(new Error("401 unauthorized api key")).errorCode ===
      "provider_configuration_missing",
    "normalize auth"
  );
  ok(
    normalizeResendError(new Error("domain not verified for from")).errorCode ===
      "provider_configuration_missing",
    "normalize from domain"
  );
  ok(
    normalizeResendError(new Error("rejected by provider")).errorCode ===
      "permanent_provider_error",
    "normalize rejection"
  );
  ok(
    normalizeResendError(new Error("something else")).retryable === true,
    "normalize unknown retryable"
  );
  checks += 1;

  const item = sampleItem();
  const built = buildCheckinEmailSendRequest({
    item,
    recipientEmail: ALLOWED,
  });
  ok(built.ok === true, "payload built");
  if (!built.ok) throw new Error("build failed");

  const registry = new LiveSendIdempotencyRegistry();
  const transport = mockTransport(() => ({ data: { id: "msg_mock_123" } }));
  const provider = createResendEmailProvider({
    apiKey: FIXTURE_API_KEY,
    fromAddress: FROM,
    transport,
    registry,
  });

  const success = await provider.send(built.request);
  ok(success.ok === true && success.providerMessageId === "msg_mock_123", "mock send ok");
  ok(success.recipientMask.includes("***"), "recipient masked");
  checks += 1;

  const dup = await provider.send(built.request);
  ok(!dup.ok && dup.errorCode === "duplicate_request", "provider duplicate");
  checks += 1;

  const unsafe = await createResendEmailProvider({
    apiKey: FIXTURE_API_KEY,
    fromAddress: FROM,
    transport,
  }).send({
    ...built.request,
    textBody: "visit https://evil.example.com",
    idempotencyKey: "k-unsafe-live",
  });
  ok(!unsafe.ok && unsafe.errorCode === "unsafe_payload", "unsafe payload blocked");
  checks += 1;

  const tempProvider = createResendEmailProvider({
    apiKey: FIXTURE_API_KEY,
    fromAddress: FROM,
    transport: mockTransport(() => ({
      error: new Error("network timeout"),
    })),
  });
  const tempRes = await tempProvider.send({
    ...built.request,
    idempotencyKey: "k-temp-live",
  });
  ok(
    !tempRes.ok &&
      tempRes.errorCode === "temporary_provider_error" &&
      tempRes.retryable,
    "temporary provider error"
  );
  checks += 1;

  const blockedLive = createEmailProviderFromEnv({ EMAIL_DELIVERY_MODE: "live" });
  const blockedRes = await blockedLive.send(built.request);
  ok(
    !blockedRes.ok && blockedRes.errorCode === "live_mode_blocked",
    "live without config still blocked"
  );
  checks += 1;

  const gatedProvider = createEmailProviderFromEnv(liveEnv(), {
    resendTransport: transport,
    registry: new LiveSendIdempotencyRegistry(),
  });
  ok(gatedProvider.name === "resend", "live resend selected when gated open");
  const gatedSend = await gatedProvider.send({
    ...built.request,
    idempotencyKey: "k-gated-live",
  });
  ok(gatedSend.ok === true, "gated provider mock send");
  checks += 1;

  const prodBlock = await processCheckinEmailLive({
    item,
    recipientEmail: ALLOWED,
    careCheckinConsent: true,
    careEmailChannelConsent: true,
    env: liveEnv({ APP_ENV: "production" }),
    allowlist: allow,
    provider: gatedProvider,
  });
  ok(prodBlock.outcome === "blocked" && prodBlock.reasonCode === "production_blocked", "live prod block");
  checks += 1;

  const notListed = await processCheckinEmailLive({
    item: sampleItem({ idempotencyKey: "k-not-listed" }),
    recipientEmail: "other@example.com",
    careCheckinConsent: true,
    careEmailChannelConsent: true,
    env: liveEnv(),
    provider: gatedProvider,
  });
  ok(
    notListed.outcome === "blocked" &&
      notListed.reasonCode === "recipient_not_allowlisted",
    "allowlist block"
  );
  checks += 1;

  const liveOk = await processCheckinEmailLive({
    item: sampleItem({ idempotencyKey: "k-live-ok" }),
    recipientEmail: ALLOWED,
    careCheckinConsent: true,
    careEmailChannelConsent: true,
    env: liveEnv(),
    provider: createEmailProviderFromEnv(liveEnv(), {
      resendTransport: mockTransport(() => ({ data: { id: "msg_live_ok" } })),
      registry: new LiveSendIdempotencyRegistry(),
    }),
  });
  ok(liveOk.outcome === "live_completed" && liveOk.nextQueueStatus === "sent", "live completed");
  checks += 1;

  const noConsent = await processCheckinEmailLive({
    item,
    recipientEmail: ALLOWED,
    careCheckinConsent: false,
    careEmailChannelConsent: true,
    env: liveEnv(),
    allowlist: allow,
  });
  ok(noConsent.outcome === "blocked" && noConsent.reasonCode === "consent_missing", "live consent");
  checks += 1;

  ok(resolveEmailDeliveryMode({}) === "disabled", "never default live");
  ok(resolveEmailProviderName({}) === "none", "default provider none");
  checks += 1;

  const resendSrc = readFileSync("src/lib/email/provider/resendProvider.ts", "utf8");
  ok(!resendSrc.includes("console.log"), "no console.log in resend provider");
  ok(!resendSrc.includes("Idempotency-Key"), "no fake idempotency header");
  ok(resendSrc.includes("buildInternalMetadata"), "internal metadata only");
  ok(fetchCallsToResend === 0, "no fetch to resend.com");
  checks += 1;

  console.log(`[checkin-email-resend] ${checks} check groups passed`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    globalThis.fetch = originalFetch;
  });
