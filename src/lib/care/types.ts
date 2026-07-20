// Continuous care domain types (client + server safe).
// No medical diagnosis claims.

export const CARE_CHECKIN_DAYS = [3, 7, 15, 30] as const;
export type CareCheckInDay = (typeof CARE_CHECKIN_DAYS)[number];

export type CareCheckInStatus =
  | "scheduled"
  | "due"
  | "completed"
  | "skipped"
  | "expired"
  | "cancelled";

export type CareRoutineStep =
  | "cleanser"
  | "toner"
  | "essence"
  | "serum"
  | "ampoule"
  | "treatment"
  | "moisturizer"
  | "sunscreen"
  | "eye care"
  | "lip care"
  | "mask"
  | "exfoliant"
  | "body"
  | "scalp";

export type CareAnalysisSession = {
  id: string;
  createdAt: string;
  timezone: string;
  country: string | null;
  ageBand: string | null;
  skinType: string | null;
  sensitivity: string | null;
  concerns: string[];
  toneDepth: string | null;
  undertone: string | null;
  allergyIngredients: string[];
  avoidedIngredients: string[];
  currentProducts: string[];
  budgetBand: string | null;
  texturePreference: string | null;
  fragrancePreference: string | null;
  analysisSnapshot: Record<string, unknown>;
  recommendationSnapshot: Record<string, unknown>;
  rankedProductIds: string[];
  dataConfidence: number | null;
  dermatologyHints: string[];
  consentCareTracking: boolean;
  linkedAccount: boolean;
  anonymousDeviceId: string | null;
};

export type CareRoutineItem = {
  id: string;
  step: CareRoutineStep;
  productId: string | null;
  customProductName: string | null;
  timeOfDay: "am" | "pm" | "both";
  frequency: "daily" | "every_other_day" | "2x_week" | "as_needed";
  order: number;
  startedAt: string;
  stoppedAt: string | null;
  usageNote: string | null;
  cautionNotes: string[];
  allergyConflict: boolean;
  active: boolean;
};

export type CareRoutine = {
  id: string;
  analysisSessionId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  timezone: string;
  items: CareRoutineItem[];
  conflictNotes: string[];
};

export type CareAcuteSignals = {
  pain: boolean;
  bleeding: boolean;
  oozing: boolean;
  rapidSwelling: boolean;
  spreadingRash: boolean;
  infectionSuspect: boolean;
  burn: boolean;
  eyeIrritation: boolean;
  breathingDifficulty: boolean;
  systemicAllergy: boolean;
};

export type CareCheckInStoppedReason =
  | "irritation"
  | "complexity"
  | "purchase_failed"
  | "other";

export type CareCheckInOverallResponse =
  | "improved"
  | "unchanged"
  | "worsened"
  | "not_started"
  | "stopped"
  | "unsure";

export type CareCheckInAnswers = {
  stillUsing: boolean | null;
  sting: number | null;
  itch: number | null;
  redness: number | null;
  dryness: number | null;
  oiliness: number | null;
  breakouts: number | null;
  swelling: number | null;
  peeling: number | null;
  satisfaction: number | null;
  adherence: number | null;
  photoAttached: boolean;
  freeMemo: string | null;
  acuteSignals?: Partial<CareAcuteSignals>;
  overallResponse?: CareCheckInOverallResponse | null;
  stoppedReason?: CareCheckInStoppedReason | null;
  stoppedReasonNote?: string | null;
};

export type CareCheckIn = {
  id: string;
  analysisSessionId: string;
  routineId: string | null;
  day: CareCheckInDay;
  status: CareCheckInStatus;
  scheduledFor: string;
  dueAt: string;
  completedAt: string | null;
  timezone: string;
  answers: CareCheckInAnswers | null;
  progressDelta: CareProgressDelta | null;
  referralLevel: CareReferralLevel;
  suggestionIds: string[];
};

export type CareProgressMetric =
  | "dryness"
  | "oiliness"
  | "sensitivity"
  | "redness"
  | "breakouts"
  | "pigmentation"
  | "texture"
  | "satisfaction"
  | "adherence";

export type CareTrend = "improved" | "similar" | "worsened" | "insufficient_data";

export type CareProgressDelta = {
  metric: CareProgressMetric;
  from: number | null;
  to: number | null;
  trend: CareTrend;
};

export type CareReferralLevel =
  | "none"
  | "consider_soon"
  | "seek_promptly"
  | "seek_emergency_care";

export type CareSuggestion = {
  id: string;
  createdAt: string;
  checkInId: string | null;
  title: string;
  reason: string;
  expectedEffect: string;
  applied: boolean;
  requiresUserConfirm: true;
  patch: Partial<{
    reduceFrequencyItemIds: string[];
    pauseItemIds: string[];
    addMoisturizerHint: boolean;
    simplifyRoutine: boolean;
    observeWeeks: number;
  }>;
};

export type CareNotification = {
  id: string;
  createdAt: string;
  kind: "checkin_due" | "progress_summary" | "referral" | "suggestion" | "info";
  title: string;
  message: string;
  relatedCheckInId: string | null;
  read: boolean;
  fingerprint: string;
};

export type CareFeedback = {
  id: string;
  createdAt: string;
  productId: string | null;
  used: boolean | null;
  purchased: boolean | null;
  satisfaction: number | null;
  irritation: boolean | null;
  stopReason: string | null;
  repurchaseIntent: boolean | null;
  concernChange: string | null;
};

export type CareUserSettings = {
  notificationsEnabled: boolean;
  emailOptIn: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
  timezone: string;
};

export type CareStoreSnapshot = {
  version: 1;
  deviceId: string;
  sessions: CareAnalysisSession[];
  routines: CareRoutine[];
  checkIns: CareCheckIn[];
  suggestions: CareSuggestion[];
  notifications: CareNotification[];
  feedback: CareFeedback[];
  settings: CareUserSettings;
  updatedAt: string;
};