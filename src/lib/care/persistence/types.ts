/**
 * Care persistence row shapes (snake_case) + dashboard DTO.
 */

import type {
  CareAnalysisSession,
  CareCheckIn,
  CareCheckInAnswers,
  CareCheckInDay,
  CareCheckInStatus,
  CareNotification,
  CareProgressDelta,
  CareProgressMetric,
  CareReferralLevel,
  CareRoutine,
  CareRoutineItem,
  CareRoutineStep,
  CareStoreSnapshot,
  CareSuggestion,
  CareTrend,
  CareUserSettings,
} from "@/lib/care/types";

export type CareAnalysisSessionRow = {
  id: string;
  user_id: string | null;
  anonymous_session_id: string | null;
  timezone: string;
  country: string | null;
  age_band: string | null;
  skin_type: string | null;
  sensitivity: string | null;
  concerns: string[];
  tone_depth: string | null;
  undertone: string | null;
  allergy_ingredients: string[];
  avoided_ingredients: string[];
  current_products: string[];
  budget_band: string | null;
  texture_preference: string | null;
  fragrance_preference: string | null;
  analysis_snapshot: Record<string, unknown>;
  recommendation_snapshot: Record<string, unknown>;
  ranked_product_ids: string[];
  data_confidence: number | null;
  referral_level: CareReferralLevel;
  referral_reasons: unknown[];
  dermatology_hints: string[];
  consent_status: "pending" | "granted" | "revoked";
  consented_at: string | null;
  consent_care_tracking: boolean;
  linked_account: boolean;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CareRoutineRow = {
  id: string;
  user_id: string | null;
  analysis_session_id: string | null;
  name: string;
  version: number;
  status: "active" | "paused" | "ended";
  timezone: string;
  conflict_notes: string[];
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CareRoutineItemRow = {
  id: string;
  routine_id: string;
  step: string;
  product_id: number | null;
  custom_product_name: string | null;
  time_of_day: "am" | "pm" | "both";
  frequency: "daily" | "every_other_day" | "2x_week" | "as_needed";
  sort_order: number;
  started_at: string;
  stopped_at: string | null;
  usage_note: string | null;
  caution_notes: string[];
  allergy_conflict: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type CareCheckInRow = {
  id: string;
  user_id: string | null;
  analysis_session_id: string;
  routine_id: string | null;
  day: CareCheckInDay;
  status: CareCheckInStatus;
  scheduled_for: string;
  due_at: string;
  completed_at: string | null;
  timezone: string;
  answers: CareCheckInAnswers | null;
  progress_summary: CareProgressSummaryPayload | null;
  referral_level: CareReferralLevel;
  referral_reasons: unknown[];
  created_at: string;
  updated_at: string;
};

export type CareProgressSummaryPayload = {
  deltas: CareProgressDelta[];
  primary: CareProgressDelta | null;
};

export type CareSuggestionRow = {
  id: string;
  user_id: string | null;
  routine_id: string | null;
  check_in_id: string | null;
  suggestion_type: string;
  title: string;
  reason: string;
  expected_effect: string;
  proposed_changes: Record<string, unknown>;
  patch: CareSuggestion["patch"];
  requires_user_confirm: boolean;
  status: "pending" | "accepted" | "dismissed" | "expired";
  applied: boolean;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CareNotificationRow = {
  id: string;
  user_id: string | null;
  check_in_id: string | null;
  notification_type: string;
  kind: CareNotification["kind"];
  title: string;
  message: string;
  related_check_in_id: string | null;
  fingerprint: string;
  status: "unread" | "read" | "dismissed" | "expired";
  read: boolean;
  due_at: string | null;
  created_at: string;
  read_at: string | null;
};

export type CareFeedbackRow = {
  id: string;
  user_id: string | null;
  product_id: number | null;
  routine_item_id: string | null;
  check_in_id: string | null;
  used: boolean | null;
  purchased: boolean | null;
  satisfaction: number | null;
  irritation: boolean | null;
  stop_reason: string | null;
  stopped_reason: string | null;
  repurchase_intent: boolean | null;
  concern_change: string | null;
  concern_changes: Record<string, unknown>;
  created_at: string;
};

export type CareProgressSnapshotRow = {
  id: string;
  user_id: string | null;
  routine_id: string | null;
  check_in_id: string | null;
  dryness: number | null;
  oiliness: number | null;
  redness: number | null;
  breakouts: number | null;
  sensitivity: number | null;
  texture: number | null;
  pigmentation: number | null;
  satisfaction: number | null;
  adherence: number | null;
  comparison_status: CareTrend | null;
  metrics: Record<string, unknown>;
  created_at: string;
};

export type CareAuditEventRow = {
  id: string;
  user_id: string | null;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export type SaveAnalysisSessionInput = {
  timezone: string;
  country: string | null;
  ageBand?: string | null;
  skinType: string | null;
  sensitivity: string | null;
  concerns: string[];
  toneDepth: string | null;
  undertone: string | null;
  allergyIngredients: string[];
  avoidedIngredients: string[];
  currentProducts?: string[];
  budgetBand?: string | null;
  texturePreference?: string | null;
  fragrancePreference?: string | null;
  analysisSnapshot: Record<string, unknown>;
  recommendationSnapshot: Record<string, unknown>;
  rankedProductIds: string[];
  dataConfidence?: number | null;
  consentCareTracking: boolean;
  dermatologyHints?: string[];
  routineItems?: Array<{
    step: CareRoutineStep;
    productId: string | null;
    customProductName: string | null;
    timeOfDay: CareRoutineItem["timeOfDay"];
    frequency: CareRoutineItem["frequency"];
    order: number;
    usageNote?: string | null;
    cautionNotes?: string[];
  }>;
};

export type CreateRoutineInput = {
  analysisSessionId: string;
  name?: string;
  timezone: string;
  items: Array<{
    step: CareRoutineStep;
    productId: string | null;
    customProductName: string | null;
    timeOfDay: CareRoutineItem["timeOfDay"];
    frequency: CareRoutineItem["frequency"];
    order: number;
    usageNote?: string | null;
    cautionNotes?: string[];
    active?: boolean;
  }>;
  conflictNotes?: string[];
};

export type CreateRoutineVersionInput = {
  routineId: string;
  items: CareRoutineItem[];
  conflictNotes?: string[];
};

export type SaveFeedbackInput = {
  productId?: string | null;
  routineItemId?: string | null;
  checkInId?: string | null;
  used?: boolean | null;
  purchased?: boolean | null;
  satisfaction?: number | null;
  irritation?: boolean | null;
  stopReason?: string | null;
  repurchaseIntent?: boolean | null;
  concernChange?: string | null;
};

export type CareDashboardDTO = {
  linkedAccount: boolean;
  source: "server";
  sessions: CareAnalysisSession[];
  activeRoutine: CareRoutine | null;
  checkIns: CareCheckIn[];
  suggestions: CareSuggestion[];
  notifications: CareNotification[];
  progressSummary: CareProgressDelta[];
  unreadNotifications: number;
  nextDueCheckIn: CareCheckIn | null;
  settings: CareUserSettings;
};

export type AttachLocalStoreResult = {
  sessionsAttached: number;
  routinesAttached: number;
  checkInsAttached: number;
  skippedDuplicates: number;
};

export type CareProgressSummaryDTO = {
  deltas: CareProgressDelta[];
  snapshots: number;
};

/** Map local store for attach payload validation */
export function isCareStoreSnapshot(value: unknown): value is CareStoreSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as CareStoreSnapshot;
  return v.version === 1 && Array.isArray(v.sessions) && Array.isArray(v.checkIns);
}

export const CARE_PROGRESS_METRICS: CareProgressMetric[] = [
  "dryness",
  "oiliness",
  "sensitivity",
  "redness",
  "breakouts",
  "texture",
  "satisfaction",
  "adherence",
];
