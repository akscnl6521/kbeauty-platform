/**
 * Pure orchestrator: site notifications + email queue decisions for due/reminder.
 * No DB writes, no live email provider calls.
 */

import {
  buildCheckInDueNotification,
  checkInDueFingerprint,
} from "@/lib/care/notifications";
import type { CareCheckIn, CareNotification, CareUserSettings } from "@/lib/care/types";
import {
  evaluateCheckinEmailEligibility,
  type CheckinEmailCandidate,
  type CheckinEmailQueueDecision,
} from "@/lib/retention/checkinEmailQueuePolicy";
import type { CheckinLocale } from "@/lib/retention/checkinPolicy";

export type CheckinSchedulingSettingsInput = Pick<
  CareUserSettings,
  "notificationsEnabled" | "emailOptIn" | "timezone"
> & {
  careEmailChannelConsent?: boolean;
  locale?: CareUserSettings["locale"];
  /** Care tracking consent; defaults true when omitted (schedule already exists). */
  careCheckinConsent?: boolean;
  marketingConsent?: boolean;
};

export type CheckinSchedulingAction =
  | {
      type: "create_in_app_notification";
      checkInId: string;
      fingerprint: string;
      notification: CareNotification;
    }
  | {
      type: "enqueue_email";
      kind: "checkin_due" | "checkin_reminder";
      checkInId: string;
      candidate: CheckinEmailCandidate;
    }
  | {
      type: "skip";
      checkInId: string;
      channel: "in_app" | "email_due" | "email_reminder";
      reason: string;
    };

export type CheckinSchedulingItemResult = {
  checkInId: string;
  day: CareCheckIn["day"];
  inApp: {
    deliver: boolean;
    reason: string;
    fingerprint: string;
    notification: CareNotification | null;
  };
  emailDue: CheckinEmailQueueDecision;
  emailReminder: CheckinEmailQueueDecision;
};

export type CheckinSchedulingOrchestratorResult = {
  items: CheckinSchedulingItemResult[];
  actions: CheckinSchedulingAction[];
};

export function resolveCareNotificationLocale(
  settings: Pick<CheckinSchedulingSettingsInput, "locale"> | null | undefined
): CheckinLocale {
  const locale = settings?.locale;
  if (locale === "en" || locale === "ja" || locale === "ko") return locale;
  return "ko";
}

/**
 * Derive reminderCount from queue idempotency keys and/or sent reminder identifiers.
 * Keys use: checkin-email:v1:{user}:{checkinId}:{milestone}:checkin_reminder:email
 */
export function deriveReminderCountFromQueueKeys(
  checkInId: string,
  existingKeysOrSentReminderIds: Iterable<string> | null | undefined
): number {
  const id = checkInId.trim().toLowerCase();
  if (!id) return 0;
  let count = 0;
  for (const raw of existingKeysOrSentReminderIds ?? []) {
    const key = String(raw).trim().toLowerCase();
    if (!key) continue;
    if (key.includes(":checkin_reminder:email") && key.includes(":" + id + ":")) {
      count += 1;
      continue;
    }
    if (
      key === "reminder:" + id ||
      key === "sent-reminder:" + id ||
      key.endsWith(":checkin_reminder:" + id)
    ) {
      count += 1;
    }
  }
  return count;
}

export function mapSettingsToEmailConsent(
  settings: CheckinSchedulingSettingsInput
): {
  careEmailChannelConsent: boolean;
  marketingConsent: boolean;
  notificationsEnabled: boolean;
  careCheckinConsent: boolean;
  locale: CheckinLocale;
  timezone: string;
} {
  const marketingConsent =
    settings.marketingConsent ?? settings.emailOptIn ?? false;
  return {
    careEmailChannelConsent: settings.careEmailChannelConsent === true,
    marketingConsent: Boolean(marketingConsent),
    notificationsEnabled: settings.notificationsEnabled !== false,
    careCheckinConsent: settings.careCheckinConsent !== false,
    locale: resolveCareNotificationLocale(settings),
    timezone: (settings.timezone || "Asia/Seoul").trim() || "Asia/Seoul",
  };
}

function decideInAppDue(input: {
  checkIn: CareCheckIn;
  notificationsEnabled: boolean;
  existingNotificationFingerprints: Set<string>;
  idFactory: () => string;
}): CheckinSchedulingItemResult["inApp"] & {
  action: CheckinSchedulingAction | null;
} {
  const fingerprint = checkInDueFingerprint(input.checkIn.id);
  if (input.checkIn.status !== "due" && input.checkIn.status !== "scheduled") {
    return {
      deliver: false,
      reason: "checkin_not_open",
      fingerprint,
      notification: null,
      action: {
        type: "skip",
        checkInId: input.checkIn.id,
        channel: "in_app",
        reason: "checkin_not_open",
      },
    };
  }
  if (input.checkIn.status !== "due") {
    return {
      deliver: false,
      reason: "not_due",
      fingerprint,
      notification: null,
      action: {
        type: "skip",
        checkInId: input.checkIn.id,
        channel: "in_app",
        reason: "not_due",
      },
    };
  }
  if (!input.notificationsEnabled) {
    return {
      deliver: false,
      reason: "in_app_opt_out",
      fingerprint,
      notification: null,
      action: {
        type: "skip",
        checkInId: input.checkIn.id,
        channel: "in_app",
        reason: "in_app_opt_out",
      },
    };
  }
  if (input.existingNotificationFingerprints.has(fingerprint)) {
    return {
      deliver: false,
      reason: "duplicate",
      fingerprint,
      notification: null,
      action: {
        type: "skip",
        checkInId: input.checkIn.id,
        channel: "in_app",
        reason: "duplicate",
      },
    };
  }
  const notification = buildCheckInDueNotification(input.checkIn, input.idFactory);
  return {
    deliver: true,
    reason: "due",
    fingerprint,
    notification,
    action: {
      type: "create_in_app_notification",
      checkInId: input.checkIn.id,
      fingerprint,
      notification,
    },
  };
}

export function orchestrateCheckinScheduling(input: {
  subjectId: string;
  checkIns: CareCheckIn[];
  settings: CheckinSchedulingSettingsInput;
  email: string;
  existingNotificationFingerprints?: Iterable<string>;
  existingEmailIdempotencyKeys?: Iterable<string>;
  /** Optional explicit sent-reminder markers; merged into reminderCount derivation. */
  sentReminderKeys?: Iterable<string>;
  now?: Date;
  idFactory?: () => string;
  alertSuppressed?: boolean;
}): CheckinSchedulingOrchestratorResult {
  const now = input.now ?? new Date();
  const consent = mapSettingsToEmailConsent(input.settings);
  const fingerprints = new Set(
    [...(input.existingNotificationFingerprints ?? [])].map((f) => f.trim())
  );
  const emailKeys = new Set(
    [...(input.existingEmailIdempotencyKeys ?? [])].map((k) => k.trim())
  );
  const reminderSeed = [
    ...(input.existingEmailIdempotencyKeys ?? []),
    ...(input.sentReminderKeys ?? []),
  ];
  let n = 0;
  const idFactory =
    input.idFactory ??
    (() => "orch_nt_" + String(++n) + "_" + now.getTime().toString(36));

  const items: CheckinSchedulingItemResult[] = [];
  const actions: CheckinSchedulingAction[] = [];

  for (const checkIn of input.checkIns) {
    const inAppDecided = decideInAppDue({
      checkIn,
      notificationsEnabled: consent.notificationsEnabled,
      existingNotificationFingerprints: fingerprints,
      idFactory,
    });
    if (inAppDecided.action) actions.push(inAppDecided.action);
    if (inAppDecided.deliver && inAppDecided.fingerprint) {
      fingerprints.add(inAppDecided.fingerprint);
    }

    const reminderCount = deriveReminderCountFromQueueKeys(
      checkIn.id,
      reminderSeed
    );

    const emailDue = evaluateCheckinEmailEligibility({
      subjectId: input.subjectId,
      checkIn,
      kind: "checkin_due",
      email: input.email,
      careCheckinConsent: consent.careCheckinConsent,
      careEmailChannelConsent: consent.careEmailChannelConsent,
      marketingConsent: consent.marketingConsent,
      notificationsEnabled: consent.notificationsEnabled,
      locale: consent.locale,
      timezone: consent.timezone,
      now,
      existingIdempotencyKeys: emailKeys,
      alertSuppressed: input.alertSuppressed,
      reminderCount,
    });

    if (emailDue.eligible && emailDue.candidate) {
      emailKeys.add(emailDue.candidate.idempotencyKey);
      actions.push({
        type: "enqueue_email",
        kind: "checkin_due",
        checkInId: checkIn.id,
        candidate: emailDue.candidate,
      });
    } else {
      actions.push({
        type: "skip",
        checkInId: checkIn.id,
        channel: "email_due",
        reason: emailDue.reason,
      });
    }

    const emailReminder = evaluateCheckinEmailEligibility({
      subjectId: input.subjectId,
      checkIn,
      kind: "checkin_reminder",
      email: input.email,
      careCheckinConsent: consent.careCheckinConsent,
      careEmailChannelConsent: consent.careEmailChannelConsent,
      marketingConsent: consent.marketingConsent,
      notificationsEnabled: consent.notificationsEnabled,
      locale: consent.locale,
      timezone: consent.timezone,
      now,
      existingIdempotencyKeys: emailKeys,
      alertSuppressed: input.alertSuppressed,
      reminderCount,
    });

    if (emailReminder.eligible && emailReminder.candidate) {
      emailKeys.add(emailReminder.candidate.idempotencyKey);
      reminderSeed.push(emailReminder.candidate.idempotencyKey);
      actions.push({
        type: "enqueue_email",
        kind: "checkin_reminder",
        checkInId: checkIn.id,
        candidate: emailReminder.candidate,
      });
    } else {
      actions.push({
        type: "skip",
        checkInId: checkIn.id,
        channel: "email_reminder",
        reason: emailReminder.reason,
      });
    }

    items.push({
      checkInId: checkIn.id,
      day: checkIn.day,
      inApp: {
        deliver: inAppDecided.deliver,
        reason: inAppDecided.reason,
        fingerprint: inAppDecided.fingerprint,
        notification: inAppDecided.notification,
      },
      emailDue,
      emailReminder,
    });
  }

  return { items, actions };
}
