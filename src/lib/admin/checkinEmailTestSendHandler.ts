/**
 * Preview-only admin check-in email test send handler (testable, no route deps).
 */

import { logPreviewTestEmailSend } from "@/lib/admin/checkinEmailTestAuditLog";
import {
  buildPreviewTestIdempotencyKey,
  buildPreviewTestRateLimitKey,
  evaluatePreviewTestSendEnvironment,
  InMemoryPreviewEmailRateLimiter,
  parsePreviewTestSendBody,
  selectFirstAllowlistRecipient,
} from "@/lib/admin/checkinEmailTestSendPolicy";
import { verifyAdminApiOrigin } from "@/lib/admin/verifyAdminApiOrigin";
import { createEmailProviderFromEnv } from "@/lib/email/provider/getEmailProvider";
import { parseRecipientAllowlist } from "@/lib/email/provider/recipientAllowlist";
import type { ResendTransport } from "@/lib/email/provider/resendProvider";
import type { EmailProvider } from "@/lib/email/provider/types";
import { maskEmailAddress } from "@/lib/retention/checkinEmailQueuePolicy";
import {
  buildPreviewTestCheckinEmailQueueItem,
  buildPreviewTestEmailSendRequest,
} from "@/lib/retention/checkinEmailPreviewTestPayload";
import {
  LiveSendIdempotencyRegistry,
  processCheckinEmailLive,
} from "@/lib/retention/processCheckinEmailLive";

export const previewEmailTestRegistry = new LiveSendIdempotencyRegistry();
export const previewEmailTestRateLimiter = new InMemoryPreviewEmailRateLimiter();

function messageIdPrefix(messageId: string | null | undefined): string | undefined {
  if (!messageId?.trim()) return undefined;
  return messageId.trim().slice(0, 8);
}

function fail(status: number, code: string, message: string) {
  return {
    status,
    body: { ok: false as const, error: { code, message } },
  };
}

function success(data: {
  outcome: string;
  reasonCode: string;
  recipientMask: string;
  providerMessageIdPrefix?: string;
}) {
  return {
    status: 200,
    body: { ok: true as const, data },
  };
}

export async function handleCheckinEmailTestSend(input: {
  env: Record<string, string | undefined>;
  session: { userId: string };
  headers: Record<string, string | undefined | null>;
  body: unknown;
  now?: Date;
  registry?: LiveSendIdempotencyRegistry;
  rateLimiter?: InMemoryPreviewEmailRateLimiter;
  resendTransport?: ResendTransport;
}): Promise<{ status: number; body: object }> {
  const now = input.now ?? new Date();
  const contentType = (input.headers["content-type"] ?? "")
    .trim()
    .toLowerCase();
  if (!contentType.includes("application/json")) {
    return fail(415, "INVALID_CONTENT_TYPE", "Content-Type must be application/json.");
  }

  if (
    !verifyAdminApiOrigin({
      origin: input.headers.origin,
      referer: input.headers.referer,
      host: input.headers.host,
    })
  ) {
    return fail(403, "ORIGIN_BLOCKED", "Same-origin request required.");
  }

  const envGate = evaluatePreviewTestSendEnvironment(input.env);
  if (!envGate.ok) {
    return fail(envGate.httpStatus, envGate.code, envGate.code);
  }

  const parsed = parsePreviewTestSendBody(input.body);
  if (!parsed.ok) {
    return fail(400, parsed.code, parsed.code);
  }

  const deploymentId =
    (input.env.VERCEL_DEPLOYMENT_ID ?? "").trim() || "local";
  const rateLimitKey = buildPreviewTestRateLimitKey({
    adminUserId: input.session.userId,
    deploymentId,
  });
  const limiter = input.rateLimiter ?? previewEmailTestRateLimiter;
  const rateCheck = limiter.check(rateLimitKey, now);
  if (!rateCheck.ok) {
    return fail(429, rateCheck.code, rateCheck.code);
  }

  const allowlist = parseRecipientAllowlist(
    input.env.EMAIL_STAGING_RECIPIENT_ALLOWLIST
  );
  const recipientEmail = selectFirstAllowlistRecipient(allowlist);
  if (!recipientEmail) {
    return fail(403, "allowlist_empty", "allowlist_empty");
  }

  const recipientMask = maskEmailAddress(recipientEmail);
  const idempotencyKey = buildPreviewTestIdempotencyKey({
    deploymentId,
    adminUserId: input.session.userId,
    milestone: parsed.value.milestone,
    kind: parsed.value.kind,
    locale: parsed.value.locale,
    now,
  });

  const item = buildPreviewTestCheckinEmailQueueItem({
    milestone: parsed.value.milestone,
    kind: parsed.value.kind,
    locale: parsed.value.locale,
    recipientMask,
    idempotencyKey,
    now,
  });

  const registry = input.registry ?? previewEmailTestRegistry;
  const innerProvider = createEmailProviderFromEnv(input.env, {
    registry,
    resendTransport: input.resendTransport,
  });
  const provider: EmailProvider = {
    name: innerProvider.name,
    mode: innerProvider.mode,
    async send(request) {
      const previewBuilt = buildPreviewTestEmailSendRequest({
        item,
        recipientEmail: request.to,
      });
      if (!previewBuilt.ok) {
        return {
          ok: false,
          mode: "live",
          errorCode: "invalid_request",
          retryable: false,
          recipientMask: maskEmailAddress(request.to),
        };
      }
      return innerProvider.send(previewBuilt.request);
    },
  };

  const liveResult = await processCheckinEmailLive({
    item,
    recipientEmail,
    careCheckinConsent: true,
    careEmailChannelConsent: true,
    marketingConsent: false,
    notificationsEnabled: true,
    env: input.env,
    provider,
    registry,
    allowlist,
  });

  const providerMessageId =
    liveResult.providerResult?.ok === true
      ? liveResult.providerResult.providerMessageId
      : null;
  const providerMessageIdPrefix = messageIdPrefix(providerMessageId);

  logPreviewTestEmailSend({
    timestamp: now.toISOString(),
    recipientMask,
    milestone: parsed.value.milestone,
    locale: parsed.value.locale,
    kind: parsed.value.kind,
    resultCode: liveResult.reasonCode,
    messageIdPrefix: providerMessageIdPrefix,
  });

  if (liveResult.outcome === "live_completed") {
    limiter.record(rateLimitKey, now);
    return success({
      outcome: liveResult.outcome,
      reasonCode: liveResult.reasonCode,
      recipientMask,
      providerMessageIdPrefix,
    });
  }

  if (liveResult.outcome === "duplicate") {
    return success({
      outcome: liveResult.outcome,
      reasonCode: liveResult.reasonCode,
      recipientMask,
      providerMessageIdPrefix,
    });
  }

  if (liveResult.outcome === "blocked" || liveResult.outcome === "suppressed") {
    return fail(403, liveResult.reasonCode, liveResult.reasonCode);
  }

  return fail(502, liveResult.reasonCode, liveResult.reasonCode);
}
