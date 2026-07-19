import assert from "node:assert/strict";
import { applyRednessObservationToRecommendation } from "../src/lib/ai/rednessObservation";
import { applySymptomSafetyToRecommendation } from "../src/lib/ai/symptomSafety";
import type { AnalyzeSkinRequest } from "../src/lib/ai/types";
import type { Recommendation } from "../src/lib/recommend";

function baseRecommendation(): Recommendation {
  return {
    skinConcerns: ["Redness"],
    recommendedIngredients: ["Panthenol", "Ceramide"],
    ingredientsToAvoid: ["Fragrance"],
    confidenceScore: 0.8,
    managementLevel: "cosmetic_care",
    manageableWithCosmetics: ["기본 보습과 자극 최소화"],
    precautions: [],
    notRecommendedReasons: [],
    expertReferralReasons: [],
  };
}

function applySafety(input: AnalyzeSkinRequest): Recommendation {
  const rednessApplied = applyRednessObservationToRecommendation(
    baseRecommendation(),
    input.rednessObservation
  );
  return applySymptomSafetyToRecommendation(rednessApplied, input);
}

{
  const input: AnalyzeSkinRequest = {
    mode: "manual",
    skinTone: "중간",
    undertone: "중립",
    concerns: ["붉은기"],
    sensitivity: "민감함",
    rednessObservation: {
      duration: "persistent",
      symptoms: ["burning", "visible_capillaries"],
      areas: ["cheeks", "nose"],
      trigger: "persistent",
    },
  };
  const result = applySafety(input);
  assert.equal(result.managementLevel, "expert_first");
  assert.deepEqual(result.recommendedIngredients, []);
  assert.ok((result.expertReferralReasons ?? []).length > 0);
  assert.ok((result.notRecommendedReasons ?? []).length > 0);
}

{
  const input: AnalyzeSkinRequest = {
    mode: "manual",
    skinTone: "중간",
    undertone: "중립",
    concerns: ["붉은기"],
    sensitivity: "민감함",
    rednessObservation: {
      duration: "over_one_day",
      symptoms: ["stinging"],
      areas: ["eye_area"],
      trigger: "after_cosmetic",
    },
  };
  const result = applySafety(input);
  assert.equal(result.managementLevel, "urgent_check");
  assert.deepEqual(result.recommendedIngredients, []);
  assert.ok(
    (result.expertReferralReasons ?? []).some((reason) =>
      reason.includes("눈 내부 자극")
    )
  );
}

{
  const input: AnalyzeSkinRequest = {
    mode: "manual",
    skinTone: "중간",
    undertone: "중립",
    concerns: ["붉은기"],
    sensitivity: "민감함",
    concernObservations: [
      {
        concern: "붉은기",
        areas: ["eye_area"],
        severity: "severe",
        duration: "under_3_days",
        worsening: true,
        redFlags: ["eye_irritation", "rapid_swelling"],
      },
    ],
  };
  const result = applySafety(input);
  assert.equal(result.managementLevel, "urgent_check");
  assert.deepEqual(result.recommendedIngredients, []);
  assert.deepEqual(result.manageableWithCosmetics, []);
  assert.ok(
    (result.notRecommendedReasons ?? []).some((reason) =>
      reason.includes("위험 신호")
    )
  );
}

{
  const input: AnalyzeSkinRequest = {
    mode: "manual",
    skinTone: "중간",
    undertone: "중립",
    concerns: ["건조함"],
    sensitivity: "보통",
    concernObservations: [
      {
        concern: "건조함",
        areas: ["cheek"],
        severity: "mild",
        duration: "under_2_weeks",
        worsening: false,
        redFlags: [],
      },
    ],
  };
  const result = applySafety(input);
  assert.equal(result.managementLevel, "cosmetic_care");
  assert.ok(result.recommendedIngredients.length > 0);
}

console.log("analyze safety integration selftest: ok");
