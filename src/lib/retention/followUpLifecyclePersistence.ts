/**
 * Follow-up lifecycle persistence: resume + corrupt/missing fallback.
 * Local-first; no claim of server sync completeness.
 */

import type { CareCheckIn } from "@/lib/care/types";
import {
  createEmptyFollowUpLifecycleSnapshot,
  refreshFollowUpDueStates,
  type FollowUpLifecycleSnapshot,
} from "@/lib/retention/followUpLifecycle";
import type { FollowUpDeliveryRecord } from "@/lib/retention/followUpDelivery";

export const FOLLOW_UP_LIFECYCLE_STORAGE_KEY = "kbeautyFollowUpLifecycleV1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t || t.length > max) return null;
  return t;
}

function parseDeliveryRecords(raw: unknown): FollowUpDeliveryRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: FollowUpDeliveryRecord[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = asString(item.id, 80);
    const checkInId = asString(item.checkInId, 80);
    const channel = asString(item.channel, 20);
    const kind = asString(item.kind, 40);
    const status = asString(item.status, 40);
    const mode = asString(item.mode, 20);
    const reasonCode = asString(item.reasonCode, 80);
    const idempotencyKey = asString(item.idempotencyKey, 200);
    const createdAt = asString(item.createdAt, 40);
    const updatedAt = asString(item.updatedAt, 40);
    if (
      !id ||
      !checkInId ||
      !channel ||
      !kind ||
      !status ||
      !mode ||
      !reasonCode ||
      !idempotencyKey ||
      !createdAt ||
      !updatedAt
    ) {
      continue;
    }
    if (
      channel !== "in_app" &&
      channel !== "email" &&
      channel !== "sms" &&
      channel !== "push"
    ) {
      continue;
    }
    out.push({
      id,
      checkInId,
      channel,
      kind: kind as FollowUpDeliveryRecord["kind"],
      status: status as FollowUpDeliveryRecord["status"],
      mode: mode as FollowUpDeliveryRecord["mode"],
      reasonCode,
      idempotencyKey,
      createdAt,
      updatedAt,
      recipientMask:
        typeof item.recipientMask === "string" ? item.recipientMask : null,
      providerMessageId:
        typeof item.providerMessageId === "string"
          ? item.providerMessageId
          : null,
      realDeliveryClaimed: false,
    });
  }
  return out;
}

function parseCheckIns(raw: unknown): CareCheckIn[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is CareCheckIn => {
    if (!isRecord(item)) return false;
    return (
      typeof item.id === "string" &&
      typeof item.analysisSessionId === "string" &&
      typeof item.day === "number" &&
      typeof item.status === "string" &&
      typeof item.dueAt === "string"
    );
  });
}

/**
 * Safe parse. Corrupt / wrong version → empty fallback (never throw).
 */
export function parseFollowUpLifecycleSnapshot(
  raw: unknown,
  fallback: {
    analysisSessionId?: string;
    nowIso?: string;
  } = {}
): FollowUpLifecycleSnapshot {
  const now = fallback.nowIso ?? new Date().toISOString();
  const empty = createEmptyFollowUpLifecycleSnapshot({
    analysisSessionId: fallback.analysisSessionId ?? "unknown",
    nowIso: now,
  });

  if (!isRecord(raw)) {
    return { ...empty, persistenceSource: "fallback_empty" };
  }
  if (raw.version !== 1) {
    return { ...empty, persistenceSource: "fallback_empty" };
  }

  const analysisSessionId =
    asString(raw.analysisSessionId, 120) ?? empty.analysisSessionId;
  const timezone = asString(raw.timezone, 80) ?? "Asia/Seoul";
  const localeRaw = asString(raw.locale, 8);
  const locale =
    localeRaw === "en" || localeRaw === "ja" || localeRaw === "ko"
      ? localeRaw
      : "ko";

  const consentRaw = isRecord(raw.consent) ? raw.consent : {};
  const consent = {
    careCheckinConsent: consentRaw.careCheckinConsent === true,
    notificationsEnabled: consentRaw.notificationsEnabled !== false,
    careEmailChannelConsent: consentRaw.careEmailChannelConsent === true,
    careSmsChannelConsent: consentRaw.careSmsChannelConsent === true,
    carePushChannelConsent: consentRaw.carePushChannelConsent === true,
  };

  const phaseRaw = asString(raw.phase, 40) ?? "opt_in_required";
  const allowedPhases = new Set([
    "opt_in_required",
    "scheduled",
    "due",
    "check_in_completed",
    "routine_adjustment_proposed",
    "red_flag_escalated",
    "paused",
    "resumed",
    "completed_cycle",
  ]);
  const phase = allowedPhases.has(phaseRaw)
    ? (phaseRaw as FollowUpLifecycleSnapshot["phase"])
    : "opt_in_required";

  const checkIns = parseCheckIns(raw.checkIns);
  const deliveryRecords = parseDeliveryRecords(raw.deliveryRecords);

  const snapshot: FollowUpLifecycleSnapshot = {
    version: 1,
    analysisSessionId,
    routineId:
      typeof raw.routineId === "string" || raw.routineId === null
        ? (raw.routineId as string | null)
        : null,
    locale,
    timezone,
    consent,
    phase,
    checkIns,
    lastDecision: null,
    lastAdjustment: null,
    lastEscalation: null,
    deliveryRecords,
    pausedAt: typeof raw.pausedAt === "string" ? raw.pausedAt : null,
    resumedAt: typeof raw.resumedAt === "string" ? raw.resumedAt : null,
    persistenceSource: "local",
    updatedAt: asString(raw.updatedAt, 40) ?? now,
    realDeliveryClaimed: false,
  };

  return refreshFollowUpDueStates(snapshot, now);
}

export function serializeFollowUpLifecycleSnapshot(
  snapshot: FollowUpLifecycleSnapshot
): string {
  return JSON.stringify({
    ...snapshot,
    lastDecision: snapshot.lastDecision,
    lastAdjustment: snapshot.lastAdjustment
      ? {
          consultationFirst: snapshot.lastAdjustment.consultationFirst,
          routineMissing: snapshot.lastAdjustment.routineMissing,
          primaryType: snapshot.lastAdjustment.primary?.type ?? null,
        }
      : null,
    realDeliveryClaimed: false,
  });
}

export function loadFollowUpLifecycleFromLocal(input?: {
  analysisSessionId?: string;
  storage?: Pick<Storage, "getItem">;
  nowIso?: string;
}): FollowUpLifecycleSnapshot {
  const empty = createEmptyFollowUpLifecycleSnapshot({
    analysisSessionId: input?.analysisSessionId ?? "unknown",
    nowIso: input?.nowIso,
  });
  try {
    const storage =
      input?.storage ??
      (typeof window !== "undefined" ? window.localStorage : null);
    if (!storage) {
      return { ...empty, persistenceSource: "fallback_empty" };
    }
    const raw = storage.getItem(FOLLOW_UP_LIFECYCLE_STORAGE_KEY);
    if (!raw) {
      return { ...empty, persistenceSource: "fallback_empty" };
    }
    return parseFollowUpLifecycleSnapshot(JSON.parse(raw), {
      analysisSessionId: input?.analysisSessionId,
      nowIso: input?.nowIso,
    });
  } catch {
    return { ...empty, persistenceSource: "fallback_empty" };
  }
}

export function saveFollowUpLifecycleToLocal(
  snapshot: FollowUpLifecycleSnapshot,
  storage?: Pick<Storage, "setItem">
): { ok: boolean; reason: string } {
  try {
    const target =
      storage ?? (typeof window !== "undefined" ? window.localStorage : null);
    if (!target) return { ok: false, reason: "storage_unavailable" };
    target.setItem(
      FOLLOW_UP_LIFECYCLE_STORAGE_KEY,
      serializeFollowUpLifecycleSnapshot(snapshot)
    );
    return { ok: true, reason: "saved" };
  } catch {
    return { ok: false, reason: "storage_quota_or_error" };
  }
}

/**
 * Prefer server snapshot when valid; otherwise resume from local; else empty fallback.
 */
export function resumeFollowUpLifecycleWithFallback(input: {
  serverSnapshot?: unknown;
  localSnapshot?: unknown;
  analysisSessionId: string;
  nowIso?: string;
}): {
  snapshot: FollowUpLifecycleSnapshot;
  source: "server" | "local" | "fallback_empty";
} {
  const now = input.nowIso ?? new Date().toISOString();

  if (input.serverSnapshot != null) {
    const server = parseFollowUpLifecycleSnapshot(input.serverSnapshot, {
      analysisSessionId: input.analysisSessionId,
      nowIso: now,
    });
    if (
      server.persistenceSource !== "fallback_empty" &&
      server.analysisSessionId === input.analysisSessionId
    ) {
      return {
        snapshot: { ...server, persistenceSource: "server" },
        source: "server",
      };
    }
  }

  if (input.localSnapshot != null) {
    const local = parseFollowUpLifecycleSnapshot(input.localSnapshot, {
      analysisSessionId: input.analysisSessionId,
      nowIso: now,
    });
    if (
      local.persistenceSource !== "fallback_empty" &&
      (local.analysisSessionId === input.analysisSessionId ||
        local.checkIns.length > 0)
    ) {
      return {
        snapshot: { ...local, persistenceSource: "local" },
        source: "local",
      };
    }
  }

  return {
    snapshot: {
      ...createEmptyFollowUpLifecycleSnapshot({
        analysisSessionId: input.analysisSessionId,
        nowIso: now,
      }),
      persistenceSource: "fallback_empty",
    },
    source: "fallback_empty",
  };
}
