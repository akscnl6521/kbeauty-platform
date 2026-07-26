/**
 * P3-T03 constants — refresh windows, backoff, scheduler hints.
 */

import type { RefreshPriority } from "./types";

export const SAFE_ENDPOINT_NOTE =
  "offline://automated-refresh-ops-manifest" as const;

/** Product refresh cadence: daily (artifact-only). */
export const PRODUCT_DAILY_CRON_UTC = "20 0 * * *" as const;
export const PRODUCT_DAILY_CRON_NOTE_KO =
  "매일 09:20 KST · 아티팩트 전용 · Production 스케줄 미생성" as const;

/** Clinic refresh cadence: Mon/Thu (artifact-only). */
export const CLINIC_TWICE_WEEKLY_CRON_UTC = "40 0 * * 1,4" as const;
export const CLINIC_TWICE_WEEKLY_CRON_NOTE_KO =
  "매주 월·목 09:40 KST · 아티팩트 전용 · Production 스케줄 미생성" as const;

/** Stale thresholds (days). */
export const PRODUCT_STALE_DAYS = 30;
export const PRODUCT_HARD_STALE_DAYS = 90;
export const CLINIC_STALE_DAYS = 90;
export const CLINIC_HARD_STALE_DAYS = 180;

/** Exponential backoff (deterministic, no network). */
export const RETRY_BASE_MS = 60_000;
export const RETRY_MAX_MS = 24 * 60 * 60 * 1000;
export const RETRY_MAX_ATTEMPTS = 5;

export const PRIORITY_RANK: Record<RefreshPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const EMPTY_PRIORITY_COUNTS = (): Record<RefreshPriority, number> => ({
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
});
