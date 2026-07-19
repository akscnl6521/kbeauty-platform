import type {
  CareCheckIn,
  CareNotification,
  CareReferralLevel,
  CareUserSettings,
} from "./types";

export type ReminderChannel = "in_app" | "email";

export type ReminderDeliveryDecision = {
  deliver: boolean;
  channel: ReminderChannel;
  reason: string;
  deliverAt: string | null;
  priority: "normal" | "high" | "urgent";
  fingerprint: string;
};

function priorityForReferral(level: CareReferralLevel): ReminderDeliveryDecision["priority"] {
  if (level === "seek_emergency_care") return "urgent";
  if (level === "seek_promptly" || level === "consider_soon") return "high";
  return "normal";
}

function isWithinQuietHours(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function nextQuietHoursEnd(now: Date, endHour: number): Date {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  if (now.getHours() >= endHour) next.setDate(next.getDate() + 1);
  next.setHours(endHour, 0, 0, 0);
  return next;
}

export function buildCheckInReminderFingerprint(
  checkIn: Pick<CareCheckIn, "id" | "day" | "status">
): string {
  return `checkin:${checkIn.id}:day-${checkIn.day}:${checkIn.status}`;
}

export function decideReminderDelivery(input: {
  checkIn: Pick<CareCheckIn, "id" | "day" | "status" | "dueAt" | "referralLevel">;
  settings: CareUserSettings;
  channel: ReminderChannel;
  existingNotifications: Pick<CareNotification, "fingerprint">[];
  now?: Date;
}): ReminderDeliveryDecision {
  const now = input.now ?? new Date();
  const fingerprint = buildCheckInReminderFingerprint(input.checkIn);
  const priority = priorityForReferral(input.checkIn.referralLevel);

  if (input.checkIn.status === "completed" || input.checkIn.status === "cancelled") {
    return { deliver: false, channel: input.channel, reason: "checkin_closed", deliverAt: null, priority, fingerprint };
  }

  if (input.existingNotifications.some((item) => item.fingerprint === fingerprint)) {
    return { deliver: false, channel: input.channel, reason: "duplicate", deliverAt: null, priority, fingerprint };
  }

  if (input.channel === "in_app" && !input.settings.notificationsEnabled) {
    return { deliver: false, channel: input.channel, reason: "in_app_opt_out", deliverAt: null, priority, fingerprint };
  }

  if (input.channel === "email" && !input.settings.emailOptIn) {
    return { deliver: false, channel: input.channel, reason: "email_opt_out", deliverAt: null, priority, fingerprint };
  }

  const dueAt = new Date(input.checkIn.dueAt);
  if (Number.isNaN(dueAt.getTime())) {
    return { deliver: false, channel: input.channel, reason: "invalid_due_at", deliverAt: null, priority, fingerprint };
  }

  if (dueAt.getTime() > now.getTime()) {
    return { deliver: false, channel: input.channel, reason: "not_due", deliverAt: dueAt.toISOString(), priority, fingerprint };
  }

  const quiet = isWithinQuietHours(
    now.getHours(),
    input.settings.quietHoursStart,
    input.settings.quietHoursEnd
  );

  if (quiet && priority !== "urgent") {
    return {
      deliver: false,
      channel: input.channel,
      reason: "quiet_hours",
      deliverAt: nextQuietHoursEnd(now, input.settings.quietHoursEnd).toISOString(),
      priority,
      fingerprint,
    };
  }

  return {
    deliver: true,
    channel: input.channel,
    reason: priority === "urgent" ? "urgent_override" : "due",
    deliverAt: now.toISOString(),
    priority,
    fingerprint,
  };
}
