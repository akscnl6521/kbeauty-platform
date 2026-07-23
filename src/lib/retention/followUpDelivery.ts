/**
 * Multi-channel follow-up delivery interfaces.
 * Real email/SMS/push is NOT claimed complete — dry-run / live_blocked only.
 */

export type FollowUpDeliveryChannel = "in_app" | "email" | "sms" | "push";

export type FollowUpDeliveryMode = "disabled" | "dry_run" | "live_blocked";

export type FollowUpDeliveryKind = "checkin_due" | "checkin_reminder" | "red_flag_escalation";

export type FollowUpDeliveryStatus =
  | "pending"
  | "queued"
  | "dry_run_sent"
  | "suppressed"
  | "failed"
  | "retry_scheduled"
  | "cancelled"
  | "live_blocked";

export type FollowUpDeliveryRecord = {
  id: string;
  checkInId: string;
  channel: FollowUpDeliveryChannel;
  kind: FollowUpDeliveryKind;
  status: FollowUpDeliveryStatus;
  mode: FollowUpDeliveryMode;
  reasonCode: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  /** Masked recipient hint only — never store raw phone/email/token. */
  recipientMask: string | null;
  providerMessageId: string | null;
  realDeliveryClaimed: false;
};

export type FollowUpDeliveryRequest = {
  checkInId: string;
  channel: FollowUpDeliveryChannel;
  kind: FollowUpDeliveryKind;
  locale: "ko" | "en" | "ja";
  idempotencyKey: string;
  /** Opaque destination token or address; adapters mask it. */
  destination: string;
  bodyPreview: string;
};

export type FollowUpDeliveryResult =
  | {
      ok: true;
      mode: FollowUpDeliveryMode;
      status: FollowUpDeliveryStatus;
      providerMessageId: string;
      recipientMask: string;
      reasonCode: string;
    }
  | {
      ok: false;
      mode: FollowUpDeliveryMode;
      status: FollowUpDeliveryStatus;
      recipientMask: string | null;
      reasonCode: string;
      retryable: boolean;
    };

export type FollowUpDeliveryAdapter = {
  readonly channel: FollowUpDeliveryChannel;
  readonly mode: FollowUpDeliveryMode;
  send(request: FollowUpDeliveryRequest): Promise<FollowUpDeliveryResult>;
};

export type FollowUpChannelConsent = {
  careCheckinConsent: boolean;
  notificationsEnabled: boolean;
  careEmailChannelConsent: boolean;
  careSmsChannelConsent: boolean;
  carePushChannelConsent: boolean;
};

const LIVE_BLOCK_REASON = "live_delivery_not_enabled";

export function maskDestination(
  channel: FollowUpDeliveryChannel,
  destination: string
): string {
  const raw = destination.trim();
  if (!raw) return "empty";
  if (channel === "email") {
    const at = raw.indexOf("@");
    if (at <= 0) return "email:***";
    const local = raw.slice(0, at);
    const domain = raw.slice(at + 1);
    return `${local.slice(0, 1)}***@${domain.slice(0, 1)}***`;
  }
  if (channel === "sms") {
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 4) return "sms:***";
    return `sms:***${digits.slice(-4)}`;
  }
  if (channel === "push") {
    return `push:${raw.slice(0, 4)}***`;
  }
  return "in_app:session";
}

export function buildFollowUpDeliveryIdempotencyKey(input: {
  userKey: string;
  checkInId: string;
  channel: FollowUpDeliveryChannel;
  kind: FollowUpDeliveryKind;
}): string {
  return [
    "follow-up:v1",
    input.userKey.trim() || "anon",
    input.checkInId.trim(),
    input.channel,
    input.kind,
  ].join(":");
}

export function channelConsentAllows(
  channel: FollowUpDeliveryChannel,
  consent: FollowUpChannelConsent
): { allowed: boolean; reasonCode: string } {
  if (!consent.careCheckinConsent) {
    return { allowed: false, reasonCode: "care_checkin_consent_missing" };
  }
  switch (channel) {
    case "in_app":
      return consent.notificationsEnabled
        ? { allowed: true, reasonCode: "ok" }
        : { allowed: false, reasonCode: "in_app_opt_out" };
    case "email":
      return consent.careEmailChannelConsent
        ? { allowed: true, reasonCode: "ok" }
        : { allowed: false, reasonCode: "email_opt_out" };
    case "sms":
      return consent.careSmsChannelConsent
        ? { allowed: true, reasonCode: "ok" }
        : { allowed: false, reasonCode: "sms_opt_out" };
    case "push":
      return consent.carePushChannelConsent
        ? { allowed: true, reasonCode: "ok" }
        : { allowed: false, reasonCode: "push_opt_out" };
    default:
      return { allowed: false, reasonCode: "unknown_channel" };
  }
}

export function resolveFollowUpDeliveryMode(
  env: Record<string, string | undefined> = {},
  channel: FollowUpDeliveryChannel
): FollowUpDeliveryMode {
  const key =
    channel === "email"
      ? "EMAIL_DELIVERY_MODE"
      : channel === "sms"
        ? "SMS_DELIVERY_MODE"
        : channel === "push"
          ? "PUSH_DELIVERY_MODE"
          : "IN_APP_DELIVERY_MODE";
  const mode = (env[key] || "").trim().toLowerCase();
  if (mode === "disabled" || mode === "dry_run" || mode === "live_blocked") {
    return mode;
  }
  if (mode === "live") return "live_blocked";
  if (channel === "in_app") return "dry_run";
  return "disabled";
}

class DryRunIdempotencyRegistry {
  private readonly seen = new Set<string>();

  has(key: string): boolean {
    return this.seen.has(key);
  }

  add(key: string): void {
    this.seen.add(key);
  }
}

export function createDryRunDeliveryAdapter(
  channel: FollowUpDeliveryChannel,
  registry: DryRunIdempotencyRegistry = new DryRunIdempotencyRegistry()
): FollowUpDeliveryAdapter {
  return {
    channel,
    mode: "dry_run",
    async send(request) {
      const recipientMask = maskDestination(channel, request.destination);
      if (registry.has(request.idempotencyKey)) {
        return {
          ok: false,
          mode: "dry_run",
          status: "suppressed",
          recipientMask,
          reasonCode: "duplicate_request",
          retryable: false,
        };
      }
      if (!request.destination.trim()) {
        return {
          ok: false,
          mode: "dry_run",
          status: "failed",
          recipientMask: null,
          reasonCode: "invalid_destination",
          retryable: false,
        };
      }
      registry.add(request.idempotencyKey);
      return {
        ok: true,
        mode: "dry_run",
        status: "dry_run_sent",
        providerMessageId: `dry_${channel}_${Date.now().toString(36)}`,
        recipientMask,
        reasonCode: "dry_run_ok",
      };
    },
  };
}

export function createDisabledDeliveryAdapter(
  channel: FollowUpDeliveryChannel
): FollowUpDeliveryAdapter {
  return {
    channel,
    mode: "disabled",
    async send(request) {
      return {
        ok: false,
        mode: "disabled",
        status: "suppressed",
        recipientMask: maskDestination(channel, request.destination),
        reasonCode: "provider_disabled",
        retryable: false,
      };
    },
  };
}

export function createLiveBlockedDeliveryAdapter(
  channel: FollowUpDeliveryChannel
): FollowUpDeliveryAdapter {
  return {
    channel,
    mode: "live_blocked",
    async send(request) {
      return {
        ok: false,
        mode: "live_blocked",
        status: "live_blocked",
        recipientMask: maskDestination(channel, request.destination),
        reasonCode: LIVE_BLOCK_REASON,
        retryable: false,
      };
    },
  };
}

export function createFollowUpDeliveryAdapter(
  channel: FollowUpDeliveryChannel,
  env: Record<string, string | undefined> = {},
  registry?: DryRunIdempotencyRegistry
): FollowUpDeliveryAdapter {
  const mode = resolveFollowUpDeliveryMode(env, channel);
  if (mode === "dry_run") return createDryRunDeliveryAdapter(channel, registry);
  if (mode === "live_blocked") return createLiveBlockedDeliveryAdapter(channel);
  return createDisabledDeliveryAdapter(channel);
}

export function toDeliveryRecord(input: {
  id: string;
  request: FollowUpDeliveryRequest;
  result: FollowUpDeliveryResult;
  nowIso?: string;
}): FollowUpDeliveryRecord {
  const now = input.nowIso ?? new Date().toISOString();
  return {
    id: input.id,
    checkInId: input.request.checkInId,
    channel: input.request.channel,
    kind: input.request.kind,
    status: input.result.status,
    mode: input.result.mode,
    reasonCode: input.result.reasonCode,
    idempotencyKey: input.request.idempotencyKey,
    createdAt: now,
    updatedAt: now,
    recipientMask: input.result.recipientMask,
    providerMessageId:
      input.result.ok === true ? input.result.providerMessageId : null,
    realDeliveryClaimed: false,
  };
}

export function summarizeDeliveryRecords(
  records: FollowUpDeliveryRecord[]
): {
  byChannel: Record<FollowUpDeliveryChannel, number>;
  byStatus: Record<string, number>;
  realDeliveryClaimedCount: number;
  note: string;
} {
  const byChannel: Record<FollowUpDeliveryChannel, number> = {
    in_app: 0,
    email: 0,
    sms: 0,
    push: 0,
  };
  const byStatus: Record<string, number> = {};
  for (const r of records) {
    byChannel[r.channel] += 1;
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }
  return {
    byChannel,
    byStatus,
    realDeliveryClaimedCount: 0,
    note: "status counts only — no PII · real email/SMS/push not claimed",
  };
}

export { DryRunIdempotencyRegistry };
