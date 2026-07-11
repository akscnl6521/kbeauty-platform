import type { Recommendation } from "./types";

/**
 * Phase 3C — 개발 전용 mock Recommendation.
 * 유료 AI 호출 없이 fetchCandidateProducts → rankProducts → Top5 저장 경로를 검증할 때 사용한다.
 * 프로덕션 런타임에서는 이 객체를 자동 호출하지 않는다.
 */
export const MOCK_RECOMMENDATION: Recommendation = {
  skinConcerns: ["홍조", "민감성", "건조"],
  recommendedIngredients: [
    "센텔라 아시아티카",
    "판테놀",
    "세라마이드",
    "히알루론산",
  ],
  ingredientsToAvoid: ["고함량 알코올", "강한 향료"],
  confidenceScore: 0.9,
};

/** 매번 새 참조가 필요하면 복사본을 반환 */
export function createMockRecommendation(): Recommendation {
  return {
    skinConcerns: [...MOCK_RECOMMENDATION.skinConcerns],
    recommendedIngredients: [...MOCK_RECOMMENDATION.recommendedIngredients],
    ingredientsToAvoid: [...MOCK_RECOMMENDATION.ingredientsToAvoid],
    confidenceScore: MOCK_RECOMMENDATION.confidenceScore,
  };
}
