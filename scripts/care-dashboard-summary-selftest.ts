import {
  managementLevelLabel,
  referralLabel,
  referralTone,
  summarizeCareDashboard,
} from "../src/lib/care/dashboardSummary";
import type { CareAnalysisSession, CareCheckIn } from "../src/lib/care/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[care-dashboard-summary] ${message}`);
}

const session = (id: string, createdAt: string, managementLevel: string): CareAnalysisSession => ({
  id,
  createdAt,
  timezone: "Asia/Seoul",
  country: "KR",
  ageBand: null,
  skinType: null,
  sensitivity: null,
  concerns: ["붉은기"],
  toneDepth: null,
  undertone: null,
  allergyIngredients: [],
  avoidedIngredients: [],
  currentProducts: [],
  budgetBand: null,
  texturePreference: null,
  fragrancePreference: null,
  analysisSnapshot: {},
  recommendationSnapshot: { managementLevel },
  rankedProductIds: [],
  dataConfidence: 0.9,
  dermatologyHints: [],
  consentCareTracking: true,
  linkedAccount: false,
  anonymousDeviceId: "device",
});

const checkIn = (
  id: string,
  status: CareCheckIn["status"],
  dueAt: string,
  referralLevel: CareCheckIn["referralLevel"]
): CareCheckIn => ({
  id,
  analysisSessionId: "s2",
  routineId: null,
  day: 3,
  status,
  scheduledFor: dueAt,
  dueAt,
  completedAt: status === "completed" ? dueAt : null,
  timezone: "Asia/Seoul",
  answers: null,
  progressDelta: null,
  referralLevel,
  suggestionIds: [],
});

const summary = summarizeCareDashboard({
  sessions: [
    session("s1", "2026-07-01T00:00:00.000Z", "cosmetic_care"),
    session("s2", "2026-07-18T00:00:00.000Z", "expert_first"),
  ],
  checkIns: [
    checkIn("scheduled", "scheduled", "2026-07-20T00:00:00.000Z", "none"),
    checkIn("due", "due", "2026-07-25T00:00:00.000Z", "none"),
    checkIn("completed", "completed", "2026-07-10T00:00:00.000Z", "seek_promptly"),
  ],
});

assert(summary.latestSession?.id === "s2", "latest analysis selected");
assert(summary.nextCheckIn?.id === "due", "due check-in prioritized over scheduled");
assert(summary.referralLevel === "seek_promptly", "highest referral level selected");
assert(managementLevelLabel(summary.latestSession) === "전문가 상담 우선", "management label");
assert(referralLabel("seek_emergency_care").includes("긴급"), "emergency label");
assert(referralTone("none") === "normal", "normal tone");
assert(referralTone("consider_soon") === "warning", "warning tone");
assert(referralTone("seek_emergency_care") === "urgent", "urgent tone");

console.log("[care-dashboard-summary] ok");
