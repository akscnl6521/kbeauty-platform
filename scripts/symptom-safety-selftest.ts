import assert from "node:assert/strict";
import { applySymptomSafetyToRecommendation } from "../src/lib/ai/symptomSafety";
import type { AnalyzeSkinRequest } from "../src/lib/ai/types";
import type { Recommendation } from "../src/lib/recommend";

function baseRecommendation(): Recommendation {
  return {
    skinConcerns: ["Dryness"],
    recommendedIngredients: ["Ceramide", "Panthenol"],
    ingredientsToAvoid: ["Fragrance"],
    confidenceScore: 0.82,
    managementLevel: "cosmetic_care",
    manageableWithCosmetics: ["가벼운 건조함"],
    precautions: [],
    notRecommendedReasons: [],
    expertReferralReasons: [],
  };
}

function manualInput(
  concernObservations: NonNullable<AnalyzeSkinRequest["concernObservations"]>
): AnalyzeSkinRequest {
  return {
    mode: "manual",
    skinTone: "중간",
    undertone: "중립",
    concerns: concernObservations.map((item) => item.concern),
    sensitivity: "보통",
    concernObservations,
  };
}

{
  const original = baseRecommendation();
  const result = applySymptomSafetyToRecommendation(
    original,
    manualInput([
      {
        concern: "건조함",
        areas: ["cheek"],
        severity: "mild",
        duration: "under_2_weeks",
        worsening: false,
        redFlags: [],
      },
    ])
  );

  assert.deepEqual(result, original, "가벼운 증상은 추천을 제한하지 않아야 합니다.");
}

{
  const result = applySymptomSafetyToRecommendation(
    baseRecommendation(),
    manualInput([
      {
        concern: "여드름",
        areas: ["chin"],
        severity: "severe",
        duration: "over_3_months",
        worsening: true,
        redFlags: [],
      },
    ])
  );

  assert.equal(result.managementLevel, "expert_first");
  assert.deepEqual(result.recommendedIngredients, []);
  assert.deepEqual(result.manageableWithCosmetics, []);
  assert.ok(
    result.expertReferralReasons?.some((reason) => reason.includes("전문가 상담")),
    "심하고 악화되는 증상은 전문가 상담 이유를 포함해야 합니다."
  );
}

{
  const result = applySymptomSafetyToRecommendation(
    baseRecommendation(),
    manualInput([
      {
        concern: "붉은기",
        areas: ["eye_area"],
        severity: "moderate",
        duration: "under_3_days",
        worsening: true,
        redFlags: ["eye_irritation"],
      },
    ])
  );

  assert.equal(result.managementLevel, "urgent_check");
  assert.deepEqual(result.recommendedIngredients, []);
  assert.ok(
    result.notRecommendedReasons?.some((reason) => reason.includes("위험 신호")),
    "긴급 위험 신호는 제품 추천 제한 이유를 포함해야 합니다."
  );
}

{
  const result = applySymptomSafetyToRecommendation(
    baseRecommendation(),
    manualInput([
      {
        concern: "피부 이상",
        areas: ["other"],
        severity: "moderate",
        duration: "under_2_weeks",
        worsening: false,
        redFlags: ["oozing"],
      },
    ])
  );

  assert.equal(result.managementLevel, "expert_first");
  assert.ok(
    result.expertReferralReasons?.some((reason) => reason.includes("진물")),
    "전문가 우선 위험 신호는 구체적인 사용자 입력 이유를 포함해야 합니다."
  );
}

console.log("symptom-safety-selftest: PASS");
