/**
 * Check-in schedule SSOT — re-exports schedule helpers with a stable API.
 * UTC storage + user timezone display. Never invents medical claims.
 */

import {
  CARE_CHECKIN_DAYS,
  type CareCheckIn,
  type CareCheckInDay,
  type CareCheckInStatus,
} from "@/lib/care/types";
import {
  addDaysIso,
  createCheckInSchedule,
  countdownLabel,
  dedupeCheckInsByDay,
  nextDueCheckIn,
  refreshCheckInStatuses,
} from "@/lib/care/schedule";

export const CHECKIN_MILESTONES = CARE_CHECKIN_DAYS;

export function getCheckinMilestones(): readonly CareCheckInDay[] {
  return CARE_CHECKIN_DAYS;
}

export type CalculateCheckinDatesInput = {
  analysisSessionId: string;
  routineId: string | null;
  /** Analysis completed or routine start (ISO UTC). */
  startAt: string;
  timezone: string;
  idFactory: () => string;
};

/** Build Day 3/7/15/30 rows. dueAt stored as ISO (UTC). */
export function calculateCheckinDates(
  input: CalculateCheckinDatesInput
): CareCheckIn[] {
  return createCheckInSchedule(input);
}

export function getNextCheckin(
  checkIns: CareCheckIn[],
  nowIso: string = new Date().toISOString()
): CareCheckIn | null {
  return nextDueCheckIn(checkIns, nowIso);
}

export function isCheckinDue(
  checkIn: CareCheckIn,
  nowIso: string = new Date().toISOString()
): boolean {
  if (
    checkIn.status === "completed" ||
    checkIn.status === "skipped" ||
    checkIn.status === "cancelled"
  ) {
    return false;
  }
  const refreshed = refreshCheckInStatuses([checkIn], nowIso)[0];
  return refreshed?.status === "due";
}

/**
 * Prefer completed/due over scheduled duplicates for the same session+day.
 * Call before persisting a new schedule batch.
 */
export function preventDuplicateSchedule(
  existing: CareCheckIn[],
  incoming: CareCheckIn[]
): CareCheckIn[] {
  return dedupeCheckInsByDay([...existing, ...incoming]);
}

/**
 * Re-analysis policy:
 * - Keep completed/skipped rows from prior sessions.
 * - Cancel remaining scheduled/due from the SAME analysis session when replaced.
 * - New session gets a fresh 3/7/15/30 schedule (caller creates via calculateCheckinDates).
 */
export function resolveScheduleOnReanalysis(input: {
  existing: CareCheckIn[];
  previousAnalysisSessionId: string | null;
  nowIso?: string;
}): CareCheckIn[] {
  const now = input.nowIso ?? new Date().toISOString();
  if (!input.previousAnalysisSessionId) {
    return refreshCheckInStatuses(input.existing, now);
  }
  return refreshCheckInStatuses(
    input.existing.map((c) => {
      if (c.analysisSessionId !== input.previousAnalysisSessionId) return c;
      if (
        c.status === "completed" ||
        c.status === "skipped" ||
        c.status === "cancelled"
      ) {
        return c;
      }
      return { ...c, status: "cancelled" as CareCheckInStatus };
    }),
    now
  );
}

/**
 * When user pauses/stops routine: cancel future scheduled/due for that routine.
 * Completed history is preserved.
 */
export function cancelFutureCheckInsForRoutine(
  checkIns: CareCheckIn[],
  routineId: string
): CareCheckIn[] {
  return checkIns.map((c) => {
    if (c.routineId !== routineId) return c;
    if (c.status === "scheduled" || c.status === "due") {
      return { ...c, status: "cancelled" as CareCheckInStatus };
    }
    return c;
  });
}

/** True if this session+day already has a terminal or active row. */
export function hasExistingMilestone(
  checkIns: CareCheckIn[],
  analysisSessionId: string,
  day: CareCheckInDay
): boolean {
  return checkIns.some(
    (c) =>
      c.analysisSessionId === analysisSessionId &&
      c.day === day &&
      c.status !== "cancelled"
  );
}

/** Do not regenerate a completed milestone. */
export function filterOutCompletedMilestones(
  proposed: CareCheckIn[],
  existing: CareCheckIn[]
): CareCheckIn[] {
  const done = new Set(
    existing
      .filter((c) => c.status === "completed" || c.status === "skipped")
      .map((c) => `${c.analysisSessionId}|${c.day}`)
  );
  return proposed.filter(
    (c) => !done.has(`${c.analysisSessionId}|${c.day}`)
  );
}

