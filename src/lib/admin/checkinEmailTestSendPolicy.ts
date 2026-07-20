/**
 * Pure policy for Preview-only admin check-in email test sends.
 */

import { validateEmailFromAddress } from "@/lib/email/provider/emailFromAddress";
import { isEmailLiveKillSwitchEnabled } from "@/lib/email/provider/emailLiveGate";
import { parseRecipientAllowlist } from "@/lib/email/provider/recipientAllowlist";
import { isValidCheckinEmailAddress } from "@/lib/retention/checkinEmailQueuePolicy";
import type { CheckinLocale, CheckinMilestone } from "@/lib/retention/checkinPolicy";
import type { PreviewTestEmailKind } from "@/lib/retention/checkinEmailPreviewTestPayload";

const MILESTONES = new Set<CheckinMilestone>([
  "day3",
  "day7",
  "day15",
  "day30",
]);
const KINDS = new Set<PreviewTestEmailKind>(["checkin_due", "checkin_reminder"]);
const LOCALES = new Set<CheckinLocale>(["ko", "en", "ja"]);

const ALLOWED_BODY_KEYS = new Set([
  "milestone",
  "kind",
  "locale",
  "confirm",
  "confirmationToken",
]);

const REJECTED_BODY_KEYS = new Set([
  "recipient",
  "from",
  "subject",
  "textBody",
  "apiKey",
  "provider",
  "deliveryMode",
]);

export type PreviewTestSendBody = {
  milestone: CheckinMilestone;
  kind: PreviewTestEmailKind;
  locale: CheckinLocale;
};

export function isVercelPreviewEnvironment(
  env: Record<string, string | undefined>
): boolean {
  return (env.VERCEL_ENV ?? "").trim().toLowerCase() === "preview";
}

export function evaluatePreviewTestSendEnvironment(
  env: Record<string, string | undefined>
):
  | { ok: true }
  | { ok: false; code: string; httpStatus: 403 | 404 } {
  const vercelEnv = (env.VERCEL_ENV ?? "").trim().toLowerCase();
  const appEnv = (env.APP_ENV ?? "").trim().toLowerCase();

  if (vercelEnv === "production" || appEnv === "production") {
    return { ok: false, code: "production_blocked", httpStatus: 404 };
  }

  if (!isVercelPreviewEnvironment(env)) {
    return { ok: false, code: "preview_only", httpStatus: 403 };
  }

  const mode = (env.EMAIL_DELIVERY_MODE ?? "").trim().toLowerCase();
  if (mode !== "live") {
    return { ok: false, code: "delivery_mode_not_live", httpStatus: 403 };
  }

  const provider = (env.EMAIL_PROVIDER ?? "").trim().toLowerCase();
  if (provider !== "resend") {
    return { ok: false, code: "provider_not_resend", httpStatus: 403 };
  }

  if (!isEmailLiveKillSwitchEnabled(env)) {
    return { ok: false, code: "kill_switch_disabled", httpStatus: 403 };
  }

  const apiKey = (env.RESEND_API_KEY ?? "").trim();
  if (!apiKey) {
    return { ok: false, code: "missing_api_key", httpStatus: 403 };
  }

  const fromResult = validateEmailFromAddress(env.EMAIL_FROM_ADDRESS);
  if (!fromResult.ok) {
    return { ok: false, code: "invalid_from_address", httpStatus: 403 };
  }

  const allowlist = parseRecipientAllowlist(env.EMAIL_STAGING_RECIPIENT_ALLOWLIST);
  if (allowlist.size === 0) {
    return { ok: false, code: "allowlist_empty", httpStatus: 403 };
  }

  return { ok: true };
}

export function parsePreviewTestSendBody(
  body: unknown
):
  | { ok: true; value: PreviewTestSendBody }
  | { ok: false; code: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, code: "invalid_body" };
  }

  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);

  for (const key of keys) {
    if (REJECTED_BODY_KEYS.has(key)) {
      return { ok: false, code: "forbidden_field" };
    }
    if (!ALLOWED_BODY_KEYS.has(key)) {
      return { ok: false, code: "extra_field" };
    }
  }

  const confirm = record.confirm;
  const confirmationToken = record.confirmationToken;
  const confirmed =
    confirm === true ||
    (typeof confirmationToken === "string" && confirmationToken.trim().length > 0);
  if (!confirmed) {
    return { ok: false, code: "confirmation_required" };
  }

  const milestone = record.milestone;
  if (typeof milestone !== "string" || !MILESTONES.has(milestone as CheckinMilestone)) {
    return { ok: false, code: "invalid_milestone" };
  }

  const kind = record.kind;
  if (typeof kind !== "string" || !KINDS.has(kind as PreviewTestEmailKind)) {
    return { ok: false, code: "invalid_kind" };
  }

  const locale = record.locale;
  if (typeof locale !== "string" || !LOCALES.has(locale as CheckinLocale)) {
    return { ok: false, code: "invalid_locale" };
  }

  return {
    ok: true,
    value: {
      milestone: milestone as CheckinMilestone,
      kind: kind as PreviewTestEmailKind,
      locale: locale as CheckinLocale,
    },
  };
}

export function selectFirstAllowlistRecipient(allowlist: Set<string>): string | null {
  const sorted = [...allowlist].sort((a, b) => a.localeCompare(b));
  for (const email of sorted) {
    if (isValidCheckinEmailAddress(email)) {
      return email;
    }
  }
  return null;
}

export function buildPreviewTestIdempotencyKey(input: {
  deploymentId: string;
  adminUserId: string;
  milestone: CheckinMilestone;
  kind: PreviewTestEmailKind;
  locale: CheckinLocale;
  now: Date;
}): string {
  const minuteBucket = input.now.toISOString().slice(0, 16);
  return [
    "preview-email-test",
    input.deploymentId,
    input.adminUserId,
    input.milestone,
    input.kind,
    input.locale,
    minuteBucket,
  ].join(":");
}

export interface RateLimitStore {
  getLastSendAt(key: string): number | undefined;
  getHourlySendTimes(key: string): number[];
  setLastSendAt(key: string, at: number): void;
  addHourlySendTime(key: string, at: number): void;
}

class InMemoryRateLimitStore implements RateLimitStore {
  private lastSendAt = new Map<string, number>();
  private hourlySends = new Map<string, number[]>();

  getLastSendAt(key: string): number | undefined {
    return this.lastSendAt.get(key);
  }

  getHourlySendTimes(key: string): number[] {
    return this.hourlySends.get(key) ?? [];
  }

  setLastSendAt(key: string, at: number): void {
    this.lastSendAt.set(key, at);
  }

  addHourlySendTime(key: string, at: number): void {
    const existing = this.hourlySends.get(key) ?? [];
    existing.push(at);
    this.hourlySends.set(key, existing);
  }
}

const MIN_INTERVAL_MS = 60_000;
const MAX_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

export class InMemoryPreviewEmailRateLimiter {
  constructor(private readonly store: RateLimitStore = new InMemoryRateLimitStore()) {}

  check(
    rateLimitKey: string,
    now: Date = new Date()
  ): { ok: true } | { ok: false; code: string } {
    const at = now.getTime();
    const last = this.store.getLastSendAt(rateLimitKey);
    if (last !== undefined && at - last < MIN_INTERVAL_MS) {
      return { ok: false, code: "rate_limit_60s" };
    }

    const hourStart = at - HOUR_MS;
    const recent = this.store
      .getHourlySendTimes(rateLimitKey)
      .filter((ts) => ts >= hourStart);
    if (recent.length >= MAX_PER_HOUR) {
      return { ok: false, code: "rate_limit_hourly" };
    }

    return { ok: true };
  }

  record(rateLimitKey: string, now: Date = new Date()): void {
    const at = now.getTime();
    this.store.setLastSendAt(rateLimitKey, at);
    this.store.addHourlySendTime(rateLimitKey, at);
  }
}

export function buildPreviewTestRateLimitKey(input: {
  adminUserId: string;
  deploymentId: string;
}): string {
  return `${input.adminUserId}:${input.deploymentId}`;
}

export function evaluatePreviewTestSendGatesForDisplay(
  env: Record<string, string | undefined>
): { sendEnabled: boolean; productionBlocked: boolean; previewOnly: boolean } {
  const productionBlocked =
    (env.VERCEL_ENV ?? "").trim().toLowerCase() === "production" ||
    (env.APP_ENV ?? "").trim().toLowerCase() === "production";
  const previewOnly = isVercelPreviewEnvironment(env);
  const gate = evaluatePreviewTestSendEnvironment(env);
  return {
    sendEnabled: !productionBlocked && previewOnly && gate.ok,
    productionBlocked,
    previewOnly,
  };
}
