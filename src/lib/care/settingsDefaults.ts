/**
 * Shared CareUserSettings defaults / normalization (local + server).
 */

import type { CareUserSettings } from "@/lib/care/types";

export function defaultCareUserSettings(timezone: string): CareUserSettings {
  return {
    notificationsEnabled: true,
    emailOptIn: false,
    careEmailChannelConsent: false,
    locale: "ko",
    quietHoursStart: 22,
    quietHoursEnd: 8,
    timezone: timezone || "Asia/Seoul",
  };
}

export function normalizeCareUserSettings(
  partial: Partial<CareUserSettings> | null | undefined,
  timezoneFallback = "Asia/Seoul"
): CareUserSettings {
  const base = defaultCareUserSettings(
    partial?.timezone || timezoneFallback
  );
  const locale = partial?.locale;
  return {
    notificationsEnabled: partial?.notificationsEnabled ?? base.notificationsEnabled,
    emailOptIn: partial?.emailOptIn ?? base.emailOptIn,
    careEmailChannelConsent:
      partial?.careEmailChannelConsent ?? base.careEmailChannelConsent,
    locale:
      locale === "en" || locale === "ja" || locale === "ko" ? locale : base.locale,
    quietHoursStart: partial?.quietHoursStart ?? base.quietHoursStart,
    quietHoursEnd: partial?.quietHoursEnd ?? base.quietHoursEnd,
    timezone: (partial?.timezone || base.timezone).trim() || "Asia/Seoul",
  };
}
