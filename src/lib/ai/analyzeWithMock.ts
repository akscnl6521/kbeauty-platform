import {
  createMockRecommendation,
  normalizeAnalysisResult,
  type AnalysisResult,
} from "@/lib/recommend";
import type { AnalyzeSkinRequest, AnalyzeSkinResponse } from "./types";
import { validateRecommendation } from "./validateRecommendation";

function createDevMockAnalysis(input: AnalyzeSkinRequest): AnalysisResult {
  const concernLabel =
    input.mode === "manual" && input.concerns.length > 0
      ? input.concerns.join(", ")
      : "홍조, 민감성, 건조";

  return {
    skin_type: "민감·건성 (개발 mock)",
    concerns: ["홍조", "민감성", "건조"],
    ingredients: [
      "센텔라 아시아티카",
      "판테놀",
      "세라마이드",
      "히알루론산",
    ],
    summary_ko: `[개발 mock] AI_PROVIDER=mock — 모의 분석 결과입니다. 고민: ${concernLabel}`,
    summary_en: `[DEV MOCK] AI_PROVIDER=mock — clearly marked mock analysis. Concerns: ${concernLabel}`,
    summary_ja: `[開発モック] AI_PROVIDER=mock — 明示的なモック結果です。悩み: ${concernLabel}`,
    routine_tips: [
      "개발용 mock — 실제 AI 분석이 아닙니다",
      "프로덕션에서는 AI_PROVIDER=openai|anthropic 와 서버 API 키를 설정하세요",
    ],
  };
}

/** 개발용 mock 프로바이더 — 유료 API 없이 Recommendation 계약 유지 */
export async function analyzeWithMock(
  input: AnalyzeSkinRequest
): Promise<AnalyzeSkinResponse> {
  const analysis = createDevMockAnalysis(input);
  const recommendation = validateRecommendation(createMockRecommendation());

  return {
    analysis: normalizeAnalysisResult({
      ...analysis,
      concerns: recommendation.skinConcerns,
      ingredients: recommendation.recommendedIngredients,
    }),
    recommendation,
    source: "mock",
  };
}
