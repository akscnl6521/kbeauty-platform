/**
 * MASTER_PLAN §14 «두피와 모발 영역의 특별 규칙» 회귀 고정 (§44 단계 5.5).
 *
 * 탈모는 위험 신호가 없어도 화장품만으로 관리하기 어렵다. 얼굴 고민과 같은
 * 경로를 타면 A등급으로 떨어져 제품이 자유롭게 추천되므로, 두피·모발
 * 관찰에 한해 최소 관리 단계를 요구한다. 얼굴 판정은 건드리지 않는다.
 */
import assert from "node:assert/strict";
import {
  applySymptomSafetyToRecommendation,
  scalpEscalationFor,
} from "../src/lib/ai/symptomSafety";
import type { AnalyzeSkinRequest, ConcernObservation } from "../src/lib/ai/types";
import type { Recommendation } from "../src/lib/recommend";

const baseRecommendation: Recommendation = {
  skinType: "combination",
  skinConcerns: [],
  recommendedIngredients: ["판테놀"],
  ingredientsToAvoid: [],
  manageableWithCosmetics: ["두피 보습"],
  precautions: [],
  expertReferralReasons: [],
  notRecommendedReasons: [],
  managementLevel: "cosmetic_care",
  professionalRoutes: [],
} as unknown as Recommendation;

const req = (observations: ConcernObservation[]): AnalyzeSkinRequest =>
  ({ concernObservations: observations }) as unknown as AnalyzeSkinRequest;

// --- 순수 분류 -------------------------------------------------------------

assert.equal(scalpEscalationFor({ concern: "여드름" }).isScalp, false);
assert.equal(scalpEscalationFor({ concern: "탈모가 걱정돼요" }).isScalp, true);
assert.equal(scalpEscalationFor({ concern: "두피 각질" }).isScalp, true);
assert.equal(scalpEscalationFor({ concern: "비듬" }).isScalp, true);

// 일반 탈모 → 최소 C (combined_care)
assert.equal(
  scalpEscalationFor({ concern: "정수리 탈모" }).minimumLevel,
  "combined_care"
);

// 지루성 두피염 / 원형탈모 / 급격한 진행 → D (expert_first)
assert.equal(
  scalpEscalationFor({ concern: "지루성 두피염" }).minimumLevel,
  "expert_first"
);
assert.equal(
  scalpEscalationFor({ concern: "원형탈모" }).minimumLevel,
  "expert_first"
);
assert.equal(
  scalpEscalationFor({ concern: "탈모", worsening: true }).minimumLevel,
  "expert_first"
);

// --- 추천 결과 반영 --------------------------------------------------------

// 위험 신호 없는 일반 탈모: A → C 로 올라가되 성분 추천은 유지된다
const mild = applySymptomSafetyToRecommendation(
  baseRecommendation,
  req([{ concern: "정수리 탈모", severity: "mild" }])
);
assert.equal(mild.managementLevel, "combined_care");
assert.ok(
  mild.recommendedIngredients.length > 0,
  "C 단계는 화장품 관리와 상담 병행이므로 성분 추천을 비우지 않는다"
);
assert.ok(
  mild.precautions.some((p) => p.includes("증상 완화 기능성")),
  "탈모 제품을 치료로 표시하지 않는다는 고지가 포함되어야 한다"
);
assert.ok(
  !mild.precautions.some((p) => p.includes("탈모 치료")),
  "'탈모 치료' 표현을 쓰지 않는다"
);

// 지루성 두피염: D 로 상향
const seborrheic = applySymptomSafetyToRecommendation(
  baseRecommendation,
  req([{ concern: "지루성 두피염", severity: "mild" }])
);
assert.equal(seborrheic.managementLevel, "expert_first");

// 두피 + 위험 신호(통증): 기존 red flag 경로가 유지되어 D 이상
const withPain = applySymptomSafetyToRecommendation(
  baseRecommendation,
  req([{ concern: "두피 통증", severity: "severe", redFlags: ["pain"] }])
);
assert.ok(
  ["expert_first", "urgent_check"].includes(withPain.managementLevel as string),
  "두피 통증은 기존 위험 신호 경로로 D/E 를 유지해야 한다"
);
assert.equal(withPain.recommendedIngredients.length, 0);

// 얼굴 고민은 영향을 받지 않는다 (회귀 방지)
const faceOnly = applySymptomSafetyToRecommendation(
  baseRecommendation,
  req([{ concern: "가벼운 건조함", severity: "mild" }])
);
assert.equal(
  faceOnly.managementLevel,
  "cosmetic_care",
  "두피 규칙이 얼굴 판정을 바꾸면 안 된다"
);

// 이미 더 높은 단계면 낮추지 않는다
const alreadyUrgent = applySymptomSafetyToRecommendation(
  { ...baseRecommendation, managementLevel: "urgent_check" } as Recommendation,
  req([{ concern: "탈모", severity: "mild" }])
);
assert.equal(alreadyUrgent.managementLevel, "urgent_check");

console.log("scalp hair safety selftest: ok");
