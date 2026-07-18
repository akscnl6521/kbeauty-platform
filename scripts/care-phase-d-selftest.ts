/**
 * Phase D care selftest runner (no DB).
 * npx tsx scripts/care-phase-d-selftest.ts
 */
import {
  calculateCheckinDates,
  cancelFutureCheckInsForRoutine,
  filterOutCompletedMilestones,
  getCheckinMilestones,
  getNextCheckin,
  isCheckinDue,
  preventDuplicateSchedule,
  resolveScheduleOnReanalysis,
} from "../src/lib/care/checkinSchedule";
import { getCheckinStepsForDay, getDayFocusCopy } from "../src/lib/care/checkinQuestions";
import { evaluateSafetyGate } from "../src/lib/care/safetyGate";
import { evaluateDermatologyReferral } from "../src/lib/care/referral";
import { buildRoutineSuggestions } from "../src/lib/care/routine-suggestions";
import { sendCareEmail } from "../src/lib/care/email/adapter";
import { runCareSelftests } from "../src/lib/care/selftest";
import type { CareCheckInAnswers, CareRoutine } from "../src/lib/care/types";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const base = runCareSelftests();
  let checks = base.checks;

  assert(getCheckinMilestones().join(",") === "3,7,15,30", "milestones");
  checks += 1;

  let n = 0;
  const schedule = calculateCheckinDates({
    analysisSessionId: "an_new",
    routineId: "rt1",
    startAt: "2026-07-01T01:00:00.000Z",
    timezone: "Asia/Seoul",
    idFactory: () => `c_${++n}`,
  });
  assert(schedule.length === 4, "4 dates");
  checks += 1;

  const due = schedule[0]!;
  assert(isCheckinDue(due, due.dueAt) === true, "is due at dueAt");
  assert(getNextCheckin(schedule, due.dueAt)?.day === 3, "next day3");
  checks += 1;

  const completed = { ...due, status: "completed" as const };
  const filtered = filterOutCompletedMilestones(schedule, [completed]);
  assert(filtered.every((c) => c.day !== 3), "no regen completed");
  checks += 1;

  const dup = preventDuplicateSchedule(schedule, schedule);
  assert(dup.length === 4, "dedupe schedule");
  checks += 1;

  const re = resolveScheduleOnReanalysis({
    existing: schedule,
    previousAnalysisSessionId: "an_new",
  });
  assert(re.every((c) => c.status === "cancelled"), "reanalysis cancels open");
  checks += 1;

  const cancelled = cancelFutureCheckInsForRoutine(schedule, "rt1");
  assert(
    cancelled.every((c) => c.status === "cancelled"),
    "routine stop cancels future"
  );
  checks += 1;

  for (const day of [3, 7, 15, 30] as const) {
    const steps = getCheckinStepsForDay(day);
    assert(steps.length >= 4, `steps day ${day}`);
    assert(getDayFocusCopy(day).length > 10, `focus day ${day}`);
  }
  checks += 1;

  const mild: CareCheckInAnswers = {
    stillUsing: true,
    sting: 5,
    itch: 2,
    redness: 5,
    dryness: 3,
    oiliness: 3,
    breakouts: 2,
    swelling: 1,
    peeling: 1,
    satisfaction: 6,
    adherence: 7,
    photoAttached: false,
    freeMemo: null,
    emergencyFlags: {},
  };
  const mildGate = evaluateSafetyGate(mild);
  assert(mildGate.urgent === false, "mild not urgent");
  assert(mildGate.mildIrritation === true, "mild irritation");
  checks += 1;

  const urgent = evaluateSafetyGate({
    ...mild,
    emergencyFlags: { breathingDifficulty: true },
  });
  assert(urgent.urgent === true, "breathing urgent");
  assert(urgent.suppressProductPush === true, "suppress product push");
  assert(urgent.userMessage.includes("진단이 아닙니다"), "no diagnosis");
  checks += 1;

  const emergency = evaluateDermatologyReferral({
    ...mild,
    emergencyFlags: { immediateSevereReaction: true },
  });
  assert(emergency.level === "seek_emergency_care", "immediate severe");
  checks += 1;

  const routine: CareRoutine = {
    id: "rt1",
    analysisSessionId: "an1",
    version: 1,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    timezone: "Asia/Seoul",
    items: [],
    conflictNotes: [],
  };
  const sugUrgent = buildRoutineSuggestions({
    checkIn: { ...due, day: 3 },
    answers: {
      ...mild,
      swelling: 9,
      emergencyFlags: { severeSwelling: true },
    },
    deltas: [],
    routine,
  });
  assert(
    sugUrgent.every((s) => s.requiresUserConfirm),
    "never auto apply"
  );
  assert(
    !sugUrgent.some((s) => s.title.includes("보습") && s.patch.addMoisturizerHint),
    "urgent suppresses moisturize push style suggestions when filtered"
  );
  checks += 1;

  const emailOptOut = await sendCareEmail({
    to: "a@b.c",
    templateId: "checkin_day_7",
    checkInId: "x",
    day: 7,
    timezone: "Asia/Seoul",
    deepLinkPath: "/my/check-ins/x",
    emailOptIn: false,
  });
  assert(emailOptOut.status === "skipped", "email opt out");
  const emailDry = await sendCareEmail({
    to: "a@b.c",
    templateId: "checkin_day_7",
    checkInId: "x",
    day: 7,
    timezone: "Asia/Seoul",
    deepLinkPath: "/my/check-ins/x",
    emailOptIn: true,
  });
  assert(
    emailDry.status === "dry_run" || emailDry.status === "skipped",
    "email dry or skipped without provider"
  );
  checks += 1;

  console.log(
    JSON.stringify({
      phase: "care_phase_d_selftest_ok",
      checks,
      baseChecks: base.checks,
    })
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
