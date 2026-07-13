import {
  normalizeAnalysisResult,
  type AnalysisResult,
  type Recommendation,
} from "@/lib/recommend";
import { reviewCurrentRoutine } from "@/lib/recommend/currentProduct";
import {
  getRequestAllergyIngredients,
  getRequestAvoidedIngredients,
  getRequestCurrentProducts,
} from "./prompt";
import type { AnalyzeSkinRequest, AnalyzeSkinResponse } from "./types";
import { validateRecommendation } from "./validateRecommendation";
import { applyRednessObservationToRecommendation } from "./rednessObservation";

function createDevMockAnalysis(input: AnalyzeSkinRequest): AnalysisResult {
  const concernLabel =
    input.mode === "manual" && input.concerns.length > 0
      ? input.concerns.join(", ")
      : "홍조, 민감성, 건조";

  return {
    skin_type: "민감·건성 경향 (개발 mock)",
    concerns: ["홍조", "민감성", "건조"],
    ingredients: [
      "센텔라 아시아티카",
      "판테놀",
      "세라마이드",
      "히알루론산",
    ],
    summary_ko: `[개발 mock] 제공된 정보 기준의 일반 스킨케어 안내입니다. 고민: ${concernLabel}`,
    summary_en: `[DEV MOCK] General skincare guidance from provided info only. Concerns: ${concernLabel}`,
    summary_ja: `[開発モック] 提供情報のみに基づく一般的なスキンケア案内です。悩み: ${concernLabel}`,
    routine_tips: [
      "개발용 mock — 의료 진단이 아닙니다",
      "자극이 있으면 사용을 중단하고 전문가 상담을 고려하세요",
    ],
  };
}

/** Master Plan 확장 필드를 포함한 개발용 mock Recommendation */
function createExpandedMockRecommendation(
  input: AnalyzeSkinRequest
): Recommendation {
  const concerns =
    input.mode === "manual" && input.concerns.length > 0
      ? [...input.concerns]
      : ["홍조", "민감성", "건조"];

  const allergy = getRequestAllergyIngredients(input);
  const avoided = getRequestAvoidedIngredients(input);
  const currentProducts = getRequestCurrentProducts(input);
  const routineReview = reviewCurrentRoutine(
    currentProducts,
    allergy,
    avoided
  );

  const rednessNote =
    input.mode === "manual" && input.rednessObservation
      ? " 사용자가 밝힌 붉어 보이는 상황에 대한 관찰 정보를 참고했으며, 원인을 진단한 결과는 아닙니다."
      : "";

  // 의도적으로 알레르기·회피 성분을 추천 목록에 섞어 후처리 필터를 검증한다.
  const recommendedIngredients = [
    "센텔라 아시아티카",
    "판테놀",
    "세라마이드",
    "히알루론산",
    ...allergy.slice(0, 1),
    ...avoided.slice(0, 1),
  ];

  const base: Recommendation = {
    skinConcerns: concerns,
    recommendedIngredients,
    ingredientsToAvoid: ["고함량 알코올", "강한 향료", ...allergy, ...avoided],
    confidenceScore: 0.72,
    allergyIngredients: allergy,
    avoidedIngredients: avoided,
    currentProducts,
    ...routineReview,
    skinType: "민감·건성 경향",
    managementLevel: "cosmetic_care",
    manageableWithCosmetics: [
      "가벼운 보습",
      "장벽 케어 성분 중심의 순한 루틴",
    ],
    cosmeticLimitations: [
      "지속·악화되는 증상은 화장품만으로 판단하기 어렵습니다",
    ],
    morningRoutine: [
      "미온수로 가볍게 세안",
      "저자극 토너 또는 에센스",
      "보습제",
      "낮 자외선 차단",
    ],
    eveningRoutine: [
      "순한 클렌저",
      "장벽 케어 보습",
      "필요 시 진정 성분 레이어링",
    ],
    precautions: [
      "새 제품은 소량 패치 테스트 후 사용",
      "따가움·가려움이 있으면 즉시 중단",
    ],
    notRecommendedReasons: [],
    expertReferralReasons: [],
    summaryKo:
      `제공된 정보만으로 정리한 일반 스킨케어 안내입니다. 의료 진단이 아니며, 증상이 심하거나 지속되면 전문가 상담을 권합니다.${rednessNote}`,
    summaryEn:
      "General skincare guidance based only on the information provided. This is not a medical diagnosis; seek professional care if symptoms are severe or persistent.",
    summaryJa:
      "提供された情報のみに基づく一般的なスキンケア案内です。医療診断ではなく、症状が強い・続く場合は専門家への相談を検討してください。",
  };

  return applyRednessObservationToRecommendation(
    base,
    input.mode === "manual" ? input.rednessObservation : undefined
  );
}

/** 개발용 mock 프로바이더 — 유료 API 없이 확장 Recommendation 계약 유지 */
export async function analyzeWithMock(
  input: AnalyzeSkinRequest
): Promise<AnalyzeSkinResponse> {
  const analysis = createDevMockAnalysis(input);
  const recommendation = validateRecommendation(
    createExpandedMockRecommendation(input)
  );

  return {
    analysis: normalizeAnalysisResult({
      ...analysis,
      skin_type: recommendation.skinType || analysis.skin_type,
      concerns: recommendation.skinConcerns,
      ingredients: recommendation.recommendedIngredients,
      summary_ko: recommendation.summaryKo || analysis.summary_ko,
      summary_en: recommendation.summaryEn || analysis.summary_en,
      summary_ja: recommendation.summaryJa || analysis.summary_ja,
      routine_tips: [
        ...(recommendation.morningRoutine ?? []),
        ...(recommendation.eveningRoutine ?? []),
      ].slice(0, 6),
    }),
    recommendation,
    source: "mock",
  };
}
