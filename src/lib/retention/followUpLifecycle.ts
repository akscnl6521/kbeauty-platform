/**
 * 3/7/15/30 follow-up lifecycle orchestrator.
 * Pure: opt-in → schedule → due → check-in decisions → routine adjust →
 * red-flag escalate → delivery intents. No real email/SMS/push.
 */

import { createCheckInSchedule, refreshCheckInStatuses } from "@/lib/care/schedule";
import { evaluateDermatologyReferral } from "@/lib/care/referral";
import type {
  CareCheckIn,
  CareCheckInAnswers,
  CareRoutine,
  CareUserSettings,
} from "@/lib/care/types";
import {
  buildCheckinScheduleIfConsented,
  evaluateCheckinResponse,
  milestoneFromDay,
  resolveCheckinConsent,
  shouldCreateCheckinSchedule,
  type CheckinDecision,
  type CheckinLocale,
} from "@/lib/retention/checkinPolicy";
import {
  buildFollowUpDeliveryIdempotencyKey,
  channelConsentAllows,
  createFollowUpDeliveryAdapter,
  toDeliveryRecord,
  type FollowUpChannelConsent,
  type FollowUpDeliveryAdapter,
  type FollowUpDeliveryChannel,
  type FollowUpDeliveryKind,
  type FollowUpDeliveryRecord,
  type FollowUpDeliveryRequest,
} from "@/lib/retention/followUpDelivery";
import {
  proposeRoutineAdjustments,
  type RoutineAdjustmentDecision,
} from "@/lib/retention/routineAdjustmentPolicy";

export type FollowUpLifecyclePhase =
  | "opt_in_required"
  | "scheduled"
  | "due"
  | "check_in_completed"
  | "routine_adjustment_proposed"
  | "red_flag_escalated"
  | "paused"
  | "resumed"
  | "completed_cycle";

export type FollowUpRedFlagEscalation = {
  escalate: boolean;
  referralLevel: ReturnType<typeof evaluateDermatologyReferral>["level"];
  urgentRisk: boolean;
  prioritizeConsultation: boolean;
  pauseNewProducts: boolean;
  reasonCodes: string[];
};

export type FollowUpLifecycleSnapshot = {
  version: 1;
  analysisSessionId: string;
  routineId: string | null;
  locale: CheckinLocale;
  timezone: string;
  consent: FollowUpChannelConsent;
  phase: FollowUpLifecyclePhase;
  checkIns: CareCheckIn[];
  lastDecision: CheckinDecision | null;
  lastAdjustment: RoutineAdjustmentDecision | null;
  lastEscalation: FollowUpRedFlagEscalation | null;
  deliveryRecords: FollowUpDeliveryRecord[];
  pausedAt: string | null;
  resumedAt: string | null;
  persistenceSource: "memory" | "local" | "server" | "fallback_empty";
  updatedAt: string;
  realDeliveryClaimed: false;
};

export type FollowUpLifecycleTickResult = {
  snapshot: FollowUpLifecycleSnapshot;
  dueCheckInIds: string[];
  deliveryIntents: FollowUpDeliveryRequest[];
  recordsCreated: FollowUpDeliveryRecord[];
};

function resolveLocale(settings: Pick<CareUserSettings, "locale"> | null | undefined): CheckinLocale {
  const locale = settings?.locale;
  if (locale === "en" || locale === "ja" || locale === "ko") return locale;
  return "ko";
}

export function resolveFollowUpChannelConsent(input: {
  consentCareTracking: boolean;
  settings: Pick<
    CareUserSettings,
    | "notificationsEnabled"
    | "emailOptIn"
    | "careEmailChannelConsent"
    | "careSmsChannelConsent"
    | "carePushChannelConsent"
  >;
}): FollowUpChannelConsent {
  const base = resolveCheckinConsent({
    consentCareTracking: input.consentCareTracking,
    settings: { emailOptIn: input.settings.emailOptIn },
  });
  return {
    careCheckinConsent: base.careCheckinConsent,
    notificationsEnabled: input.settings.notificationsEnabled !== false,
    careEmailChannelConsent: input.settings.careEmailChannelConsent === true,
    careSmsChannelConsent: input.settings.careSmsChannelConsent === true,
    carePushChannelConsent: input.settings.carePushChannelConsent === true,
  };
}

export function createEmptyFollowUpLifecycleSnapshot(input: {
  analysisSessionId: string;
  routineId?: string | null;
  timezone?: string;
  locale?: CheckinLocale;
  nowIso?: string;
}): FollowUpLifecycleSnapshot {
  const now = input.nowIso ?? new Date().toISOString();
  return {
    version: 1,
    analysisSessionId: input.analysisSessionId,
    routineId: input.routineId ?? null,
    locale: input.locale ?? "ko",
    timezone: input.timezone ?? "Asia/Seoul",
    consent: {
      careCheckinConsent: false,
      notificationsEnabled: true,
      careEmailChannelConsent: false,
      careSmsChannelConsent: false,
      carePushChannelConsent: false,
    },
    phase: "opt_in_required",
    checkIns: [],
    lastDecision: null,
    lastAdjustment: null,
    lastEscalation: null,
    deliveryRecords: [],
    pausedAt: null,
    resumedAt: null,
    persistenceSource: "fallback_empty",
    updatedAt: now,
    realDeliveryClaimed: false,
  };
}

export function startFollowUpLifecycle(input: {
  analysisSessionId: string;
  routineId: string | null;
  startAt: string;
  consentCareTracking: boolean;
  settings: CareUserSettings;
  idFactory: () => string;
  nowIso?: string;
}): FollowUpLifecycleSnapshot {
  const now = input.nowIso ?? new Date().toISOString();
  const consent = resolveFollowUpChannelConsent({
    consentCareTracking: input.consentCareTracking,
    settings: input.settings,
  });
  const locale = resolveLocale(input.settings);
  const timezone = input.settings.timezone || "Asia/Seoul";

  if (!shouldCreateCheckinSchedule({ careCheckinConsent: consent.careCheckinConsent })) {
    return {
      ...createEmptyFollowUpLifecycleSnapshot({
        analysisSessionId: input.analysisSessionId,
        routineId: input.routineId,
        timezone,
        locale,
        nowIso: now,
      }),
      consent,
      phase: "opt_in_required",
      persistenceSource: "memory",
    };
  }

  const checkIns = buildCheckinScheduleIfConsented({
    consent: { careCheckinConsent: consent.careCheckinConsent },
    analysisSessionId: input.analysisSessionId,
    routineId: input.routineId,
    startAt: input.startAt,
    timezone,
    idFactory: input.idFactory,
  });

  return {
    version: 1,
    analysisSessionId: input.analysisSessionId,
    routineId: input.routineId,
    locale,
    timezone,
    consent,
    phase: "scheduled",
    checkIns: refreshCheckInStatuses(checkIns, now),
    lastDecision: null,
    lastAdjustment: null,
    lastEscalation: null,
    deliveryRecords: [],
    pausedAt: null,
    resumedAt: null,
    persistenceSource: "memory",
    updatedAt: now,
    realDeliveryClaimed: false,
  };
}

export function refreshFollowUpDueStates(
  snapshot: FollowUpLifecycleSnapshot,
  nowIso: string = new Date().toISOString()
): FollowUpLifecycleSnapshot {
  if (snapshot.phase === "opt_in_required" || snapshot.phase === "paused") {
    return snapshot;
  }
  const checkIns = refreshCheckInStatuses(snapshot.checkIns, nowIso);
  const hasDue = checkIns.some((c) => c.status === "due");
  const allDone = checkIns.every(
    (c) =>
      c.status === "completed" ||
      c.status === "skipped" ||
      c.status === "expired" ||
      c.status === "cancelled"
  );
  let phase: FollowUpLifecyclePhase = snapshot.phase;
  if (allDone && checkIns.length > 0) phase = "completed_cycle";
  else if (hasDue) phase = "due";
  else if (snapshot.phase === "due") phase = "scheduled";

  return {
    ...snapshot,
    checkIns,
    phase,
    updatedAt: nowIso,
  };
}

export function evaluateFollowUpCheckIn(input: {
  snapshot: FollowUpLifecycleSnapshot;
  checkInId: string;
  answers: CareCheckInAnswers;
  routine?: CareRoutine | null;
  previousAnswers?: CareCheckInAnswers | null;
  nowIso?: string;
}): {
  snapshot: FollowUpLifecycleSnapshot;
  decision: CheckinDecision;
  escalation: FollowUpRedFlagEscalation;
  adjustment: RoutineAdjustmentDecision;
} {
  const now = input.nowIso ?? new Date().toISOString();
  const checkIn = input.snapshot.checkIns.find((c) => c.id === input.checkInId);
  if (!checkIn) {
    throw new Error("checkin_not_found");
  }

  const milestone = milestoneFromDay(checkIn.day);
  const decision = evaluateCheckinResponse({
    answers: input.answers,
    milestone,
    previousAnswers: input.previousAnswers,
  });
  const referral = evaluateDermatologyReferral(input.answers, {
    daysSinceStart: checkIn.day,
    worsening: decision.response === "worsened",
  });

  const reasonCodes: string[] = [];
  if (decision.urgentRisk) reasonCodes.push("urgent_risk_signal");
  if (decision.prioritizeConsultation) reasonCodes.push("prioritize_consultation");
  if (referral.level !== "none") reasonCodes.push(`referral_${referral.level}`);
  if (input.answers.stoppedReason === "irritation") {
    reasonCodes.push("irritation_stop");
  }
  if ((input.answers.adherence ?? 10) <= 2) reasonCodes.push("low_adherence");
  if ((input.answers.satisfaction ?? 10) <= 3) reasonCodes.push("low_satisfaction");

  const escalation: FollowUpRedFlagEscalation = {
    escalate:
      decision.urgentRisk ||
      decision.prioritizeConsultation ||
      referral.level === "seek_promptly" ||
      referral.level === "seek_emergency_care",
    referralLevel: referral.level,
    urgentRisk: decision.urgentRisk,
    prioritizeConsultation: decision.prioritizeConsultation,
    pauseNewProducts: decision.actions.includes("pause_new_products"),
    reasonCodes,
  };

  const completed: CareCheckIn = {
    ...checkIn,
    status: "completed",
    completedAt: now,
    answers: input.answers,
    referralLevel: referral.level,
  };

  const checkIns = input.snapshot.checkIns.map((c) =>
    c.id === completed.id ? completed : c
  );

  const adjustment = proposeRoutineAdjustments({
    checkIn: completed,
    decision,
    routine: input.routine ?? null,
    stoppedReason: input.answers.stoppedReason ?? null,
    nowIso: now,
  });

  let phase: FollowUpLifecyclePhase = "check_in_completed";
  if (escalation.escalate) phase = "red_flag_escalated";
  else if (adjustment.primary && adjustment.primary.type !== "keep_current") {
    phase = "routine_adjustment_proposed";
  }

  return {
    decision,
    escalation,
    adjustment,
    snapshot: {
      ...input.snapshot,
      checkIns: refreshCheckInStatuses(checkIns, now),
      lastDecision: decision,
      lastAdjustment: adjustment,
      lastEscalation: escalation,
      phase,
      updatedAt: now,
    },
  };
}

const DELIVERY_CHANNELS: FollowUpDeliveryChannel[] = [
  "in_app",
  "email",
  "sms",
  "push",
];

export function buildFollowUpDeliveryIntents(input: {
  snapshot: FollowUpLifecycleSnapshot;
  userKey?: string;
  destinations?: Partial<Record<FollowUpDeliveryChannel, string>>;
  kind?: FollowUpDeliveryKind;
  nowIso?: string;
}): FollowUpDeliveryRequest[] {
  const refreshed = refreshFollowUpDueStates(input.snapshot, input.nowIso);
  const kind: FollowUpDeliveryKind =
    input.kind ??
    (refreshed.lastEscalation?.escalate
      ? "red_flag_escalation"
      : "checkin_due");

  const targets =
    kind === "red_flag_escalation"
      ? refreshed.checkIns.filter((c) => c.status === "completed").slice(-1)
      : refreshed.checkIns.filter((c) => c.status === "due");

  const intents: FollowUpDeliveryRequest[] = [];
  for (const checkIn of targets) {
    for (const channel of DELIVERY_CHANNELS) {
      const gate = channelConsentAllows(channel, refreshed.consent);
      if (!gate.allowed) continue;
      const destination =
        input.destinations?.[channel] ??
        (channel === "in_app" ? "session" : "");
      if (!destination && channel !== "in_app") continue;
      intents.push({
        checkInId: checkIn.id,
        channel,
        kind,
        locale: refreshed.locale,
        idempotencyKey: buildFollowUpDeliveryIdempotencyKey({
          userKey: input.userKey ?? "anon",
          checkInId: checkIn.id,
          channel,
          kind,
        }),
        destination: destination || "session",
        bodyPreview: `${kind}:${channel}:day${checkIn.day}`,
      });
    }
  }
  return intents;
}

export async function runFollowUpDeliveryTick(input: {
  snapshot: FollowUpLifecycleSnapshot;
  userKey?: string;
  destinations?: Partial<Record<FollowUpDeliveryChannel, string>>;
  adapters?: Partial<Record<FollowUpDeliveryChannel, FollowUpDeliveryAdapter>>;
  env?: Record<string, string | undefined>;
  idFactory?: () => string;
  nowIso?: string;
}): Promise<FollowUpLifecycleTickResult> {
  const now = input.nowIso ?? new Date().toISOString();
  const snapshot = refreshFollowUpDueStates(input.snapshot, now);
  const intents = buildFollowUpDeliveryIntents({
    snapshot,
    userKey: input.userKey,
    destinations: input.destinations,
    nowIso: now,
  });

  const existingKeys = new Set(
    snapshot.deliveryRecords.map((r) => r.idempotencyKey)
  );
  const recordsCreated: FollowUpDeliveryRecord[] = [];
  let seq = 0;
  const idFactory =
    input.idFactory ??
    (() => {
      seq += 1;
      return `fud_${seq}`;
    });

  for (const request of intents) {
    if (existingKeys.has(request.idempotencyKey)) continue;
    const adapter =
      input.adapters?.[request.channel] ??
      createFollowUpDeliveryAdapter(request.channel, {
        IN_APP_DELIVERY_MODE: "dry_run",
        EMAIL_DELIVERY_MODE: "dry_run",
        SMS_DELIVERY_MODE: "dry_run",
        PUSH_DELIVERY_MODE: "dry_run",
        ...(input.env ?? {}),
      });
    const result = await adapter.send(request);
    const record = toDeliveryRecord({
      id: idFactory(),
      request,
      result,
      nowIso: now,
    });
    recordsCreated.push(record);
    existingKeys.add(request.idempotencyKey);
  }

  const dueCheckInIds = snapshot.checkIns
    .filter((c) => c.status === "due")
    .map((c) => c.id);

  return {
    snapshot: {
      ...snapshot,
      deliveryRecords: [...snapshot.deliveryRecords, ...recordsCreated],
      updatedAt: now,
      realDeliveryClaimed: false,
    },
    dueCheckInIds,
    deliveryIntents: intents,
    recordsCreated,
  };
}

export function pauseFollowUpLifecycle(
  snapshot: FollowUpLifecycleSnapshot,
  nowIso: string = new Date().toISOString()
): FollowUpLifecycleSnapshot {
  return {
    ...snapshot,
    phase: "paused",
    pausedAt: nowIso,
    updatedAt: nowIso,
  };
}

export function resumeFollowUpLifecycle(
  snapshot: FollowUpLifecycleSnapshot,
  nowIso: string = new Date().toISOString()
): FollowUpLifecycleSnapshot {
  const resumed: FollowUpLifecycleSnapshot = {
    ...snapshot,
    phase: "resumed",
    resumedAt: nowIso,
    pausedAt: null,
    updatedAt: nowIso,
  };
  return refreshFollowUpDueStates(resumed, nowIso);
}

export function evaluateProgressAdherenceIrritation(answers: CareCheckInAnswers): {
  progressHint: "improved" | "unchanged" | "worsened" | "unknown";
  adherenceBand: "low" | "medium" | "high" | "unknown";
  irritationFlag: boolean;
} {
  const satisfaction = answers.satisfaction;
  const adherence = answers.adherence;
  const irritationFlag =
    answers.stoppedReason === "irritation" ||
    (answers.sting ?? 0) >= 7 ||
    (answers.itch ?? 0) >= 7 ||
    (answers.redness ?? 0) >= 7;

  let progressHint: "improved" | "unchanged" | "worsened" | "unknown" = "unknown";
  if (satisfaction != null) {
    if (satisfaction >= 7 && !irritationFlag) progressHint = "improved";
    else if (satisfaction <= 3 || irritationFlag) progressHint = "worsened";
    else progressHint = "unchanged";
  }

  let adherenceBand: "low" | "medium" | "high" | "unknown" = "unknown";
  if (adherence != null) {
    if (adherence <= 3) adherenceBand = "low";
    else if (adherence <= 6) adherenceBand = "medium";
    else adherenceBand = "high";
  }

  return { progressHint, adherenceBand, irritationFlag };
}

/** Convenience: create schedule without full start when consent already known. */
export function scheduleFollowUpMilestones(input: {
  analysisSessionId: string;
  routineId: string | null;
  startAt: string;
  timezone: string;
  idFactory: () => string;
}): CareCheckIn[] {
  return createCheckInSchedule(input);
}
