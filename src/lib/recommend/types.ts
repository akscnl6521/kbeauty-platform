/**
 * Shared types for the recommendation pipeline (Phase 1+).
 * Ranking / product search types will extend these later.
 */

/** Raw AI analysis payload shape used by the analyze UI. */
export type AnalysisResult = {
  skin_type: string;
  concerns: string[];
  ingredients: string[];
  summary_en: string;
  summary_ko: string;
  summary_ja: string;
  routine_tips: string[];
};

/**
 * Structured recommendation derived from AI analysis.
 * Product search / ranking consume this in later phases.
 */
export interface Recommendation {
  /** Normalized skin concerns (e.g. Redness, Dryness). */
  skinConcerns: string[];
  /** Ingredients suggested for the profile. */
  recommendedIngredients: string[];
  /** Ingredients to avoid or de-prioritize. */
  ingredientsToAvoid: string[];
  /** Confidence in [0, 1]. */
  confidenceScore: number;
}

/** localStorage key for the structured recommendation (Phase 1). */
export const RECOMMENDATION_STORAGE_KEY = "skinRecommendation";

/** Existing analyze UI storage key — keep writing AnalysisResult here. */
export const ANALYSIS_RESULT_STORAGE_KEY = "skinAnalysisResult";
