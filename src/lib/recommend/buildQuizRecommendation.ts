import type { Recommendation } from "./types";

export type QuizRecommendationInput = {
  concern?: string | null;
  tone?: string | null;
};

/**
 * 피부 문진 URL 파라미터 → Recommendation.
 * 성분 목록은 비워 두고, persistTopRankedProducts의 Evidence 병합에 맡긴다.
 */
export function buildQuizRecommendation(
  input: QuizRecommendationInput
): Recommendation | null {
  const concern = (input.concern ?? "").trim();
  if (!concern) return null;

  const tone = (input.tone ?? "").trim();

  return {
    skinConcerns: [concern],
    recommendedIngredients: [],
    ingredientsToAvoid: [],
    confidenceScore: 0.55,
    ...(tone ? { skinType: tone } : {}),
    managementLevel: "cosmetic_care",
    summaryKo: `문진에서 선택한 고민(${concern})을 기준으로 한 참고 추천입니다. 의료 진단이 아닙니다.`,
    summaryEn: `Reference picks for your quiz concern (${concern}). Not a medical diagnosis.`,
    summaryJa: `問診で選んだ悩み（${concern}）に基づく参考おすすめです。医療診断ではありません。`,
  };
}

/** 문진 Top5 재랭킹 지문 (동일 조건 반복 호출 방지) */
export const QUIZ_RANK_FINGERPRINT_KEY = "quizRankFingerprint";

export function quizRankFingerprint(input: {
  concern?: string | null;
  tone?: string | null;
  budget?: string | null;
}): string {
  return [
    (input.concern ?? "").trim(),
    (input.tone ?? "").trim(),
    (input.budget ?? "").trim(),
  ].join("|");
}
