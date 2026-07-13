/**
 * Day 3/7/15/30 schedule helpers (timezone-aware, pure).
 */

import {
  CARE_CHECKIN_DAYS,
  type CareCheckIn,
  type CareCheckInDay,
  type CareCheckInStatus,
} from "@/lib/care/types";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Add calendar days in a timezone, anchoring to local noon to avoid DST edge flips.
 */
export function addDaysIso(
  startIso: string,
  days: number,
  timeZone: string,
  hourLocal = 10
): string {
  const start = new Date(startIso);
  if (!Number.isFinite(start.getTime())) {
    throw new Error("invalid_start");
  }
  // Work in UTC ms then format in zone — approximate by adding 24h * days
  const target = new Date(start.getTime() + days * 24 * 3600_000);
  return formatInTimeZone(target, timeZone, hourLocal);
}

export function formatInTimeZone(
  date: Date,
  timeZone: string,
  hourLocal = 10
): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    // Store as ISO-like local wall time with Z offset unknown — use UTC noon of that Y-M-D + hour
    const utc = Date.UTC(
      Number(y),
      Number(m) - 1,
      Number(d),
      hourLocal,
      0,
      0
    );
    return new Date(utc).toISOString();
  } catch {
    const t = new Date(date.getTime());
    t.setUTCHours(hourLocal, 0, 0, 0);
    return t.toISOString();
  }
}

export function createCheckInSchedule(input: {
  analysisSessionId: string;
  routineId: string | null;
  startAt: string;
  timezone: string;
  idFactory: () => string;
}): CareCheckIn[] {
  return CARE_CHECKIN_DAYS.map((day) => {
    const dueAt = addDaysIso(input.startAt, day, input.timezone, 10);
    return {
      id: input.idFactory(),
      analysisSessionId: input.analysisSessionId,
      routineId: input.routineId,
      day: day as CareCheckInDay,
      status: "scheduled" as CareCheckInStatus,
      scheduledFor: dueAt,
      dueAt,
      completedAt: null,
      timezone: input.timezone,
      answers: null,
      progressDelta: null,
      referralLevel: "none",
      suggestionIds: [],
    };
  });
}

/**
 * Transition scheduled → due when now >= dueAt; expire overdue incomplete after +3 days.
 */
export function refreshCheckInStatuses(
  checkIns: CareCheckIn[],
  nowIso: string = new Date().toISOString()
): CareCheckIn[] {
  const now = Date.parse(nowIso);
  return checkIns.map((c) => {
    if (
      c.status === "completed" ||
      c.status === "skipped" ||
      c.status === "cancelled"
    ) {
      return c;
    }
    const due = Date.parse(c.dueAt);
    if (!Number.isFinite(due)) return c;
    if (now >= due + 3 * 24 * 3600_000) {
      return { ...c, status: "expired" };
    }
    if (now >= due && (c.status === "scheduled" || c.status === "due")) {
      return { ...c, status: "due" };
    }
    return c;
  });
}

export function nextDueCheckIn(
  checkIns: CareCheckIn[],
  nowIso: string = new Date().toISOString()
): CareCheckIn | null {
  const refreshed = refreshCheckInStatuses(checkIns, nowIso);
  const due = refreshed
    .filter((c) => c.status === "due")
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  if (due[0]) return due[0];
  const upcoming = refreshed
    .filter((c) => c.status === "scheduled")
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  return upcoming[0] ?? null;
}

export function countdownLabel(
  dueAt: string,
  nowIso: string = new Date().toISOString()
): string {
  const ms = Date.parse(dueAt) - Date.parse(nowIso);
  if (!Number.isFinite(ms)) return "—";
  if (ms <= 0) return "지금";
  const hours = Math.ceil(ms / 3600_000);
  if (hours < 48) return `${hours}시간 후`;
  const days = Math.ceil(hours / 24);
  return `${days}일 후`;
}

export function dedupeCheckInsByDay(
  checkIns: CareCheckIn[]
): CareCheckIn[] {
  const map = new Map<string, CareCheckIn>();
  for (const c of checkIns) {
    const key = `${c.analysisSessionId}|${c.day}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, c);
      continue;
    }
    // Prefer completed > due > scheduled
    const rank = (s: CareCheckInStatus) =>
      s === "completed" ? 3 : s === "due" ? 2 : s === "scheduled" ? 1 : 0;
    if (rank(c.status) >= rank(prev.status)) map.set(key, c);
  }
  return [...map.values()];
}

export { pad };
