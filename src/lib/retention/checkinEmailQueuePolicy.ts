/**
 * Check-in email queue policy ? eligibility, idempotency, status, retry.
 * Pure module; no email provider calls or DB writes.
 */

import type { CareCheckIn } from "@/lib/care/types";
import {
  evaluateCheckinReminderPolicy,
  milestoneFromDay,
  type CheckinLocale,
  type CheckinMilestone,
} from "@/lib/retention/checkinPolicy";

export type CheckinEmailKind =
  | "checkin_due"
  | "checkin_reminder"
  | "checkin_completed_confirmation"
  | "care_alert";

export type CheckinEmailQueueStatus =
  | "pending"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "retry_scheduled"
  | "cancelled"
  | "suppressed"
  | "dead_letter";

export type CheckinEmailFailureReason =
  | "timeout"
  | "provider_unavailable"
  | "rate_limited"
  | "temporary_network"
  | "invalid_email"
  | "consent_missing"
  | "user_unsubscribed"
  | "permanent_rejection"
  | "malformed_payload";

export type CheckinEmailContentPayload = {
  subjectKey: string;
  bodyKey: string;
  locale: CheckinLocale;
  milestone: CheckinMilestone;
  kind: CheckinEmailKind;
  checkinUrlPath: string;
  preferenceUrlPath: string;
  userDisplayName?: string;
  scheduledAt: string;
};

export type CheckinEmailCandidate = {
  subjectId: string;
  checkInId: string;
  milestone: CheckinMilestone;
  kind: CheckinEmailKind;
  locale: CheckinLocale;
  timezone: string;
  idempotencyKey: string;
  subjectKey: string;
  bodyKey: string;
  checkinUrlPath: string;
  preferenceUrlPath: string;
  recipientMask: string;
  dueAt: string;
  scheduleDate: string;
};

export type CheckinEmailQueueItem = {
  id: string;
  subjectId: string;
  checkInId: string;
  milestone: CheckinMilestone;
  kind: CheckinEmailKind;
  recipientMask: string;
  locale: CheckinLocale;
  timezone: string;
  status: CheckinEmailQueueStatus;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastErrorCode: CheckinEmailFailureReason | null;
  idempotencyKey: string;
  payload: CheckinEmailContentPayload;
  createdAt: string;
  updatedAt: string;
  scheduledAt: string | null;
  sentAt: string | null;
  cancelledAt: string | null;
};

export type CheckinEmailQueueDecision = {
  eligible: boolean;
  reason: string;
  kind: CheckinEmailKind;
  checkInId: string;
  candidate: CheckinEmailCandidate | null;
};

export type CheckinEmailEligibilityInput = {
  subjectId: string;
  checkIn: CareCheckIn;
  kind: Extract<CheckinEmailKind, "checkin_due" | "checkin_reminder">;
  email: string;
  careCheckinConsent: boolean;
  careEmailChannelConsent: boolean;
  marketingConsent: boolean;
  notificationsEnabled: boolean;
  locale: CheckinLocale;
  timezone: string;
  now?: Date;
  existingIdempotencyKeys?: Iterable<string>;
  alertSuppressed?: boolean;
  reminderCount?: number;
  lastReminderAt?: string | null;
};

const RETRYABLE_FAILURES: ReadonlySet<CheckinEmailFailureReason> = new Set([
  "timeout",
  "provider_unavailable",
  "rate_limited",
  "temporary_network",
]);

const RETRY_DELAYS_MS = [5 * 60_000, 30 * 60_000, 2 * 60 * 60_000] as const;
const MAX_RETRY_ATTEMPTS = 3;

const TERMINAL_STATUSES: ReadonlySet<CheckinEmailQueueStatus> = new Set([
  "sent",
  "cancelled",
  "suppressed",
  "dead_letter",
]);

const ALLOWED_TRANSITIONS: Record<
  CheckinEmailQueueStatus,
  ReadonlySet<CheckinEmailQueueStatus>
> = {
  pending: new Set(["scheduled", "cancelled", "suppressed"]),
  scheduled: new Set(["sending", "cancelled", "suppressed"]),
  sending: new Set(["sent", "failed", "cancelled"]),
  failed: new Set(["retry_scheduled", "dead_letter", "cancelled", "suppressed"]),
  retry_scheduled: new Set(["sending", "cancelled", "suppressed", "dead_letter"]),
  sent: new Set(),
  cancelled: new Set(),
  suppressed: new Set(),
  dead_letter: new Set(),
};

const CLOSED_CHECKIN_STATUSES = new Set([
  "completed",
  "skipped",
  "cancelled",
  "expired",
]);

const ALLOWED_PAYLOAD_KEYS = new Set([
  "subjectKey",
  "bodyKey",
  "locale",
  "milestone",
  "kind",
  "checkinUrlPath",
  "preferenceUrlPath",
  "userDisplayName",
  "scheduledAt",
]);

const FORBIDDEN_PAYLOAD_PATTERN = /photo|acute|diagnos/i;

function normalizeIdPart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function toScheduleDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "invalid-date";
  return new Date(ms).toISOString().slice(0, 10);
}

function hasControlOrWhitespace(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f || /\s/.test(value[i]!)) return true;
  }
  return false;
}

export function isValidCheckinEmailAddress(email: string): boolean {
  if (typeof email !== "string") return false;
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;
  if (hasControlOrWhitespace(trimmed)) return false;
  const parts = trimmed.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (!domain.includes(".")) return false;
  if (domain.startsWith(".") || domain.endsWith(".")) return false;
  return true;
}

export function maskEmailAddress(email: string): string {
  if (!isValidCheckinEmailAddress(email)) return "[invalid]";
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const first = local[0] ?? "";
  return `${first}***@${domain}`;
}

export function buildCheckinEmailIdempotencyKey(input: {
  subjectId: string;
  checkInId: string;
  milestone: CheckinMilestone;
  kind: CheckinEmailKind;
}): string {
  const subjectId = normalizeIdPart(input.subjectId);
  const checkInId = normalizeIdPart(input.checkInId);
  const milestone = normalizeIdPart(input.milestone);
  const kind = normalizeIdPart(input.kind);
  // Production queue v1 — exclude scheduleDate / locale / template_version / recipient
  return `checkin-email:v1:${subjectId}:${checkInId}:${milestone}:${kind}:email`;
}

export function isRetryableCheckinEmailFailure(
  reason: CheckinEmailFailureReason
): boolean {
  return RETRYABLE_FAILURES.has(reason);
}

export function getRetrySchedule(
  attemptCount: number,
  now: Date = new Date()
): {
  action: "retry" | "dead_letter";
  delayMs: number | null;
  nextAttemptAt: string | null;
  maxAttempts: number;
} {
  if (attemptCount < 0 || attemptCount >= MAX_RETRY_ATTEMPTS) {
    return {
      action: "dead_letter",
      delayMs: null,
      nextAttemptAt: null,
      maxAttempts: MAX_RETRY_ATTEMPTS,
    };
  }
  const delayMs = RETRY_DELAYS_MS[attemptCount]!;
  return {
    action: "retry",
    delayMs,
    nextAttemptAt: new Date(now.getTime() + delayMs).toISOString(),
    maxAttempts: MAX_RETRY_ATTEMPTS,
  };
}

export function canTransitionCheckinEmailStatus(
  from: CheckinEmailQueueStatus,
  to: CheckinEmailQueueStatus
): boolean {
  if (from === to) return false;
  if (TERMINAL_STATUSES.has(from)) return false;
  return ALLOWED_TRANSITIONS[from]?.has(to) ?? false;
}

export function transitionCheckinEmailStatus(
  item: CheckinEmailQueueItem,
  to: CheckinEmailQueueStatus,
  now: Date = new Date()
): CheckinEmailQueueItem {
  if (!canTransitionCheckinEmailStatus(item.status, to)) {
    throw new Error(
      `invalid_checkin_email_status_transition:${item.status}->${to}`
    );
  }
  const ts = now.toISOString();
  const next: CheckinEmailQueueItem = {
    ...item,
    status: to,
    updatedAt: ts,
  };
  if (to === "scheduled" && !next.scheduledAt) {
    next.scheduledAt = ts;
  }
  if (to === "sent") {
    next.sentAt = ts;
    next.nextAttemptAt = null;
  }
  if (to === "cancelled" || to === "suppressed") {
    next.cancelledAt = ts;
    next.nextAttemptAt = null;
  }
  if (to === "dead_letter") {
    next.nextAttemptAt = null;
  }
  return next;
}

function contentKeys(
  kind: Extract<CheckinEmailKind, "checkin_due" | "checkin_reminder">,
  milestone: CheckinMilestone
): { subjectKey: string; bodyKey: string } {
  return {
    subjectKey: `email.${kind}.${milestone}.subject`,
    bodyKey: `email.${kind}.${milestone}.body`,
  };
}

export function evaluateCheckinEmailEligibility(
  input: CheckinEmailEligibilityInput
): CheckinEmailQueueDecision {
  const kind = input.kind;
  const checkInId = input.checkIn.id;
  const deny = (reason: string): CheckinEmailQueueDecision => ({
    eligible: false,
    reason,
    kind,
    checkInId,
    candidate: null,
  });

  if (!input.careCheckinConsent) {
    return deny("missing_care_consent");
  }

  if (!input.careEmailChannelConsent) {
    if (input.marketingConsent) {
      return deny("marketing_only_consent");
    }
    return deny("missing_email_channel_consent");
  }

  if (!input.notificationsEnabled) {
    return deny("notifications_disabled");
  }

  if (!isValidCheckinEmailAddress(input.email)) {
    return deny("invalid_email");
  }

  const timezone = input.timezone.trim();
  if (!timezone) {
    return deny("missing_timezone");
  }

  if (CLOSED_CHECKIN_STATUSES.has(input.checkIn.status)) {
    return deny("checkin_closed");
  }

  if (input.alertSuppressed) {
    return deny("alert_suppressed");
  }

  const now = input.now ?? new Date();
  const dueMs = Date.parse(input.checkIn.dueAt);
  if (!Number.isFinite(dueMs)) {
    return deny("invalid_due_at");
  }

  if (kind === "checkin_due") {
    if (now.getTime() < dueMs) {
      return deny("not_due");
    }
  } else {
    const reminder = evaluateCheckinReminderPolicy({
      checkIn: input.checkIn,
      reminderCount: input.reminderCount,
      lastReminderAt: input.lastReminderAt,
      now,
    });
    if (!reminder.shouldRemind) {
      return deny("reminder_not_ready");
    }
  }

  const milestone = milestoneFromDay(input.checkIn.day);
  const scheduleDate = toScheduleDate(input.checkIn.dueAt);
  const idempotencyKey = buildCheckinEmailIdempotencyKey({
      subjectId: input.subjectId,
      checkInId,
      milestone,
      kind,
    });

  const existing = new Set(
    [...(input.existingIdempotencyKeys ?? [])].map((k) => k.trim())
  );
  if (existing.has(idempotencyKey)) {
    return deny("duplicate");
  }

  const keys = contentKeys(kind, milestone);
  const candidate: CheckinEmailCandidate = {
    subjectId: input.subjectId,
    checkInId,
    milestone,
    kind,
    locale: input.locale,
    timezone,
    idempotencyKey,
    subjectKey: keys.subjectKey,
    bodyKey: keys.bodyKey,
    checkinUrlPath: `/my/check-ins/${checkInId}`,
    preferenceUrlPath: "/my/settings",
    recipientMask: maskEmailAddress(input.email),
    dueAt: input.checkIn.dueAt,
    scheduleDate,
  };

  return {
    eligible: true,
    reason: "eligible",
    kind,
    checkInId,
    candidate,
  };
}

export function buildCheckinEmailCandidates(input: {
  subjectId: string;
  checkIns: CareCheckIn[];
  email: string;
  careCheckinConsent: boolean;
  careEmailChannelConsent: boolean;
  marketingConsent: boolean;
  notificationsEnabled: boolean;
  locale: CheckinLocale;
  timezone: string;
  now?: Date;
  existingIdempotencyKeys?: string[];
  alertSuppressed?: boolean;
  reminderCountByCheckInId?: Record<string, number>;
  lastReminderAtByCheckInId?: Record<string, string | null>;
}): {
  candidates: CheckinEmailCandidate[];
  decisions: CheckinEmailQueueDecision[];
} {
  const accumulated = new Set(input.existingIdempotencyKeys ?? []);
  const candidates: CheckinEmailCandidate[] = [];
  const decisions: CheckinEmailQueueDecision[] = [];
  const kinds: Array<
    Extract<CheckinEmailKind, "checkin_due" | "checkin_reminder">
  > = ["checkin_due", "checkin_reminder"];

  for (const checkIn of input.checkIns) {
    for (const kind of kinds) {
      const decision = evaluateCheckinEmailEligibility({
        subjectId: input.subjectId,
        checkIn,
        kind,
        email: input.email,
        careCheckinConsent: input.careCheckinConsent,
        careEmailChannelConsent: input.careEmailChannelConsent,
        marketingConsent: input.marketingConsent,
        notificationsEnabled: input.notificationsEnabled,
        locale: input.locale,
        timezone: input.timezone,
        now: input.now,
        existingIdempotencyKeys: accumulated,
        alertSuppressed: input.alertSuppressed,
        reminderCount: input.reminderCountByCheckInId?.[checkIn.id] ?? 0,
        lastReminderAt: input.lastReminderAtByCheckInId?.[checkIn.id] ?? null,
      });
      decisions.push(decision);
      if (decision.eligible && decision.candidate) {
        candidates.push(decision.candidate);
        accumulated.add(decision.candidate.idempotencyKey);
      }
    }
  }

  return { candidates, decisions };
}

export function enqueueCheckinEmailCandidate(input: {
  candidate: CheckinEmailCandidate;
  id: string;
  now?: Date;
  userDisplayName?: string;
}): CheckinEmailQueueItem {
  const now = input.now ?? new Date();
  const ts = now.toISOString();
  const payload: CheckinEmailContentPayload = {
    subjectKey: input.candidate.subjectKey,
    bodyKey: input.candidate.bodyKey,
    locale: input.candidate.locale,
    milestone: input.candidate.milestone,
    kind: input.candidate.kind,
    checkinUrlPath: input.candidate.checkinUrlPath,
    preferenceUrlPath: input.candidate.preferenceUrlPath,
    scheduledAt: ts,
  };
  if (input.userDisplayName !== undefined) {
    payload.userDisplayName = input.userDisplayName;
  }
  assertSafeCheckinEmailPayload(payload);

  return {
    id: input.id,
    subjectId: input.candidate.subjectId,
    checkInId: input.candidate.checkInId,
    milestone: input.candidate.milestone,
    kind: input.candidate.kind,
    recipientMask: input.candidate.recipientMask,
    locale: input.candidate.locale,
    timezone: input.candidate.timezone,
    status: "pending",
    attemptCount: 0,
    nextAttemptAt: null,
    lastErrorCode: null,
    idempotencyKey: input.candidate.idempotencyKey,
    payload,
    createdAt: ts,
    updatedAt: ts,
    scheduledAt: null,
    sentAt: null,
    cancelledAt: null,
  };
}

function permanentFailureTarget(
  reason: CheckinEmailFailureReason
): Extract<CheckinEmailQueueStatus, "suppressed" | "dead_letter"> {
  if (
    reason === "invalid_email" ||
    reason === "consent_missing" ||
    reason === "user_unsubscribed"
  ) {
    return "suppressed";
  }
  return "dead_letter";
}

export function applyCheckinEmailSendFailure(
  item: CheckinEmailQueueItem,
  reason: CheckinEmailFailureReason,
  now: Date = new Date()
): CheckinEmailQueueItem {
  const ts = now.toISOString();

  if (!isRetryableCheckinEmailFailure(reason)) {
    const target = permanentFailureTarget(reason);
    let next = item;
    if (
      item.status === "sending" &&
      canTransitionCheckinEmailStatus(item.status, "failed")
    ) {
      next = {
        ...item,
        status: "failed",
        lastErrorCode: reason,
        updatedAt: ts,
      };
    }
    if (canTransitionCheckinEmailStatus(next.status, target)) {
      return {
        ...transitionCheckinEmailStatus(next, target, now),
        lastErrorCode: reason,
      };
    }
    return {
      ...next,
      status: target,
      lastErrorCode: reason,
      updatedAt: ts,
      nextAttemptAt: null,
      cancelledAt: target === "suppressed" ? ts : next.cancelledAt,
    };
  }

  const schedule = getRetrySchedule(item.attemptCount, now);
  if (schedule.action === "dead_letter") {
    let next = item;
    if (item.status === "sending") {
      next = {
        ...item,
        status: "failed",
        lastErrorCode: reason,
        updatedAt: ts,
      };
    }
    if (canTransitionCheckinEmailStatus(next.status, "dead_letter")) {
      return {
        ...transitionCheckinEmailStatus(next, "dead_letter", now),
        lastErrorCode: reason,
        attemptCount: item.attemptCount,
      };
    }
    return {
      ...next,
      status: "dead_letter",
      lastErrorCode: reason,
      updatedAt: ts,
      nextAttemptAt: null,
    };
  }

  let failed = item;
  if (item.status === "sending") {
    failed = {
      ...item,
      status: "failed",
      lastErrorCode: reason,
      updatedAt: ts,
    };
  } else if (item.status !== "failed") {
    failed = {
      ...item,
      status: "failed",
      lastErrorCode: reason,
      updatedAt: ts,
    };
  } else {
    failed = { ...item, lastErrorCode: reason, updatedAt: ts };
  }

  const retried = transitionCheckinEmailStatus(failed, "retry_scheduled", now);
  return {
    ...retried,
    attemptCount: item.attemptCount + 1,
    nextAttemptAt: schedule.nextAttemptAt,
    lastErrorCode: reason,
  };
}

export function assertSafeCheckinEmailPayload(
  payload: CheckinEmailContentPayload | Record<string, unknown>
): void {
  const keys = Object.keys(payload);
  for (const key of keys) {
    if (!ALLOWED_PAYLOAD_KEYS.has(key)) {
      throw new Error(`unsafe_checkin_email_payload_key:${key}`);
    }
  }
  const raw = JSON.stringify(payload);
  if (FORBIDDEN_PAYLOAD_PATTERN.test(raw)) {
    throw new Error("unsafe_checkin_email_payload_content");
  }
}
