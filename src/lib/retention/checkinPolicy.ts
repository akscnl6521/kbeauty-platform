/**
 * Retention check-in policy — schedule, response branching, risk signals, reminders.
 * Pure module; no notification delivery or DB writes.
 */

import {
  createCheckInSchedule,
  dedupeCheckInsByDay,
  refreshCheckInStatuses,
} from "@/lib/care/schedule";
import { evaluateDermatologyReferral } from "@/lib/care/referral";
import type {
  CareAcuteSignals,
  CareCheckIn,
  CareCheckInAnswers,
  CareCheckInDay,
  CareCheckInStatus,
  CareProgressDelta,
  CareUserSettings,
} from "@/lib/care/types";
import { CARE_CHECKIN_DAYS } from "@/lib/care/types";

export type CheckinLocale = "ko" | "en" | "ja";

export type CheckinMilestone = "day3" | "day7" | "day15" | "day30";

export type CheckinResponse =
  | "improved"
  | "unchanged"
  | "worsened"
  | "not_started"
  | "stopped"
  | "unsure";

export type CheckinRiskSignal = keyof CareAcuteSignals;

export type CheckinStoppedReason =
  | "irritation"
  | "complexity"
  | "purchase_failed"
  | "other";

export type CheckinAction =
  | "maintain_routine"
  | "review_usage_duration"
  | "review_application_method"
  | "review_expectation_range"
  | "consider_routine_adjustment"
  | "pause_new_products"
  | "simplify_routine"
  | "risk_assessment"
  | "prioritize_consultation"
  | "confirm_not_started_reason"
  | "reschedule_start"
  | "record_stop_reason"
  | "suggest_comparison"
  | "suggest_photo_or_memo";

export type CheckinConsentState = {
  careCheckinConsent: boolean;
  marketingConsent: boolean;
};

export type CheckinRecord = {
  id: string;
  userId: string | null;
  anonymousSessionId: string | null;
  analysisId: string;
  routineId: string | null;
  milestone: CheckinMilestone;
  scheduledAt: string;
  respondedAt: string | null;
  response: CheckinResponse | null;
  riskSignals: CheckinRiskSignal[];
  notes: string | null;
  action: CheckinAction[] | null;
  status: CareCheckInStatus;
  locale: CheckinLocale;
  timezone: string;
  createdAt: string;
  updatedAt: string;
};

export type CheckinDecision = {
  response: CheckinResponse;
  actions: CheckinAction[];
  prioritizeConsultation: boolean;
  urgentRisk: boolean;
  referralRecommended: boolean;
  summaryKey: CheckinResponse;
};

export type CheckinReminderStatus =
  | "none"
  | "awaiting_due"
  | "awaiting_first_reminder"
  | "should_remind"
  | "reminder_sent"
  | "exhausted";

export type CheckinReminderPolicy = {
  shouldRemind: boolean;
  reminderAt: string | null;
  reminderCount: number;
  reminderStatus: CheckinReminderStatus;
};

const MILESTONE_BY_DAY: Record<CareCheckInDay, CheckinMilestone> = {
  3: "day3",
  7: "day7",
  15: "day15",
  30: "day30",
};

const DAY_BY_MILESTONE: Record<CheckinMilestone, CareCheckInDay> = {
  day3: 3,
  day7: 7,
  day15: 15,
  day30: 30,
};

const URGENT_RISK_SIGNALS: CheckinRiskSignal[] = [
  "pain",
  "bleeding",
  "oozing",
  "rapidSwelling",
  "spreadingRash",
  "infectionSuspect",
  "burn",
  "eyeIrritation",
  "breathingDifficulty",
  "systemicAllergy",
];

const REMINDER_DELAY_MS = 48 * 3600_000;

export function milestoneFromDay(day: CareCheckInDay): CheckinMilestone {
  return MILESTONE_BY_DAY[day];
}

export function dayFromMilestone(milestone: CheckinMilestone): CareCheckInDay {
  return DAY_BY_MILESTONE[milestone];
}

export function getMilestoneLabel(
  milestone: CheckinMilestone,
  locale: CheckinLocale = "ko"
): string {
  const day = DAY_BY_MILESTONE[milestone];
  const labels: Record<CheckinLocale, string> = {
    ko: `${day}일`,
    en: `Day ${day}`,
    ja: `${day}日`,
  };
  return labels[locale];
}

export function resolveCheckinConsent(input: {
  consentCareTracking: boolean;
  settings: Pick<CareUserSettings, "emailOptIn">;
}): CheckinConsentState {
  return {
    careCheckinConsent: input.consentCareTracking,
    marketingConsent: input.settings.emailOptIn,
  };
}

export function shouldCreateCheckinSchedule(
  consent: Pick<CheckinConsentState, "careCheckinConsent">
): boolean {
  return consent.careCheckinConsent;
}

export function buildCheckinScheduleIfConsented(input: {
  consent: Pick<CheckinConsentState, "careCheckinConsent">;
  analysisSessionId: string;
  routineId: string | null;
  startAt: string | null | undefined;
  timezone: string;
  idFactory: () => string;
}): CareCheckIn[] {
  if (!shouldCreateCheckinSchedule(input.consent)) return [];
  if (!input.startAt?.trim()) return [];
  return createCheckInSchedule({
    analysisSessionId: input.analysisSessionId,
    routineId: input.routineId,
    startAt: input.startAt,
    timezone: input.timezone,
    idFactory: input.idFactory,
  });
}

/**
 * Recompute future milestones after start-date change; completed records are preserved.
 */
export function mergeCheckinScheduleAfterStartChange(input: {
  existing: CareCheckIn[];
  analysisSessionId: string;
  routineId: string | null;
  newStartAt: string | null | undefined;
  timezone: string;
  idFactory: () => string;
  consent: Pick<CheckinConsentState, "careCheckinConsent">;
}): CareCheckIn[] {
  const others = input.existing.filter(
    (c) => c.analysisSessionId !== input.analysisSessionId
  );
  const same = input.existing.filter(
    (c) => c.analysisSessionId === input.analysisSessionId
  );
  const completed = same.filter((c) => c.status === "completed");

  if (!shouldCreateCheckinSchedule(input.consent) || !input.newStartAt?.trim()) {
    return dedupeCheckInsByDay([...others, ...completed]);
  }

  const fresh = createCheckInSchedule({
    analysisSessionId: input.analysisSessionId,
    routineId: input.routineId,
    startAt: input.newStartAt,
    timezone: input.timezone,
    idFactory: input.idFactory,
  });

  const completedByDay = new Map(completed.map((c) => [c.day, c]));
  const mergedSame = fresh.map((slot) => completedByDay.get(slot.day) ?? slot);
  return dedupeCheckInsByDay([...others, ...mergedSame]);
}

export function extractRiskSignals(
  answers: Pick<CareCheckInAnswers, "acuteSignals">
): CheckinRiskSignal[] {
  const acute = answers.acuteSignals ?? {};
  return URGENT_RISK_SIGNALS.filter((key) => Boolean(acute[key]));
}

export function isUrgentRiskSignal(signals: CheckinRiskSignal[]): boolean {
  return signals.some((s) => URGENT_RISK_SIGNALS.includes(s));
}

export function inferCheckinResponse(
  answers: CareCheckInAnswers,
  context?: {
    previousAnswers?: CareCheckInAnswers | null;
    progressDeltas?: CareProgressDelta[];
  }
): CheckinResponse {
  if (answers.overallResponse) return answers.overallResponse;

  const risk = extractRiskSignals(answers);
  if (isUrgentRiskSignal(risk)) return "worsened";

  if (answers.stillUsing === false) return "stopped";

  const adherence = answers.adherence ?? null;
  if (answers.stillUsing === null || (adherence != null && adherence <= 2)) {
    return "not_started";
  }

  const worsening = context?.progressDeltas?.some((d) => d.trend === "worsened");
  if (worsening) return "worsened";

  const satisfaction = answers.satisfaction ?? null;
  const irritationHigh =
    (answers.sting ?? 0) >= 7 ||
    (answers.redness ?? 0) >= 7 ||
    (answers.itch ?? 0) >= 7;

  if (satisfaction != null && satisfaction >= 7 && !irritationHigh) {
    return "improved";
  }
  if (irritationHigh || (satisfaction != null && satisfaction <= 3)) {
    return "worsened";
  }
  if (satisfaction != null && satisfaction >= 4 && satisfaction <= 6) {
    return "unchanged";
  }

  return "unsure";
}

export function getNextCheckinAction(
  response: CheckinResponse,
  options?: {
    riskSignals?: CheckinRiskSignal[];
    stoppedReason?: CheckinStoppedReason | null;
  }
): CheckinAction[] {
  const risk = options?.riskSignals ?? [];
  if (isUrgentRiskSignal(risk)) {
    return [
      "prioritize_consultation",
      "pause_new_products",
      "simplify_routine",
      "risk_assessment",
    ];
  }

  switch (response) {
    case "improved":
      return ["maintain_routine"];
    case "unchanged":
      return [
        "review_usage_duration",
        "review_application_method",
        "review_expectation_range",
        "consider_routine_adjustment",
      ];
    case "worsened":
      return [
        "pause_new_products",
        "simplify_routine",
        "risk_assessment",
        "prioritize_consultation",
      ];
    case "not_started":
      return ["confirm_not_started_reason", "reschedule_start"];
    case "stopped":
      return ["record_stop_reason", "simplify_routine"];
    case "unsure":
      return ["suggest_comparison", "suggest_photo_or_memo"];
    default:
      return ["suggest_comparison"];
  }
}

export function evaluateCheckinResponse(input: {
  answers: CareCheckInAnswers;
  milestone: CheckinMilestone;
  previousAnswers?: CareCheckInAnswers | null;
  progressDeltas?: CareProgressDelta[];
}): CheckinDecision {
  const riskSignals = extractRiskSignals(input.answers);
  const response = inferCheckinResponse(input.answers, {
    previousAnswers: input.previousAnswers,
    progressDeltas: input.progressDeltas,
  });
  const referral = evaluateDermatologyReferral(input.answers, {
    daysSinceStart: DAY_BY_MILESTONE[input.milestone],
    worsening: response === "worsened",
  });
  const urgentRisk = isUrgentRiskSignal(riskSignals);
  const actions = getNextCheckinAction(response, {
    riskSignals,
    stoppedReason: input.answers.stoppedReason ?? null,
  });

  const prioritizeConsultation =
    urgentRisk ||
    referral.level === "seek_emergency_care" ||
    referral.level === "seek_promptly";

  const finalActions: CheckinAction[] = prioritizeConsultation
    ? [
        "prioritize_consultation",
        ...actions.filter((a) => a !== "prioritize_consultation"),
      ]
    : actions;

  return {
    response,
    actions: Array.from(new Set(finalActions)),
    prioritizeConsultation,
    urgentRisk,
    referralRecommended: referral.level !== "none",
    summaryKey: response,
  };
}

export function mapCareCheckInToRecord(
  checkIn: CareCheckIn,
  context: {
    locale?: CheckinLocale;
    userId?: string | null;
    anonymousSessionId?: string | null;
    createdAt?: string;
    updatedAt?: string;
  } = {}
): CheckinRecord {
  const milestone = milestoneFromDay(checkIn.day);
  const riskSignals = checkIn.answers
    ? extractRiskSignals(checkIn.answers)
    : [];
  const response = checkIn.answers
    ? inferCheckinResponse(checkIn.answers)
    : null;
  const decision =
    checkIn.answers != null
      ? evaluateCheckinResponse({
          answers: checkIn.answers,
          milestone,
        })
      : null;

  return {
    id: checkIn.id,
    userId: context.userId ?? null,
    anonymousSessionId: context.anonymousSessionId ?? null,
    analysisId: checkIn.analysisSessionId,
    routineId: checkIn.routineId,
    milestone,
    scheduledAt: checkIn.scheduledFor,
    respondedAt: checkIn.completedAt,
    response,
    riskSignals,
    notes: checkIn.answers?.freeMemo ?? null,
    action: decision?.actions ?? null,
    status: checkIn.status,
    locale: context.locale ?? "ko",
    timezone: checkIn.timezone,
    createdAt: context.createdAt ?? checkIn.scheduledFor,
    updatedAt: context.updatedAt ?? checkIn.completedAt ?? checkIn.scheduledFor,
  };
}

export function evaluateCheckinReminderPolicy(input: {
  checkIn: Pick<
    CareCheckIn,
    "status" | "dueAt" | "completedAt" | "scheduledFor"
  >;
  reminderCount?: number;
  lastReminderAt?: string | null;
  now?: Date;
}): CheckinReminderPolicy {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const reminderCount = input.reminderCount ?? 0;

  if (
    input.checkIn.status === "completed" ||
    input.checkIn.status === "skipped" ||
    input.checkIn.status === "cancelled" ||
    input.checkIn.status === "expired"
  ) {
    return {
      shouldRemind: false,
      reminderAt: null,
      reminderCount,
      reminderStatus: "exhausted",
    };
  }

  const dueMs = Date.parse(input.checkIn.dueAt);
  if (!Number.isFinite(dueMs)) {
    return {
      shouldRemind: false,
      reminderAt: null,
      reminderCount,
      reminderStatus: "none",
    };
  }

  const firstReminderAt = new Date(dueMs + REMINDER_DELAY_MS).toISOString();

  if (nowMs < dueMs) {
    return {
      shouldRemind: false,
      reminderAt: firstReminderAt,
      reminderCount,
      reminderStatus: "awaiting_due",
    };
  }

  if (reminderCount >= 1) {
    return {
      shouldRemind: false,
      reminderAt: null,
      reminderCount,
      reminderStatus: "exhausted",
    };
  }

  if (nowMs < dueMs + REMINDER_DELAY_MS) {
    return {
      shouldRemind: false,
      reminderAt: firstReminderAt,
      reminderCount: 0,
      reminderStatus: "awaiting_first_reminder",
    };
  }

  return {
    shouldRemind: true,
    reminderAt: firstReminderAt,
    reminderCount: 0,
    reminderStatus: "should_remind",
  };
}

export function refreshCheckinCollection(
  checkIns: CareCheckIn[],
  nowIso?: string
): CareCheckIn[] {
  return refreshCheckInStatuses(checkIns, nowIso);
}

export { CARE_CHECKIN_DAYS, dedupeCheckInsByDay };

export function runCheckinPolicySelftests(): { ok: true; checks: number } {
  let checks = 0;
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(msg);
  };

  const tz = "Asia/Seoul";
  const start = "2026-07-01T01:00:00.000Z";
  let n = 0;

  const withConsent = buildCheckinScheduleIfConsented({
    consent: { careCheckinConsent: true },
    analysisSessionId: "an1",
    routineId: "rt1",
    startAt: start,
    timezone: tz,
    idFactory: () => `ci_${++n}`,
  });
  assert(withConsent.length === 4, "schedule 4 milestones");
  assert(
    withConsent.map((c) => milestoneFromDay(c.day)).join(",") ===
      "day3,day7,day15,day30",
    "milestones order"
  );
  checks += 1;

  const noStart = buildCheckinScheduleIfConsented({
    consent: { careCheckinConsent: true },
    analysisSessionId: "an1",
    routineId: "rt1",
    startAt: null,
    timezone: tz,
    idFactory: () => `ci_${++n}`,
  });
  assert(noStart.length === 0, "no start no schedule");
  checks += 1;

  const noConsent = buildCheckinScheduleIfConsented({
    consent: { careCheckinConsent: false },
    analysisSessionId: "an1",
    routineId: "rt1",
    startAt: start,
    timezone: tz,
    idFactory: () => `ci_${++n}`,
  });
  assert(noConsent.length === 0, "no consent no schedule");
  checks += 1;

  const completed = {
    ...withConsent[0]!,
    status: "completed" as CareCheckInStatus,
    completedAt: "2026-07-04T00:00:00.000Z",
  };
  const remerged = mergeCheckinScheduleAfterStartChange({
    existing: [completed, ...withConsent.slice(1)],
    analysisSessionId: "an1",
    routineId: "rt1",
    newStartAt: "2026-07-05T00:00:00.000Z",
    timezone: tz,
    idFactory: () => `ci_${++n}`,
    consent: { careCheckinConsent: true },
  });
  const day3 = remerged.find((c) => c.day === 3);
  assert(day3?.status === "completed", "completed preserved");
  checks += 1;

  const duped = dedupeCheckInsByDay([
    withConsent[0]!,
    { ...withConsent[0]!, id: "dup", status: "scheduled" },
  ]);
  assert(duped.filter((c) => c.day === 3).length === 1, "dedupe");
  checks += 1;

  const improved = evaluateCheckinResponse({
    answers: {
      stillUsing: true,
      sting: 1,
      itch: 1,
      redness: 1,
      dryness: 2,
      oiliness: 3,
      breakouts: 1,
      swelling: 0,
      peeling: 0,
      satisfaction: 8,
      adherence: 8,
      photoAttached: false,
      freeMemo: null,
      overallResponse: "improved",
    },
    milestone: "day7",
  });
  assert(
    improved.actions.includes("maintain_routine"),
    "improved maintain"
  );
  checks += 1;

  const unchanged = evaluateCheckinResponse({
    answers: {
      stillUsing: true,
      sting: 3,
      itch: 3,
      redness: 3,
      dryness: 4,
      oiliness: 4,
      breakouts: 3,
      swelling: 1,
      peeling: 1,
      satisfaction: 5,
      adherence: 6,
      photoAttached: false,
      freeMemo: null,
      overallResponse: "unchanged",
    },
    milestone: "day15",
  });
  assert(
    unchanged.actions.includes("review_usage_duration"),
    "unchanged review duration"
  );
  checks += 1;

  const worsened = evaluateCheckinResponse({
    answers: {
      stillUsing: true,
      sting: 8,
      itch: 7,
      redness: 8,
      dryness: 4,
      oiliness: 4,
      breakouts: 7,
      swelling: 2,
      peeling: 1,
      satisfaction: 2,
      adherence: 5,
      photoAttached: false,
      freeMemo: null,
      overallResponse: "worsened",
    },
    milestone: "day7",
  });
  assert(
    worsened.actions.includes("pause_new_products"),
    "worsened pause"
  );
  checks += 1;

  const risk = evaluateCheckinResponse({
    answers: {
      stillUsing: true,
      sting: 2,
      itch: 2,
      redness: 2,
      dryness: 2,
      oiliness: 2,
      breakouts: 2,
      swelling: 2,
      peeling: 0,
      satisfaction: 5,
      adherence: 5,
      photoAttached: false,
      freeMemo: null,
      acuteSignals: { pain: true, bleeding: true },
    },
    milestone: "day3",
  });
  assert(risk.prioritizeConsultation, "risk consult first");
  checks += 1;

  const notStarted = evaluateCheckinResponse({
    answers: {
      stillUsing: null,
      sting: 0,
      itch: 0,
      redness: 0,
      dryness: 0,
      oiliness: 0,
      breakouts: 0,
      swelling: 0,
      peeling: 0,
      satisfaction: null,
      adherence: 1,
      photoAttached: false,
      freeMemo: null,
      overallResponse: "not_started",
    },
    milestone: "day3",
  });
  assert(
    notStarted.actions.includes("reschedule_start"),
    "not started reschedule"
  );
  checks += 1;

  const stopped = evaluateCheckinResponse({
    answers: {
      stillUsing: false,
      sting: 4,
      itch: 3,
      redness: 3,
      dryness: 3,
      oiliness: 3,
      breakouts: 2,
      swelling: 0,
      peeling: 0,
      satisfaction: 4,
      adherence: 2,
      photoAttached: false,
      freeMemo: null,
      overallResponse: "stopped",
      stoppedReason: "irritation",
    },
    milestone: "day7",
  });
  assert(stopped.actions.includes("record_stop_reason"), "stopped reason");
  checks += 1;

  const unsure = evaluateCheckinResponse({
    answers: {
      stillUsing: true,
      sting: 4,
      itch: 4,
      redness: 4,
      dryness: 4,
      oiliness: 4,
      breakouts: 4,
      swelling: 1,
      peeling: 1,
      satisfaction: 5,
      adherence: 5,
      photoAttached: false,
      freeMemo: null,
      overallResponse: "unsure",
    },
    milestone: "day15",
  });
  assert(
    unsure.actions.includes("suggest_comparison"),
    "unsure comparison"
  );
  checks += 1;

  const dueAt = "2026-07-04T10:00:00.000Z";
  const before48 = evaluateCheckinReminderPolicy({
    checkIn: { status: "due", dueAt, scheduledFor: dueAt, completedAt: null },
    now: new Date("2026-07-05T09:00:00.000Z"),
  });
  assert(!before48.shouldRemind, "no remind before 48h");
  assert(
    before48.reminderStatus === "awaiting_first_reminder",
    "awaiting first"
  );
  checks += 1;

  const at48 = evaluateCheckinReminderPolicy({
    checkIn: { status: "due", dueAt, scheduledFor: dueAt, completedAt: null },
    now: new Date("2026-07-06T11:00:00.000Z"),
  });
  assert(at48.shouldRemind, "remind after 48h");
  checks += 1;

  const second = evaluateCheckinReminderPolicy({
    checkIn: { status: "due", dueAt, scheduledFor: dueAt, completedAt: null },
    reminderCount: 1,
    now: new Date("2026-07-08T11:00:00.000Z"),
  });
  assert(!second.shouldRemind, "no second remind");
  assert(second.reminderStatus === "exhausted", "exhausted");
  checks += 1;

  assert(
    !shouldCreateCheckinSchedule({ careCheckinConsent: false }),
    "consent gate"
  );
  checks += 1;

  return { ok: true, checks };
}
