import assert from "node:assert/strict";
import {
  createApiErrorRevisitSummary,
  getCareProgressState,
  getNextRecommendedAction,
  getRevisitDashboardSummary,
} from "../src/lib/care/revisitDashboard";
import {
  followUpQuestions,
  needsFollowUpQuestions,
  toProgressNote,
} from "../src/lib/care/quickSkinCheck";
import type {
  CareAnalysisSession,
  CareCheckIn,
  CareProgressDelta,
  CareRoutine,
} from "../src/lib/care/types";

const NOW = "2026-07-22T00:00:00.000Z";

function session(
  id: string,
  createdAt: string,
  concerns: string[] = ["건조"],
  managementLevel = "cosmetic_care"
): CareAnalysisSession {
  return {
    id,
    createdAt,
    timezone: "Asia/Seoul",
    country: "KR",
    ageBand: null,
    skinType: null,
    sensitivity: null,
    concerns,
    toneDepth: null,
    undertone: null,
    allergyIngredients: [],
    avoidedIngredients: [],
    currentProducts: [],
    budgetBand: null,
    texturePreference: null,
    fragrancePreference: null,
    analysisSnapshot: {},
    recommendationSnapshot: { managementLevel, skinConcerns: concerns },
    rankedProductIds: [],
    dataConfidence: 0.8,
    dermatologyHints: [],
    consentCareTracking: true,
    linkedAccount: true,
    anonymousDeviceId: null,
  };
}

function checkIn(
  id: string,
  status: CareCheckIn["status"],
  dueAt: string,
  extra?: Partial<CareCheckIn>
): CareCheckIn {
  return {
    id,
    analysisSessionId: "s1",
    routineId: null,
    day: 3,
    status,
    scheduledFor: dueAt,
    dueAt,
    completedAt: status === "completed" ? dueAt : null,
    timezone: "Asia/Seoul",
    answers: null,
    progressDelta: null,
    referralLevel: "none",
    suggestionIds: [],
    ...extra,
  };
}

function routine(): CareRoutine {
  return {
    id: "r1",
    analysisSessionId: "s1",
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    timezone: "Asia/Seoul",
    items: [
      {
        id: "i1",
        step: "cleanser",
        productId: null,
        customProductName: "클렌저",
        timeOfDay: "pm",
        frequency: "daily",
        order: 1,
        startedAt: NOW,
        stoppedAt: null,
        usageNote: null,
        cautionNotes: [],
        allergyConflict: false,
        active: true,
      },
    ],
    conflictNotes: [],
  };
}

// empty / logged out
const empty = getRevisitDashboardSummary({
  authenticated: false,
  sessions: [],
  checkIns: [],
  activeRoutine: null,
  nowIso: NOW,
});
assert.equal(empty.uiState, "logged_out");
assert.equal(empty.nextAction.kind, "start_analysis");

// analysis only
const analysisOnly = getRevisitDashboardSummary({
  sessions: [session("s1", NOW)],
  checkIns: [],
  activeRoutine: null,
  nowIso: NOW,
});
assert.equal(analysisOnly.uiState, "analysis_only");
assert.equal(
  getNextRecommendedAction({
    sessions: [session("s1", NOW)],
    checkIns: [],
    activeRoutine: null,
    nowIso: NOW,
  }).kind,
  "create_routine"
);

// routine active
const routineActive = getRevisitDashboardSummary({
  sessions: [session("s1", NOW)],
  checkIns: [
    checkIn("c1", "completed", "2026-07-10T00:00:00.000Z", {
      answers: {
        overallResponse: "unchanged",
        photoAttached: false,
        freeMemo: null,
        stillUsing: true,
        sting: 2,
        itch: 2,
        redness: 2,
        dryness: 2,
        oiliness: 2,
        breakouts: 2,
        swelling: null,
        peeling: null,
        satisfaction: 7,
        adherence: 7,
      },
    }),
  ],
  activeRoutine: routine(),
  photoConsent: { saveForComparison: true, migrationPending: false, loaded: true },
  nowIso: NOW,
});
assert.equal(routineActive.uiState, "routine_active");
assert.equal(routineActive.activeItemCount, 1);
assert.equal(routineActive.nextAction.kind, "record_progress");

// scheduled check-in (no routine path)
const scheduled = getRevisitDashboardSummary({
  sessions: [session("s1", NOW)],
  checkIns: [checkIn("c2", "scheduled", "2026-07-30T00:00:00.000Z")],
  activeRoutine: routine(),
  photoConsent: { saveForComparison: false, migrationPending: false, loaded: true },
  nowIso: NOW,
});
assert.equal(scheduled.uiState, "checkin_scheduled");
assert.ok(scheduled.nextCheckIn?.status === "scheduled");

// overdue
const overdue = getRevisitDashboardSummary({
  sessions: [session("s1", NOW)],
  checkIns: [checkIn("c3", "due", "2026-07-20T00:00:00.000Z")],
  activeRoutine: routine(),
  nowIso: NOW,
});
assert.equal(overdue.uiState, "checkin_overdue");
assert.equal(overdue.nextAction.kind, "complete_checkin");
assert.match(overdue.nextAction.href, /check-ins\/c3/);

// better outcome
const better = getRevisitDashboardSummary({
  sessions: [session("s1", NOW)],
  checkIns: [
    checkIn("c4", "completed", "2026-07-18T00:00:00.000Z", {
      answers: { overallResponse: "improved", photoAttached: false, freeMemo: null, stillUsing: true, sting: 2, itch: 2, redness: 2, dryness: 2, oiliness: 2, breakouts: 2, swelling: null, peeling: null, satisfaction: 8, adherence: 8 },
    }),
  ],
  activeRoutine: routine(),
  nowIso: NOW,
});
assert.equal(better.latestCheckInAnswerSummary, "전반적으로 나아짐");
assert.equal(
  getCareProgressState({
    checkIns: [
      checkIn("c4", "completed", "2026-07-18T00:00:00.000Z", {
        answers: { overallResponse: "improved", photoAttached: false, freeMemo: null, stillUsing: true, sting: 2, itch: 2, redness: 2, dryness: 2, oiliness: 2, breakouts: 2, swelling: null, peeling: null, satisfaction: 8, adherence: 8 },
      }),
    ],
  }).lastOutcome,
  "improved"
);

// worse / worsening
const worse = getRevisitDashboardSummary({
  sessions: [session("s1", NOW)],
  checkIns: [
    checkIn("c5", "completed", "2026-07-18T00:00:00.000Z", {
      answers: { overallResponse: "worsened", photoAttached: false, freeMemo: null, stillUsing: true, sting: 8, itch: 8, redness: 8, dryness: 4, oiliness: 2, breakouts: 7, swelling: null, peeling: null, satisfaction: 3, adherence: 5 },
    }),
  ],
  activeRoutine: routine(),
  nowIso: NOW,
});
assert.equal(worse.uiState, "worsening");
assert.equal(worse.nextAction.kind, "seek_care_guidance");

const deltas: CareProgressDelta[] = [
  { metric: "redness", from: 3, to: 8, trend: "worsened" },
];
assert.equal(
  getCareProgressState({ checkIns: [], progressDeltas: deltas }).hasWorsening,
  true
);

// photo no consent
const photoNo = getRevisitDashboardSummary({
  sessions: [session("s1", NOW)],
  checkIns: [
    checkIn("c6", "completed", "2026-07-10T00:00:00.000Z", {
      answers: {
        overallResponse: "unchanged",
        photoAttached: false,
        freeMemo: null,
        stillUsing: true,
        sting: 2,
        itch: 2,
        redness: 2,
        dryness: 2,
        oiliness: 2,
        breakouts: 2,
        swelling: null,
        peeling: null,
        satisfaction: 7,
        adherence: 7,
      },
    }),
  ],
  activeRoutine: routine(),
  photoConsent: { saveForComparison: false, migrationPending: false, loaded: true },
  nowIso: NOW,
});
assert.equal(photoNo.uiState, "photo_no_consent");
assert.equal(photoNo.photoStatus.kind, "no_consent");

// photo pending migration
const photoPending = getRevisitDashboardSummary({
  sessions: [session("s1", NOW)],
  checkIns: [],
  activeRoutine: routine(),
  photoConsent: { saveForComparison: true, migrationPending: true, loaded: true },
  nowIso: NOW,
});
assert.equal(photoPending.uiState, "photo_feature_pending");
assert.equal(photoPending.photoStatus.kind, "pending_migration");

// partial data
const partial = getRevisitDashboardSummary({
  sessions: [session("s1", NOW, [])],
  checkIns: [],
  activeRoutine: null,
  nowIso: NOW,
});
assert.equal(partial.uiState, "partial_data");

// api error fallback
const apiErr = createApiErrorRevisitSummary();
assert.equal(apiErr.uiState, "api_error");
assert.equal(apiErr.nextAction.kind, "retry_sync");

// quick skin check helpers
assert.equal(needsFollowUpQuestions("worse"), true);
assert.equal(needsFollowUpQuestions("better"), false);
assert.ok(followUpQuestions("worse").length >= 2);
assert.match(toProgressNote("same"), /변화/);

// reanalyze after 30 days
const oldAnalysis = getNextRecommendedAction({
  sessions: [session("s1", "2026-05-01T00:00:00.000Z")],
  checkIns: [checkIn("c7", "scheduled", "2026-08-01T00:00:00.000Z")],
  activeRoutine: routine(),
  photoConsent: { saveForComparison: false, migrationPending: false, loaded: true },
  nowIso: NOW,
});
assert.equal(oldAnalysis.kind, "reanalyze");

// record progress when consent enabled
const record = getNextRecommendedAction({
  sessions: [session("s1", NOW)],
  checkIns: [checkIn("c8", "scheduled", "2026-08-01T00:00:00.000Z")],
  activeRoutine: routine(),
  photoConsent: { saveForComparison: true, migrationPending: false, loaded: true },
  nowIso: NOW,
});
assert.equal(record.kind, "record_progress");

console.log("[revisit-dashboard] ok");
