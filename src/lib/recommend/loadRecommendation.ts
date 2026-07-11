import type { CandidateProduct, RankedProduct, Recommendation } from "./types";
import {
  ANALYSIS_RESULT_STORAGE_KEY,
  RANKED_PRODUCTS_STORAGE_KEY,
  RECOMMENDATION_STORAGE_KEY,
} from "./types";
import { loadRankedProductsFromStorage } from "./loadRankedProducts";

/**
 * LocalStorage(skinRecommendation)에서 Recommendation 을 읽는다.
 * skinAnalysisResult 등 레거시 캐시는 절대 읽지 않는다.
 */
export function loadRecommendationFromStorage(): Recommendation | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(RECOMMENDATION_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const row = parsed as Partial<Recommendation>;
    const skinConcerns = Array.isArray(row.skinConcerns)
      ? row.skinConcerns.filter((x): x is string => typeof x === "string")
      : [];
    const recommendedIngredients = Array.isArray(row.recommendedIngredients)
      ? row.recommendedIngredients.filter(
          (x): x is string => typeof x === "string"
        )
      : [];
    const ingredientsToAvoid = Array.isArray(row.ingredientsToAvoid)
      ? row.ingredientsToAvoid.filter((x): x is string => typeof x === "string")
      : [];
    const confidenceScore =
      typeof row.confidenceScore === "number" &&
      Number.isFinite(row.confidenceScore)
        ? row.confidenceScore
        : 0;

    return {
      skinConcerns,
      recommendedIngredients,
      ingredientsToAvoid,
      confidenceScore,
    };
  } catch {
    return null;
  }
}

export type RecommendationPipelineSnapshot = {
  recommendation: Recommendation | null;
  rankedProducts: RankedProduct<CandidateProduct>[];
};

/**
 * 추천 파이프라인의 단일 진실 원천 스냅샷.
 * - skinRecommendation
 * - skinRankedProducts
 */
export function loadLatestRecommendationPipeline(): RecommendationPipelineSnapshot {
  return {
    recommendation: loadRecommendationFromStorage(),
    rankedProducts: loadRankedProductsFromStorage(),
  };
}

/**
 * 예전에 쓰이던 추천 관련 키 제거.
 * skinAnalysisResult 는 분석 UI용으로 유지하되, 추천 소스로는 쓰지 않는다.
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
  /** 분석 UI 전용 — 추천 SoT 아님 */
  analysisUiOnly: ANALYSIS_RESULT_STORAGE_KEY,
} as const;
