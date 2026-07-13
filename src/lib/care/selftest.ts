/**
 * Care domain self-tests (pure + local logic, no DB).
 */

import { addDaysIso, createCheckInSchedule, dedupeCheckInsByDay, refreshCheckInStatuses } from "@/lib/care/schedule";
import { computeProgressDeltas, hasWorseningSignal } from "@/lib/care/progress";
import { evaluateDermatologyReferral } from "@/lib/care/referral";
import {
  applySuggestionToRoutine,
  buildRoutineSuggestions,
} from "@/lib/care/routine-suggestions";
import { detectRoutineConflicts } from "@/lib/care/conflicts";
import {
  buildCheckInDueNotification,
  mergeNotifications,
} from "@/lib/care/notifications";
import type {
  CareCheckInAnswers,
  CareRoutine,
  CareRoutineItem,
} from "@/lib/care/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

export function runCareSelftests(): { ok: true; checks: number } {
  let checks = 0;
  const tz = "Asia/Seoul";
  const start = "2026-07-01T01:00:00.000Z";

  const d3 = addDaysIso(start, 3, tz);
  const d7 = addDaysIso(start, 7, tz);
  assert(Date.parse(d3) > Date.parse(start), "day3 after start");
  assert(Date.parse(d7) > Date.parse(d3), "day7 after day3");
  checks += 1;

  let n = 0;
  const schedule = createCheckInSchedule({
    analysisSessionId: "an1",
    routineId: "rt1",
    startAt: start,
    timezone: tz,
    idFactory: () => `ci_${++n}`,
  });
  assert(schedule.length === 4, "4 checkins");
  assert(schedule.map((c) => c.day).join(",") === "3,7,15,30", "days");
  checks += 1;

  const beforeDue = refreshCheckInStatuses(schedule, "2026-07-02T00:00:00.000Z");
  assert(beforeDue.every((c) => c.status === "scheduled"), "not due yet");
  const afterDue = refreshCheckInStatuses(schedule, d3);
  assert(afterDue.some((c) => c.day === 3 && c.status === "due"), "day3 due");
  checks += 1;

  const dup = dedupeCheckInsByDay([
    ...schedule,
    { ...schedule[0]!, id: "x", status: "completed" },
  ]);
  assert(dup.filter((c) => c.day === 3).length === 1, "dedupe day3");
  checks += 1;

  const answers: CareCheckInAnswers = {
    stillUsing: true,
    sting: 2,
    itch: 1,
    redness: 2,
    dryness: 7,
    oiliness: 3,
    breakouts: 2,
    swelling: 0,
    peeling: 1,
    satisfaction: 6,
    adherence: 8,
    photoAttached: false,
    freeMemo: null,
  };
  const deltas = computeProgressDeltas(
    { ...answers, dryness: 4, satisfaction: 8 },
    answers
  );
  assert(
    deltas.some((d) => d.metric === "dryness" && d.trend === "worsened"),
    "dryness worsened"
  );
  assert(hasWorseningSignal(deltas), "worsening signal");
  checks += 1;

  const emergency = evaluateDermatologyReferral({
    ...answers,
    swelling: 9,
  });
  assert(emergency.level === "seek_emergency_care", "emergency level");
  assert(emergency.userMessage.includes("진단이 아닙니다") || emergency.userMessage.includes("진단"), "no diagnosis claim wording");
  checks += 1;

  const items: CareRoutineItem[] = [
    {
      id: "i1",
      step: "treatment",
      productId: null,
      customProductName: "Retinol Serum",
      timeOfDay: "pm",
      frequency: "daily",
      order: 1,
      startedAt: start,
      stoppedAt: null,
      usageNote: null,
      cautionNotes: [],
      allergyConflict: false,
      active: true,
    },
    {
      id: "i2",
      step: "exfoliant",
      productId: null,
      customProductName: "AHA Toner",
      timeOfDay: "pm",
      frequency: "daily",
      order: 2,
      startedAt: start,
      stoppedAt: null,
      usageNote: null,
      cautionNotes: [],
      allergyConflict: false,
      active: true,
    },
  ];
  const conflicts = detectRoutineConflicts(items, [], []);
  assert(conflicts.length >= 1, "retinoid+exfoliant caution");
  checks += 1;

  const checkIn = afterDue.find((c) => c.day === 3)!;
  const suggestions = buildRoutineSuggestions({
    checkIn,
    answers: { ...answers, sting: 8, redness: 8 },
    deltas,
    routine: {
      id: "rt1",
      analysisSessionId: "an1",
      version: 1,
      createdAt: start,
      updatedAt: start,
      timezone: tz,
      items,
      conflictNotes: conflicts,
    },
  });
  assert(suggestions.length >= 1, "suggestions");
  assert(suggestions.every((s) => s.requiresUserConfirm === true), "no auto apply");
  const routine: CareRoutine = {
    id: "rt1",
    analysisSessionId: "an1",
    version: 1,
    createdAt: start,
    updatedAt: start,
    timezone: tz,
    items,
    conflictNotes: [],
  };
  const applied = applySuggestionToRoutine(routine, suggestions[0]!);
  assert(applied.version === 2, "version bump only on apply");
  assert(routine.version === 1, "original unchanged");
  checks += 1;

  const n1 = buildCheckInDueNotification(checkIn, () => "n1");
  const n2 = buildCheckInDueNotification(checkIn, () => "n2");
  const merged = mergeNotifications([], [n1, n2], [checkIn]);
  assert(merged.length === 1, "notif dedupe");
  const completed = { ...checkIn, status: "completed" as const };
  const noRe = mergeNotifications([n1], [n2], [completed]);
  assert(noRe.length === 1, "no renotify completed");
  checks += 1;

  return { ok: true, checks };
}
