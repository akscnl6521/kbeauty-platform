/**
 * Browser local care store (until care migration is applied).
 * Never logs freeMemo / photos / PII.
 */

import {
  createCheckInSchedule,
  dedupeCheckInsByDay,
  refreshCheckInStatuses,
} from "@/lib/care/schedule";
import { detectRoutineConflicts } from "@/lib/care/conflicts";
import {
  buildCheckInDueNotification,
  mergeNotifications,
} from "@/lib/care/notifications";
import { computeProgressDeltas } from "@/lib/care/progress";
import { evaluateDermatologyReferral } from "@/lib/care/referral";
import { buildRoutineSuggestions } from "@/lib/care/routine-suggestions";
import {
  applyRoutineAdjustment,
  undoRoutineAdjustment,
  type RoutineAdjustmentProposal,
} from "@/lib/retention/routineAdjustmentPolicy";
import { mergeCheckinScheduleAfterStartChange } from "@/lib/retention/checkinPolicy";
import type {
  CareAnalysisSession,
  CareCheckIn,
  CareCheckInAnswers,
  CareRoutine,
  CareRoutineItem,
  CareStoreSnapshot,
  CareUserSettings,
} from "@/lib/care/types";

export const CARE_STORAGE_KEY = "kbeautyCareStoreV1";

function rid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultSettings(timezone: string): CareUserSettings {
  return {
    notificationsEnabled: true,
    emailOptIn: false,
    quietHoursStart: 22,
    quietHoursEnd: 8,
    timezone,
  };
}

export function emptyCareStore(timezone = "Asia/Seoul"): CareStoreSnapshot {
  return {
    version: 1,
    deviceId: rid("dev"),
    sessions: [],
    routines: [],
    checkIns: [],
    suggestions: [],
    notifications: [],
    feedback: [],
    settings: defaultSettings(timezone),
    routineAdjustmentHistory: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadCareStore(): CareStoreSnapshot {
  if (typeof window === "undefined") return emptyCareStore();
  try {
    const raw = window.localStorage.getItem(CARE_STORAGE_KEY);
    if (!raw) return emptyCareStore();
    const parsed = JSON.parse(raw) as CareStoreSnapshot;
    if (!parsed || parsed.version !== 1) return emptyCareStore();
    return {
      ...parsed,
      checkIns: refreshCheckInStatuses(dedupeCheckInsByDay(parsed.checkIns ?? [])),
      routineAdjustmentHistory: parsed.routineAdjustmentHistory ?? [],
    };
  } catch {
    return emptyCareStore();
  }
}

export function saveCareStore(store: CareStoreSnapshot): void {
  if (typeof window === "undefined") return;
  const next = { ...store, updatedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(CARE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // quota
  }
}

export function saveAnalysisSessionFromLocalRecommendation(input: {
  analysis: Record<string, unknown>;
  recommendation: Record<string, unknown>;
  rankedProductIds: string[];
  allergyIngredients: string[];
  avoidedIngredients: string[];
  concerns: string[];
  skinType: string | null;
  sensitivity: string | null;
  undertone: string | null;
  toneDepth: string | null;
  country: string | null;
  consentCareTracking: boolean;
}): CareStoreSnapshot {
  const store = loadCareStore();
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul";
  const session: CareAnalysisSession = {
    id: rid("an"),
    createdAt: new Date().toISOString(),
    timezone,
    country: input.country,
    ageBand: null,
    skinType: input.skinType,
    sensitivity: input.sensitivity,
    concerns: input.concerns,
    toneDepth: input.toneDepth,
    undertone: input.undertone,
    allergyIngredients: input.allergyIngredients,
    avoidedIngredients: input.avoidedIngredients,
    currentProducts: [],
    budgetBand: null,
    texturePreference: null,
    fragrancePreference: null,
    analysisSnapshot: input.analysis,
    recommendationSnapshot: input.recommendation,
    rankedProductIds: input.rankedProductIds,
    dataConfidence:
      typeof input.recommendation.confidenceScore === "number"
        ? input.recommendation.confidenceScore
        : null,
    dermatologyHints: [],
    consentCareTracking: input.consentCareTracking,
    linkedAccount: false,
    anonymousDeviceId: store.deviceId,
  };

  const routineItems: CareRoutineItem[] = input.rankedProductIds
    .slice(0, 6)
    .map((productId, idx) => ({
      id: rid("ri"),
      step: (idx % 2 === 0 ? "serum" : "moisturizer") as CareRoutineItem["step"],
      productId,
      customProductName: null,
      timeOfDay: idx < 3 ? "am" : "pm",
      frequency: "daily",
      order: idx + 1,
      startedAt: session.createdAt,
      stoppedAt: null,
      usageNote: null,
      cautionNotes: [],
      allergyConflict: false,
      active: true,
    }));

  const conflicts = detectRoutineConflicts(
    routineItems,
    session.allergyIngredients,
    session.avoidedIngredients
  );

  const routine: CareRoutine = {
    id: rid("rt"),
    analysisSessionId: session.id,
    version: 1,
    createdAt: session.createdAt,
    updatedAt: session.createdAt,
    timezone,
    items: routineItems,
    conflictNotes: conflicts,
  };

  let checkIns: CareCheckIn[] = [];
  if (input.consentCareTracking) {
    checkIns = createCheckInSchedule({
      analysisSessionId: session.id,
      routineId: routine.id,
      startAt: session.createdAt,
      timezone,
      idFactory: () => rid("ci"),
    });
    checkIns = refreshCheckInStatuses(checkIns);
  }

  const dueNotes = checkIns
    .filter((c) => c.status === "due")
    .map((c) => buildCheckInDueNotification(c, () => rid("nt")));

  const next: CareStoreSnapshot = {
    ...store,
    settings: { ...store.settings, timezone },
    sessions: [session, ...store.sessions].slice(0, 20),
    routines: [routine, ...store.routines].slice(0, 20),
    checkIns: dedupeCheckInsByDay([...checkIns, ...store.checkIns]),
    notifications: mergeNotifications(
      store.notifications,
      dueNotes,
      checkIns
    ),
  };
  saveCareStore(next);
  return next;
}

export function completeCheckIn(
  checkInId: string,
  answers: CareCheckInAnswers
): CareStoreSnapshot {
  const store = loadCareStore();
  const checkIn = store.checkIns.find((c) => c.id === checkInId);
  if (!checkIn) return store;
  if (checkIn.status === "completed") return store;

  const previous =
    store.checkIns
      .filter(
        (c) =>
          c.analysisSessionId === checkIn.analysisSessionId &&
          c.status === "completed" &&
          c.day < checkIn.day &&
          c.answers
      )
      .sort((a, b) => b.day - a.day)[0]?.answers ?? null;

  const deltas = computeProgressDeltas(previous, answers);
  const referral = evaluateDermatologyReferral(answers, {
    daysSinceStart: checkIn.day,
    worsening: deltas.some((d) => d.trend === "worsened"),
  });

  const routine =
    store.routines.find((r) => r.id === checkIn.routineId) ??
    store.routines.find((r) => r.analysisSessionId === checkIn.analysisSessionId) ??
    null;

  const suggestions = buildRoutineSuggestions({
    checkIn,
    answers,
    deltas,
    routine,
  });

  const updated: CareCheckIn = {
    ...checkIn,
    status: "completed",
    completedAt: new Date().toISOString(),
    answers: {
      ...answers,
      // never persist long free memo in logs; store capped
      freeMemo: answers.freeMemo
        ? answers.freeMemo.slice(0, 500)
        : null,
    },
    progressDelta: deltas[0] ?? null,
    referralLevel: referral.level,
    suggestionIds: suggestions.map((s) => s.id),
  };

  const checkIns = store.checkIns.map((c) =>
    c.id === checkInId ? updated : c
  );

  const referralNote =
    referral.level === "none"
      ? []
      : [
          {
            id: rid("nt"),
            createdAt: new Date().toISOString(),
            kind: "referral" as const,
            title: "전문가 상담 안내",
            message: referral.userMessage,
            relatedCheckInId: checkInId,
            read: false,
            fingerprint: `referral|${checkInId}|${referral.level}`,
          },
        ];

  const next: CareStoreSnapshot = {
    ...store,
    checkIns: refreshCheckInStatuses(checkIns),
    suggestions: [...suggestions, ...store.suggestions].slice(0, 50),
    notifications: mergeNotifications(
      store.notifications,
      referralNote,
      checkIns
    ),
  };
  saveCareStore(next);
  return next;
}

export function refreshCareDueState(): CareStoreSnapshot {
  const store = loadCareStore();
  const checkIns = refreshCheckInStatuses(store.checkIns);
  const due = checkIns.filter((c) => c.status === "due");
  const notes = due.map((c) =>
    buildCheckInDueNotification(c, () => rid("nt"))
  );
  const next = {
    ...store,
    checkIns,
    notifications: store.settings.notificationsEnabled
      ? mergeNotifications(store.notifications, notes, checkIns)
      : store.notifications,
  };
  saveCareStore(next);
  return next;
}

/**
 * Apply a check-in routine adjustment only after explicit user confirmation.
 * Never deletes routine items — pauses or reschedules only.
 */
export function applyCheckinRoutineAdjustment(input: {
  proposal: RoutineAdjustmentProposal;
  selectedItemIds?: string[];
  newStartAt?: string | null;
}): CareStoreSnapshot {
  const store = loadCareStore();
  const history = store.routineAdjustmentHistory ?? [];
  const routine =
    store.routines.find((r) =>
      store.checkIns.some(
        (c) => c.id === input.proposal.checkInId && c.routineId === r.id
      )
    ) ??
    store.routines[0] ??
    null;
  if (!routine) return store;

  const checkIn = store.checkIns.find((c) => c.id === input.proposal.checkInId);
  const result = applyRoutineAdjustment({
    routine,
    proposal: input.proposal,
    selectedItemIds: input.selectedItemIds,
    newStartAt: input.newStartAt,
    history,
  });
  if (!result.ok) return store;

  let checkIns = store.checkIns;
  let record = result.record;

  if (
    input.proposal.type === "restart_later" &&
    input.newStartAt &&
    checkIn
  ) {
    const beforeCheckIns = store.checkIns.map((c) => ({ ...c }));
    checkIns = mergeCheckinScheduleAfterStartChange({
      existing: store.checkIns,
      analysisSessionId: checkIn.analysisSessionId,
      routineId: checkIn.routineId,
      newStartAt: input.newStartAt,
      timezone: checkIn.timezone || store.settings.timezone,
      idFactory: () => rid("ci"),
      consent: { careCheckinConsent: true },
    });
    record = {
      ...record,
      beforeCheckIns,
      afterCheckIns: checkIns.map((c) => ({ ...c })),
    };
  }

  const next: CareStoreSnapshot = {
    ...store,
    routines: store.routines.map((r) =>
      r.id === routine.id ? result.routine : r
    ),
    checkIns,
    routineAdjustmentHistory: [record, ...history].slice(0, 30),
  };
  saveCareStore(next);
  return next;
}

export function undoLastCheckinRoutineAdjustment(
  checkInId?: string
): CareStoreSnapshot {
  const store = loadCareStore();
  const history = store.routineAdjustmentHistory ?? [];
  const record = history.find(
    (r) =>
      r.undoneAt == null && (checkInId == null || r.checkInId === checkInId)
  );
  if (!record) return store;

  const current =
    store.routines.find((r) => r.id === record.routineId) ?? null;
  if (!current) return store;

  const undone = undoRoutineAdjustment({
    currentRoutine: current,
    record,
  });
  if (!undone.ok) return store;

  const nextHistory = history.map((r) =>
    r.id === record.id ? undone.record : r
  );

  const next: CareStoreSnapshot = {
    ...store,
    routines: store.routines.map((r) =>
      r.id === current.id ? undone.routine : r
    ),
    checkIns: record.beforeCheckIns ?? store.checkIns,
    routineAdjustmentHistory: nextHistory,
  };
  saveCareStore(next);
  return next;
}
