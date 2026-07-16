/**
 * DB row ↔ domain mappers (pure).
 */

import type {
  CareAnalysisSession,
  CareCheckIn,
  CareCheckInAnswers,
  CareCheckInDay,
  CareNotification,
  CareProgressDelta,
  CareRoutine,
  CareRoutineItem,
  CareRoutineStep,
  CareSuggestion,
} from "@/lib/care/types";
import type {
  CareAnalysisSessionRow,
  CareCheckInRow,
  CareNotificationRow,
  CareProgressSummaryPayload,
  CareRoutineItemRow,
  CareRoutineRow,
  CareSuggestionRow,
  SaveAnalysisSessionInput,
} from "@/lib/care/persistence/types";

const ROUTINE_STEPS = new Set<string>([
  "cleanser",
  "toner",
  "essence",
  "serum",
  "ampoule",
  "treatment",
  "moisturizer",
  "sunscreen",
  "eye care",
  "lip care",
  "mask",
  "exfoliant",
  "body",
  "scalp",
]);

function asRoutineStep(step: string): CareRoutineStep {
  return (ROUTINE_STEPS.has(step) ? step : "serum") as CareRoutineStep;
}

export function mapSessionRowToDomain(row: CareAnalysisSessionRow): CareAnalysisSession {
  return {
    id: row.id,
    createdAt: row.created_at,
    timezone: row.timezone,
    country: row.country,
    ageBand: row.age_band,
    skinType: row.skin_type,
    sensitivity: row.sensitivity,
    concerns: row.concerns ?? [],
    toneDepth: row.tone_depth,
    undertone: row.undertone,
    allergyIngredients: row.allergy_ingredients ?? [],
    avoidedIngredients: row.avoided_ingredients ?? [],
    currentProducts: row.current_products ?? [],
    budgetBand: row.budget_band,
    texturePreference: row.texture_preference,
    fragrancePreference: row.fragrance_preference,
    analysisSnapshot: row.analysis_snapshot ?? {},
    recommendationSnapshot: row.recommendation_snapshot ?? {},
    rankedProductIds: (row.ranked_product_ids ?? []).map(String),
    dataConfidence: row.data_confidence,
    dermatologyHints: row.dermatology_hints ?? [],
    consentCareTracking: row.consent_care_tracking,
    linkedAccount: row.linked_account,
    anonymousDeviceId: row.anonymous_session_id,
  };
}

export function mapSaveSessionInputToRow(
  input: SaveAnalysisSessionInput,
  userId: string
): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    user_id: userId,
    anonymous_session_id: null,
    timezone: input.timezone,
    country: input.country,
    age_band: input.ageBand ?? null,
    skin_type: input.skinType,
    sensitivity: input.sensitivity,
    concerns: input.concerns,
    tone_depth: input.toneDepth,
    undertone: input.undertone,
    allergy_ingredients: input.allergyIngredients,
    avoided_ingredients: input.avoidedIngredients,
    current_products: input.currentProducts ?? [],
    budget_band: input.budgetBand ?? null,
    texture_preference: input.texturePreference ?? null,
    fragrance_preference: input.fragrancePreference ?? null,
    analysis_snapshot: input.analysisSnapshot,
    recommendation_snapshot: input.recommendationSnapshot,
    ranked_product_ids: input.rankedProductIds,
    data_confidence: input.dataConfidence ?? null,
    referral_level: "none",
    referral_reasons: [],
    dermatology_hints: input.dermatologyHints ?? [],
    consent_status: input.consentCareTracking ? "granted" : "pending",
    consent_care_tracking: input.consentCareTracking,
    linked_account: true,
    consented_at: input.consentCareTracking ? now : null,
  };
}

export function mapRoutineRowToDomain(
  row: CareRoutineRow,
  items: CareRoutineItemRow[]
): CareRoutine {
  return {
    id: row.id,
    analysisSessionId: row.analysis_session_id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    timezone: row.timezone,
    conflictNotes: row.conflict_notes ?? [],
    items: items
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(mapRoutineItemRowToDomain),
  };
}

export function mapRoutineItemRowToDomain(row: CareRoutineItemRow): CareRoutineItem {
  return {
    id: row.id,
    step: asRoutineStep(row.step),
    productId: row.product_id != null ? String(row.product_id) : null,
    customProductName: row.custom_product_name,
    timeOfDay: row.time_of_day,
    frequency: row.frequency,
    order: row.sort_order,
    startedAt: row.started_at,
    stoppedAt: row.stopped_at,
    usageNote: row.usage_note,
    cautionNotes: row.caution_notes ?? [],
    allergyConflict: row.allergy_conflict,
    active: row.active,
  };
}

export function mapRoutineItemToRow(
  item: CareRoutineItem,
  routineId: string
): Record<string, unknown> {
  return {
    id: item.id,
    routine_id: routineId,
    step: item.step,
    product_id: item.productId ? Number(item.productId) || null : null,
    custom_product_name: item.customProductName,
    time_of_day: item.timeOfDay,
    frequency: item.frequency,
    sort_order: item.order,
    started_at: item.startedAt,
    stopped_at: item.stoppedAt,
    usage_note: item.usageNote,
    caution_notes: item.cautionNotes,
    allergy_conflict: item.allergyConflict,
    active: item.active,
  };
}

export function mapCheckInRowToDomain(
  row: CareCheckInRow,
  suggestionIds: string[] = []
): CareCheckIn {
  const summary = row.progress_summary as CareProgressSummaryPayload | null;
  return {
    id: row.id,
    analysisSessionId: row.analysis_session_id,
    routineId: row.routine_id,
    day: row.day as CareCheckInDay,
    status: row.status,
    scheduledFor: row.scheduled_for,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    timezone: row.timezone,
    answers: row.answers as CareCheckInAnswers | null,
    progressDelta: summary?.primary ?? null,
    referralLevel: row.referral_level,
    suggestionIds,
  };
}

export function mapSuggestionRowToDomain(row: CareSuggestionRow): CareSuggestion {
  return {
    id: row.id,
    createdAt: row.created_at,
    checkInId: row.check_in_id,
    title: row.title,
    reason: row.reason,
    expectedEffect: row.expected_effect,
    applied: row.applied,
    requiresUserConfirm: true,
    patch: row.patch ?? {},
  };
}

export function mapNotificationRowToDomain(row: CareNotificationRow): CareNotification {
  return {
    id: row.id,
    createdAt: row.created_at,
    kind: row.kind,
    title: row.title,
    message: row.message,
    relatedCheckInId: row.related_check_in_id ?? row.check_in_id,
    read: row.read,
    fingerprint: row.fingerprint,
  };
}

export function buildProgressSummaryPayload(
  deltas: CareProgressDelta[]
): CareProgressSummaryPayload {
  return {
    deltas,
    primary: deltas[0] ?? null,
  };
}

export function mapLocalSessionToAttachRow(
  session: CareAnalysisSession,
  userId: string,
  newId: string
): Record<string, unknown> {
  return {
    id: newId,
    user_id: userId,
    anonymous_session_id: session.id,
    timezone: session.timezone,
    country: session.country,
    age_band: session.ageBand,
    skin_type: session.skinType,
    sensitivity: session.sensitivity,
    concerns: session.concerns,
    tone_depth: session.toneDepth,
    undertone: session.undertone,
    allergy_ingredients: session.allergyIngredients,
    avoided_ingredients: session.avoidedIngredients,
    current_products: session.currentProducts,
    budget_band: session.budgetBand,
    texture_preference: session.texturePreference,
    fragrance_preference: session.fragrancePreference,
    analysis_snapshot: session.analysisSnapshot,
    recommendation_snapshot: session.recommendationSnapshot,
    ranked_product_ids: session.rankedProductIds,
    data_confidence: session.dataConfidence,
    referral_level: "none",
    referral_reasons: [],
    dermatology_hints: session.dermatologyHints,
    consent_status: session.consentCareTracking ? "granted" : "pending",
    consent_care_tracking: session.consentCareTracking,
    linked_account: true,
    consented_at: session.consentCareTracking ? session.createdAt : null,
    started_at: session.createdAt,
    created_at: session.createdAt,
    updated_at: new Date().toISOString(),
  };
}

export function localSessionAttachFingerprint(localSessionId: string): string {
  return `attach_session:${localSessionId}`;
}

export function localNotificationAttachFingerprint(
  userId: string,
  fingerprint: string
): string {
  return `attach_notif:${userId}:${fingerprint}`;
}
