import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { logPreviewTestEmailSend } from "../src/lib/admin/checkinEmailTestAuditLog";
import { maskFromAddressForDisplay } from "../src/lib/admin/maskEmailFromAddress";
import {
  buildPreviewTestIdempotencyKey,
  buildPreviewTestRateLimitKey,
  evaluatePreviewTestSendEnvironment,
  evaluatePreviewTestSendGatesForDisplay,
  InMemoryPreviewEmailRateLimiter,
  isVercelPreviewEnvironment,
  parsePreviewTestSendBody,
  selectFirstAllowlistRecipient,
  type RateLimitStore,
} from "../src/lib/admin/checkinEmailTestSendPolicy";
import {
  handleCheckinEmailTestSend,
} from "../src/lib/admin/checkinEmailTestSendHandler";
import { verifyAdminApiOrigin } from "../src/lib/admin/verifyAdminApiOrigin";
import type { ResendTransport } from "../src/lib/email/provider/resendProvider";
import {
  PREVIEW_EMAIL_TEST_CHECKIN_ID,
  buildPreviewTestCheckinEmailQueueItem,
  buildPreviewTestEmailBanner,
  buildPreviewTestEmailPreview,
  buildPreviewTestEmailSendRequest,
} from "../src/lib/retention/checkinEmailPreviewTestPayload";
import { LiveSendIdempotencyRegistry } from "../src/lib/retention/processCheckinEmailLive";

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

function previewEnv(overrides: Record<string, string> = {}) {
  return {
    VERCEL_ENV: "preview",
    APP_ENV: "preview",
    EMAIL_DELIVERY_MODE: "live",
    EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: FIXTURE_API_KEY,
    EMAIL_FROM_ADDRESS: FROM,
    EMAIL_LIVE_KILL_SWITCH: "true",
    EMAIL_STAGING_RECIPIENT_ALLOWLIST: ALLOWED,
    VERCEL_DEPLOYMENT_ID: "dpl_test",
    ...overrides,
  };
}

function sameOriginHeaders(host = "preview.example.com") {
  return {
    origin: `https://${host}`,
    referer: `https://${host}/admin/care/check-in-email-test`,
    host,
    "content-type": "application/json",
  };
}

function mockTransport(): { transport: ResendTransport; getCalls: () => number } {
  let calls = 0;
  const transport: ResendTransport = {
    async send(input) {
      calls += 1;
      void input;
      return { data: { id: "msg_preview_test_1234567890" } };
    },
  };
  return {
    transport,
    getCalls: () => calls,
  };
}

async function sendOnce(input: {
  env?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string | null | undefined>;
  registry?: LiveSendIdempotencyRegistry;
  rateLimiter?: InMemoryPreviewEmailRateLimiter;
  transport?: ResendTransport;
  now?: Date;
}) {
  const mock = input.transport
    ? { transport: input.transport, getCalls: () => -1 }
    : mockTransport();
  const result = await handleCheckinEmailTestSend({
    env: input.env ?? previewEnv(),
    session: { userId: "admin-user-1" },
    headers: input.headers ?? sameOriginHeaders(),
    body:
      input.body ??
      ({
        milestone: "day7",
        kind: "checkin_due",
        locale: "ko",
        confirm: true,
      } as const),
    now: input.now ?? new Date("2026-07-20T12:00:00.000Z"),
    registry: input.registry ?? new LiveSendIdempotencyRegistry(),
    rateLimiter: input.rateLimiter ?? new InMemoryPreviewEmailRateLimiter(),
    resendTransport: mock.transport,
  });
  return { result, mock };
}

async function main() {
  let checks = 0;
  const check = (cond: boolean, msg: string) => {
    checks += 1;
    ok(cond, msg);
  };

  // Route + client static guards
  const routeSrc = readFileSync(
    "src/app/api/admin/checkin-email/test-send/route.ts",
    "utf8"
  );
  check(routeSrc.includes("withAdminAuth"), "route uses withAdminAuth");
  check(routeSrc.includes("export const POST"), "route exposes POST");
  check(routeSrc.includes("METHOD_NOT_ALLOWED"), "route rejects GET");
  check(!routeSrc.includes("export const GET = withAdminAuth(async (request"), "GET is not main handler");

  const clientSrc = readFileSync(
    "src/app/admin/care/check-in-email-test/CheckInEmailTestClient.tsx",
    "utf8"
  );
  check(
    clientSrc.includes("productionBlocked") && clientSrc.includes("!props.sendEnabled"),
    "client disables send when productionBlocked or !sendEnabled"
  );
  check(
    clientSrc.includes('credentials: "same-origin"') ||
      clientSrc.includes("credentials: 'same-origin'"),
    "client uses same-origin credentials"
  );
  check(clientSrc.includes("confirm: true"), "client sends confirm true only");

  // Origin verification
  check(
    verifyAdminApiOrigin({
      origin: "https://preview.example.com",
      referer: null,
      host: "preview.example.com",
    }),
    "origin matches host"
  );
  check(
    !verifyAdminApiOrigin({ origin: null, referer: null, host: "preview.example.com" }),
    "no origin and no referer blocked"
  );
  check(
    !verifyAdminApiOrigin({
      origin: "https://evil.example.com",
      referer: null,
      host: "preview.example.com",
    }),
    "foreign origin blocked"
  );

  // Mask from
  check(
    maskFromAddressForDisplay("K-Beauty <care@updates.kbeautymatch.com>") ===
      "***@updates.kbeautymatch.com",
    "mask from display name form"
  );

  // Preview payload
  const banner = buildPreviewTestEmailBanner("ko");
  check(banner.includes("Preview"), "ko banner preview");
  check(banner.includes("마케팅"), "ko banner not marketing");
  const preview = buildPreviewTestEmailPreview({
    milestone: "day7",
    kind: "checkin_due",
    locale: "ko",
  });
  check(preview.subject.length > 0 && preview.textBody.includes("7"), "preview copy");
  const item = buildPreviewTestCheckinEmailQueueItem({
    milestone: "day7",
    kind: "checkin_due",
    locale: "ko",
    recipientMask: "a***@example.com",
    idempotencyKey: "preview-email-test:key",
  });
  check(item.checkInId === PREVIEW_EMAIL_TEST_CHECKIN_ID, "preview checkin id");
  const built = buildPreviewTestEmailSendRequest({
    item,
    recipientEmail: ALLOWED,
  });
  check(built.ok && built.request.subject.startsWith("[Preview Test] "), "preview send request subject");
  check(
    built.ok && !/photo|affiliate|sponsored/i.test(built.request.textBody),
    "payload safe"
  );

  // Environment gates
  check(isVercelPreviewEnvironment(previewEnv()), "preview env detect");
  const prodGate = evaluatePreviewTestSendEnvironment(
    previewEnv({ VERCEL_ENV: "production" })
  );
  check(!prodGate.ok && prodGate.httpStatus === 404, "production 404");
  const localGate = evaluatePreviewTestSendEnvironment(
    previewEnv({ VERCEL_ENV: "development" })
  );
  check(!localGate.ok && localGate.code === "preview_only", "non-preview 403");
  check(
    !evaluatePreviewTestSendEnvironment(
      previewEnv({ EMAIL_DELIVERY_MODE: "disabled" })
    ).ok,
    "delivery mode disabled"
  );
  check(
    !evaluatePreviewTestSendEnvironment(previewEnv({ EMAIL_PROVIDER: "dry_run" })).ok,
    "provider not resend"
  );
  check(
    !evaluatePreviewTestSendEnvironment(
      previewEnv({ EMAIL_LIVE_KILL_SWITCH: "false" })
    ).ok,
    "kill switch false"
  );
  check(
    !evaluatePreviewTestSendEnvironment(previewEnv({ RESEND_API_KEY: "" })).ok,
    "missing api key"
  );
  check(
    !evaluatePreviewTestSendEnvironment(previewEnv({ EMAIL_FROM_ADDRESS: "" })).ok,
    "missing from"
  );
  check(
    !evaluatePreviewTestSendEnvironment(
      previewEnv({ EMAIL_STAGING_RECIPIENT_ALLOWLIST: "" })
    ).ok,
    "allowlist empty"
  );
  check(evaluatePreviewTestSendEnvironment(previewEnv()).ok, "valid preview env");

  const displayGates = evaluatePreviewTestSendGatesForDisplay(
    previewEnv({ VERCEL_ENV: "production" })
  );
  check(displayGates.productionBlocked && !displayGates.sendEnabled, "display production blocked");

  // Body parsing
  check(parsePreviewTestSendBody({ milestone: "day7", kind: "checkin_due", locale: "ko", confirm: true }).ok, "valid body");
  check(
    !parsePreviewTestSendBody({ milestone: "day99", kind: "checkin_due", locale: "ko", confirm: true }).ok,
    "invalid milestone"
  );
  check(
    !parsePreviewTestSendBody({ milestone: "day7", kind: "care_alert", locale: "ko", confirm: true }).ok,
    "invalid kind"
  );
  check(
    !parsePreviewTestSendBody({ milestone: "day7", kind: "checkin_due", locale: "fr", confirm: true }).ok,
    "invalid locale"
  );
  check(
    !parsePreviewTestSendBody({ milestone: "day7", kind: "checkin_due", locale: "ko", confirm: false }).ok,
    "confirm required"
  );
  check(
    !parsePreviewTestSendBody({
      milestone: "day7",
      kind: "checkin_due",
      locale: "ko",
      confirm: true,
      recipient: "evil@example.com",
    }).ok,
    "forbidden recipient field"
  );
  check(
    !parsePreviewTestSendBody({
      milestone: "day7",
      kind: "checkin_due",
      locale: "ko",
      confirm: true,
      subject: "hack",
    }).ok,
    "forbidden subject field"
  );

  check(
    selectFirstAllowlistRecipient(new Set(["z@example.com", "a@example.com"])) ===
      "a@example.com",
    "allowlist first sorted"
  );

  const idemKey = buildPreviewTestIdempotencyKey({
    deploymentId: "dpl",
    adminUserId: "admin1",
    milestone: "day7",
    kind: "checkin_due",
    locale: "ko",
    now: new Date("2026-07-20T12:34:56.000Z"),
  });
  check(idemKey.endsWith("2026-07-20T12:34"), "minute bucket idempotency");

  // Handler integration
  const blockedOrigin = await sendOnce({
    headers: {
      origin: "https://evil.example.com",
      referer: null,
      host: "preview.example.com",
      "content-type": "application/json",
    },
  });
  check(blockedOrigin.result.status === 403, "handler blocks foreign origin");

  const prod = await sendOnce({ env: previewEnv({ VERCEL_ENV: "production" }) });
  check(prod.result.status === 404, "handler production blocked");

  const badBody = await sendOnce({
    body: {
      milestone: "day7",
      kind: "checkin_due",
      locale: "ko",
      confirm: true,
      apiKey: "hack",
    },
  });
  check(badBody.result.status === 400, "handler rejects extra apiKey");

  const mock = mockTransport();
  const registry = new LiveSendIdempotencyRegistry();
  const limiter = new InMemoryPreviewEmailRateLimiter();
  const now = new Date("2026-07-20T12:00:00.000Z");

  const first = await handleCheckinEmailTestSend({
    env: previewEnv(),
    session: { userId: "admin-user-1" },
    headers: sameOriginHeaders(),
    body: { milestone: "day7", kind: "checkin_due", locale: "ko", confirm: true },
    now,
    registry,
    rateLimiter: limiter,
    resendTransport: mock.transport,
  });
  check(first.status === 200 && (first.body as { ok: boolean }).ok, "valid preview send success");
  check(mock.getCalls() === 1, "mock transport called once");
  check(fetchCallsToResend === 0, "no resend.com fetch");

  const dup = await handleCheckinEmailTestSend({
    env: previewEnv(),
    session: { userId: "admin-user-1" },
    headers: sameOriginHeaders(),
    body: { milestone: "day7", kind: "checkin_due", locale: "ko", confirm: true },
    now,
    registry,
    rateLimiter: new InMemoryPreviewEmailRateLimiter(),
    resendTransport: mock.transport,
  });
  const dupBody = dup.body as {
    ok: boolean;
    data?: { outcome: string; reasonCode: string; recipientMask: string };
  };
  check(dupBody.ok && dupBody.data?.outcome === "duplicate", "duplicate idempotency");
  check(mock.getCalls() === 1, "duplicate does not call transport again");

  const rateLimiter = new InMemoryPreviewEmailRateLimiter();
  const rateKey = buildPreviewTestRateLimitKey({
    adminUserId: "admin-user-1",
    deploymentId: "dpl_test",
  });
  const t0 = new Date("2026-07-20T12:00:00.000Z");
  rateLimiter.record(rateKey, t0);
  const within60 = rateLimiter.check(rateKey, new Date("2026-07-20T12:00:30.000Z"));
  check(!within60.ok && within60.code === "rate_limit_60s", "60s rate limit");

  class BurstStore implements RateLimitStore {
    private last?: number;
    private times: number[] = [];
    getLastSendAt() {
      return this.last;
    }
    getHourlySendTimes() {
      return this.times;
    }
    setLastSendAt(_key: string, at: number) {
      this.last = at;
    }
    addHourlySendTime(_key: string, at: number) {
      this.times.push(at);
    }
  }
  const burstLimiter = new InMemoryPreviewEmailRateLimiter(new BurstStore());
  const burstKey = "burst";
  const base = new Date("2026-07-20T12:00:00.000Z").getTime();
  for (let i = 0; i < 10; i += 1) {
    burstLimiter.record(burstKey, new Date(base - (10 - i) * 60000));
  }
  const hourlyBlock = burstLimiter.check(burstKey, new Date(base));
  check(!hourlyBlock.ok && hourlyBlock.code === "rate_limit_hourly", "10/hour limit");

  const rateBlocked = await handleCheckinEmailTestSend({
    env: previewEnv(),
    session: { userId: "admin-user-1" },
    headers: sameOriginHeaders(),
    body: { milestone: "day7", kind: "checkin_due", locale: "ko", confirm: true },
    now: new Date("2026-07-20T12:00:10.000Z"),
    registry: new LiveSendIdempotencyRegistry(),
    rateLimiter,
    resendTransport: mock.transport,
  });
  check(rateBlocked.status === 429, "handler enforces rate limit");

  const recipientIgnored = await handleCheckinEmailTestSend({
    env: previewEnv({ EMAIL_STAGING_RECIPIENT_ALLOWLIST: "b@example.com,a@example.com" }),
    session: { userId: "admin-user-2" },
    headers: sameOriginHeaders(),
    body: {
      milestone: "day3",
      kind: "checkin_reminder",
      locale: "en",
      confirm: true,
    },
    now: new Date("2026-07-20T13:00:00.000Z"),
    registry: new LiveSendIdempotencyRegistry(),
    rateLimiter: new InMemoryPreviewEmailRateLimiter(),
    resendTransport: mockTransport().transport,
  });
  const ignoredBody = recipientIgnored.body as {
    ok: boolean;
    data?: { recipientMask: string };
  };
  check(
    ignoredBody.ok && ignoredBody.data?.recipientMask === "a***@example.com",
    "server picks allowlist first sorted"
  );

  let auditLogged = false;
  const originalInfo = console.info;
  console.info = (value?: unknown) => {
    if (typeof value === "string" && value.includes("preview_checkin_email_test_send")) {
      auditLogged = true;
      ok(!value.includes(FIXTURE_API_KEY), "audit log has no api key");
      ok(!value.includes(ALLOWED), "audit log has no full recipient");
    }
    originalInfo(value);
  };
  logPreviewTestEmailSend({
    timestamp: now.toISOString(),
    recipientMask: "a***@example.com",
    milestone: "day7",
    locale: "ko",
    kind: "checkin_due",
    resultCode: "live_ok",
    messageIdPrefix: "msg_prev",
  });
  console.info = originalInfo;
  check(auditLogged, "audit log structured");

  check(checks >= 35, `at least 35 checks (got ${checks})`);
  console.log(`checkin-email-test-api selftest: ok (${checks} checks)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
