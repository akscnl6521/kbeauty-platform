import type {
  AnalysisResult,
  CandidateProduct,
  ManagementLevel,
  RankedProduct,
  Recommendation,
} from "./types";
import {
  ANALYSIS_RESULT_STORAGE_KEY,
  RANKED_PRODUCTS_STORAGE_KEY,
  RECOMMENDATION_STORAGE_KEY,
} from "./types";
import { normalizeCurrentProducts } from "./currentProduct";
import { loadRankedProductsFromStorage } from "./loadRankedProducts";
import { parseRednessObservation } from "@/lib/ai/rednessObservation";

const MANAGEMENT_LEVELS: readonly ManagementLevel[] = [
  "cosmetic_care",
  "observe",
  "combined_care",
  "expert_first",
  "urgent_check",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t || undefined;
}

function asManagementLevel(value: unknown): ManagementLevel | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim() as ManagementLevel;
  return (MANAGEMENT_LEVELS as readonly string[]).includes(v) ? v : undefined;
}

/**
 * LocalStorage(skinRecommendation)에서 Recommendation 을 읽는다.
 * 확장 필드(선택)도 함께 복원한다.
 */
export function loadRecommendationFromStorage(): Recommendation | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(RECOMMENDATION_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const skinConcerns = asStringArray(
      parsed.skinConcerns ?? parsed.skin_concerns ?? parsed.concerns
    );
    const recommendedIngredients = asStringArray(
      parsed.recommendedIngredients ??
        parsed.recommended_ingredients ??
        parsed.ingredients
    );
    const ingredientsToAvoid = asStringArray(
      parsed.ingredientsToAvoid ??
        parsed.ingredients_to_avoid ??
        parsed.avoid_ingredients
    );
    const confidenceScore =
      typeof parsed.confidenceScore === "number" &&
      Number.isFinite(parsed.confidenceScore)
        ? parsed.confidenceScore
        : typeof parsed.confidence_score === "number" &&
            Number.isFinite(parsed.confidence_score)
          ? parsed.confidence_score
          : 0;

    const allergyIngredients = asStringArray(
      parsed.allergyIngredients ?? parsed.allergy_ingredients
    );
    const avoidedIngredients = asStringArray(
      parsed.avoidedIngredients ?? parsed.avoided_ingredients
    );
    const safetyExcludedCount =
      typeof parsed.safetyExcludedCount === "number" &&
      Number.isFinite(parsed.safetyExcludedCount)
        ? parsed.safetyExcludedCount
        : typeof parsed.safety_excluded_count === "number" &&
            Number.isFinite(parsed.safety_excluded_count)
          ? parsed.safety_excluded_count
          : undefined;
    const safetyIncompleteCount =
      typeof parsed.safetyIncompleteCount === "number" &&
      Number.isFinite(parsed.safetyIncompleteCount)
        ? parsed.safetyIncompleteCount
        : typeof parsed.safety_incomplete_count === "number" &&
            Number.isFinite(parsed.safety_incomplete_count)
          ? parsed.safety_incomplete_count
          : undefined;

    const base: Recommendation = {
      skinConcerns,
      recommendedIngredients,
      ingredientsToAvoid,
      confidenceScore,
      allergyIngredients,
      avoidedIngredients,
      ...(safetyExcludedCount !== undefined ? { safetyExcludedCount } : {}),
      ...(safetyIncompleteCount !== undefined
        ? { safetyIncompleteCount }
        : {}),
    };

    const currentProducts = normalizeCurrentProducts(
      parsed.currentProducts ?? parsed.current_products
    );
    const currentRoutineIssues = asStringArray(
      parsed.currentRoutineIssues ?? parsed.current_routine_issues
    );
    const duplicateFunctions = asStringArray(
      parsed.duplicateFunctions ?? parsed.duplicate_functions
    );
    const routineSimplificationSuggestions = asStringArray(
      parsed.routineSimplificationSuggestions ??
        parsed.routine_simplification_suggestions
    );
    const currentProductWarnings = asStringArray(
      parsed.currentProductWarnings ?? parsed.current_product_warnings
    );
    const suggestedMorningOrder = asStringArray(
      parsed.suggestedMorningOrder ?? parsed.suggested_morning_order
    );
    const suggestedEveningOrder = asStringArray(
      parsed.suggestedEveningOrder ?? parsed.suggested_evening_order
    );

    const skinType = asOptionalString(parsed.skinType ?? parsed.skin_type);
    const managementLevel = asManagementLevel(
      parsed.managementLevel ?? parsed.management_level
    );
    const manageableWithCosmetics = asStringArray(
      parsed.manageableWithCosmetics ?? parsed.manageable_with_cosmetics
    );
    const cosmeticLimitations = asStringArray(
      parsed.cosmeticLimitations ?? parsed.cosmetic_limitations
    );
    const morningRoutine = asStringArray(
      parsed.morningRoutine ?? parsed.morning_routine
    );
    const eveningRoutine = asStringArray(
      parsed.eveningRoutine ?? parsed.evening_routine
    );
    const precautions = asStringArray(parsed.precautions);
    const notRecommendedReasons = asStringArray(
      parsed.notRecommendedReasons ?? parsed.not_recommended_reasons
    );
    const expertReferralReasons = asStringArray(
      parsed.expertReferralReasons ?? parsed.expert_referral_reasons
    );
    const summaryKo = asOptionalString(
      parsed.summaryKo ?? parsed.summary_ko
    );
    const summaryEn = asOptionalString(
      parsed.summaryEn ?? parsed.summary_en
    );
    const summaryJa = asOptionalString(
      parsed.summaryJa ?? parsed.summary_ja
    );
    const rednessObservation = parseRednessObservation(
      parsed.rednessObservation ?? parsed.redness_observation
    );

    return {
      ...base,
      ...(currentProducts.length ? { currentProducts } : {}),
      ...(currentRoutineIssues.length ? { currentRoutineIssues } : {}),
      ...(duplicateFunctions.length ? { duplicateFunctions } : {}),
      ...(routineSimplificationSuggestions.length
        ? { routineSimplificationSuggestions }
        : {}),
      ...(currentProductWarnings.length ? { currentProductWarnings } : {}),
      ...(suggestedMorningOrder.length ? { suggestedMorningOrder } : {}),
      ...(suggestedEveningOrder.length ? { suggestedEveningOrder } : {}),
      ...(skinType ? { skinType } : {}),
      ...(managementLevel ? { managementLevel } : {}),
      ...(manageableWithCosmetics.length
        ? { manageableWithCosmetics }
        : {}),
      ...(cosmeticLimitations.length ? { cosmeticLimitations } : {}),
      ...(morningRoutine.length ? { morningRoutine } : {}),
      ...(eveningRoutine.length ? { eveningRoutine } : {}),
      ...(precautions.length ? { precautions } : {}),
      ...(notRecommendedReasons.length ? { notRecommendedReasons } : {}),
      ...(expertReferralReasons.length ? { expertReferralReasons } : {}),
      ...(summaryKo ? { summaryKo } : {}),
      ...(summaryEn ? { summaryEn } : {}),
      ...(summaryJa ? { summaryJa } : {}),
      ...(rednessObservation ? { rednessObservation } : {}),
    };
  } catch {
    return null;
  }
}

/** 분석 UI용 skinAnalysisResult — 요약 폴백용 */
export function loadAnalysisResultFromStorage(): AnalysisResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ANALYSIS_RESULT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    return {
      skin_type:
        typeof parsed.skin_type === "string"
          ? parsed.skin_type
          : typeof parsed.skinType === "string"
            ? parsed.skinType
            : "",
      concerns: asStringArray(
        parsed.concerns ?? parsed.skinConcerns ?? parsed.skin_concerns
      ),
      ingredients: asStringArray(
        parsed.ingredients ??
          parsed.recommendedIngredients ??
          parsed.recommended_ingredients
      ),
      summary_en:
        typeof parsed.summary_en === "string"
          ? parsed.summary_en
          : typeof parsed.summaryEn === "string"
            ? parsed.summaryEn
            : "",
      summary_ko:
        typeof parsed.summary_ko === "string"
          ? parsed.summary_ko
          : typeof parsed.summaryKo === "string"
            ? parsed.summaryKo
            : "",
      summary_ja:
        typeof parsed.summary_ja === "string"
          ? parsed.summary_ja
          : typeof parsed.summaryJa === "string"
            ? parsed.summaryJa
            : "",
      routine_tips: asStringArray(
        parsed.routine_tips ?? parsed.routineTips
      ),
    };
  } catch {
    return null;
  }
}

/**
 * recommendation 이 비어 있는 요약/타입을 analysis 로 보강.
 * 랭킹 필드는 변경하지 않는다.
 */
export function enrichRecommendationWithAnalysis(
  recommendation: Recommendation | null,
  analysis: AnalysisResult | null
): Recommendation | null {
  if (!recommendation) return null;
  if (!analysis) return recommendation;

  return {
    ...recommendation,
    skinType:
      recommendation.skinType?.trim() ||
      analysis.skin_type?.trim() ||
      recommendation.skinType,
    summaryKo:
      recommendation.summaryKo?.trim() ||
      analysis.summary_ko?.trim() ||
      recommendation.summaryKo,
    summaryEn:
      recommendation.summaryEn?.trim() ||
      analysis.summary_en?.trim() ||
      recommendation.summaryEn,
    summaryJa:
      recommendation.summaryJa?.trim() ||
      analysis.summary_ja?.trim() ||
      recommendation.summaryJa,
    skinConcerns:
      recommendation.skinConcerns.length > 0
        ? recommendation.skinConcerns
        : analysis.concerns,
    recommendedIngredients:
      recommendation.recommendedIngredients.length > 0
        ? recommendation.recommendedIngredients
        : analysis.ingredients,
  };
}

export type RecommendationPipelineSnapshot = {
  recommendation: Recommendation | null;
  rankedProducts: RankedProduct<CandidateProduct>[];
  analysis: AnalysisResult | null;
};

/**
 * 추천 파이프라인 스냅샷.
 * - skinRecommendation (+ analysis 폴백)
 * - skinRankedProducts
 * - skinAnalysisResult
 */
export function loadLatestRecommendationPipeline(): RecommendationPipelineSnapshot {
  const analysis = loadAnalysisResultFromStorage();
  const recommendation = enrichRecommendationWithAnalysis(
    loadRecommendationFromStorage(),
    analysis
  );
  return {
    recommendation,
    rankedProducts: loadRankedProductsFromStorage(),
    analysis,
  };
}

/**
 * 예전에 쓰이던 추천 관련 키 제거.
 * skinAnalysisResult 는 분석 UI·요약 폴백용으로 유지한다.
 */
export function purgeLegacyRecommendationCaches(): void {
  if (typeof window === "undefined") return;

  const legacyKeys = [
    "recommendation",
    "rankedProducts",
    "aiRecommendation",
    "aiRankedProducts",
    "skinRankedProduct",
    "skinRecommendations",
  ];

  try {
    for (const key of legacyKeys) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

/** 개발용: 현재 SoT 키 이름 */
export const RECOMMENDATION_SOURCE_KEYS = {
  recommendation: RECOMMENDATION_STORAGE_KEY,
  rankedProducts: RANKED_PRODUCTS_STORAGE_KEY,
  /** 분석 UI + 요약 폴백 */
  analysisUiOnly: ANALYSIS_RESULT_STORAGE_KEY,
} as const;
