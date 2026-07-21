/**
 * Care notification preferences (channel consent / locale / timezone).
 * Server persistence: auth.users raw_user_meta_data.care_notification_prefs
 * No new DB migration.
 */

import type { CareUserSettings } from "@/lib/care/types";
import {
  defaultCareUserSettings,
  normalizeCareUserSettings,
} from "@/lib/care/settingsDefaults";

export const CARE_NOTIFICATION_PREFS_META_KEY = "care_notification_prefs";

export type CareNotificationPrefsPayload = {
  notificationsEnabled?: boolean;
  emailOptIn?: boolean;
  careEmailChannelConsent?: boolean;
  locale?: "ko" | "en" | "ja";
  timezone?: string;
  quietHoursStart?: number;
  quietHoursEnd?: number;
};

export function parseCareNotificationPrefsFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  timezoneFallback = "Asia/Seoul"
): CareUserSettings {
  const raw = metadata?.[CARE_NOTIFICATION_PREFS_META_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return defaultCareUserSettings(timezoneFallback);
  }
  return normalizeCareUserSettings(
    raw as CareNotificationPrefsPayload,
    timezoneFallback
  );
}

export function toCareNotificationPrefsPayload(
  settings: CareUserSettings
): CareNotificationPrefsPayload {
  return {
    notificationsEnabled: settings.notificationsEnabled,
    emailOptIn: settings.emailOptIn,
    careEmailChannelConsent: settings.careEmailChannelConsent === true,
    locale: settings.locale ?? "ko",
    timezone: settings.timezone,
    quietHoursStart: settings.quietHoursStart,
    quietHoursEnd: settings.quietHoursEnd,
  };
}

export function mergeCareNotificationPrefsMetadata(
  existingMetadata: Record<string, unknown> | null | undefined,
  settings: CareUserSettings
): Record<string, unknown> {
  return {
    ...(existingMetadata ?? {}),
    [CARE_NOTIFICATION_PREFS_META_KEY]: toCareNotificationPrefsPayload(settings),
  };
}
