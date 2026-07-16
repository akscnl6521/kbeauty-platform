/**
 * 붉은기 관찰 상태 파싱·프롬프트·상담 우선 selftest (진단 아님, 랭킹 무관).
 */
import { buildBasicInfoUserText } from "./prompt";
import {
  applyRednessObservationToRecommendation,
  formatRednessObservationForPrompt,
  isRednessCounselingPriority,
  parseRednessObservation,
} from "./rednessObservation";
import type { AnalyzeSkinRequest } from "./types";
import type { Recommendation } from "@/lib/recommend/types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`[redness-selftest] ${msg}`);
}

export function runRednessObservationSelftests(): {
  ok: true;
  checks: number;
} {
  let checks = 0;

  assert(parseRednessObservation(null) === null, "null → null");
  assert(parseRednessObservation({}) === null, "empty → null");
  assert(
    parseRednessObservation({ trigger: "not_a_trigger" }) === null,
    "invalid trigger ignored"
  );

  const parsed = parseRednessObservation({
    trigger: "sun_exposure",
    symptoms: ["burning", "none", "itching"],
    duration: "several_hours",
    areas: ["cheeks", "cheeks", "nose"],
  });
  assert(parsed != null, "valid observation");
  assert(parsed!.trigger === "sun_exposure", "trigger");
  assert(
    parsed!.symptoms?.length === 1 && parsed!.symptoms[0] === "none",
    "none exclusivity"
  );
  assert(parsed!.duration === "several_hours", "duration");
  assert(parsed!.areas?.join(",") === "cheeks,nose", "areas unique");
  checks += 1;

  const whole = parseRednessObservation({
    areas: ["cheeks", "whole_face", "nose"],
  });
  assert(
    whole?.areas?.length === 1 && whole.areas[0] === "whole_face",
    "whole_face exclusivity in parse"
  );
  checks += 1;

  const promptBlock = formatRednessObservationForPrompt(parsed);
  assert(promptBlock != null, "prompt block");
  assert(promptBlock!.includes("sun_exposure"), "code in prompt");
  assert(promptBlock!.includes("햇빛"), "ko label in prompt");
  assert(!/rosacea|주사비|아토피|eczema/i.test(promptBlock!), "no disease names");
  assert(promptBlock!.includes("Do NOT name or diagnose"), "forbid diagnose");
  checks += 1;

  const without: AnalyzeSkinRequest = {
    mode: "manual",
    skinTone: "중간",
    undertone: "중립",
    concerns: ["붉은기"],
    sensitivity: "보통",
  };
  const textWithout = buildBasicInfoUserText(without);
  assert(textWithout.includes("concerns: 붉은기"), "concern kept");
  assert(!textWithout.includes("redness_trigger"), "no forced observation");
  checks += 1;

  const withObs: AnalyzeSkinRequest = {
    ...without,
    rednessObservation: {
      trigger: "after_cosmetic",
      symptoms: ["stinging"],
      duration: "under_one_hour",
      areas: ["cheeks"],
    },
  };
  const textWith = buildBasicInfoUserText(withObs);
  assert(textWith.includes("after_cosmetic"), "observation in user text");
  assert(textWith.includes("Do NOT name or diagnose"), "non-diagnostic rule");
  assert(!/rosacea/i.test(textWith), "no rosacea");
  checks += 1;

  const dryness: AnalyzeSkinRequest = {
    mode: "manual",
    skinTone: "밝은",
    undertone: "쿨톤",
    concerns: ["건조함"],
    sensitivity: "보통",
  };
  assert(
    buildBasicInfoUserText(dryness).includes("건조함"),
    "non-redness flow"
  );
  checks += 1;

  // 상담 우선 분기
  assert(
    isRednessCounselingPriority({
      duration: "persistent",
      symptoms: ["burning"],
    }) === true,
    "counsel priority true"
  );
  assert(
    isRednessCounselingPriority({
      trigger: "sun_exposure",
      symptoms: ["dryness_tightness"],
      duration: "under_one_hour",
    }) === false,
    "counsel priority false for mild"
  );

  const baseRec: Recommendation = {
    skinConcerns: ["붉은기"],
    recommendedIngredients: ["판테놀"],
    ingredientsToAvoid: [],
    confidenceScore: 0.8,
    managementLevel: "cosmetic_care",
    expertReferralReasons: [],
    notRecommendedReasons: [],
    summaryKo: "일반 안내",
  };
  const mild = applyRednessObservationToRecommendation(baseRec, {
    trigger: "sun_exposure",
    duration: "under_one_hour",
    areas: ["cheeks"],
  });
  assert(mild.managementLevel === "cosmetic_care", "mild keeps level");
  assert(mild.rednessObservation?.trigger === "sun_exposure", "stored obs");
  assert(
    (mild.expertReferralReasons?.length ?? 0) === 0,
    "mild no expert push"
  );

  const risky = applyRednessObservationToRecommendation(baseRec, {
    duration: "recurrent",
    symptoms: ["visible_capillaries", "swelling"],
  });
  assert(risky.managementLevel === "expert_first", "elevated level");
  assert(
    (risky.expertReferralReasons?.length ?? 0) > 0,
    "expert reasons filled"
  );
  assert(
    (risky.notRecommendedReasons?.length ?? 0) > 0,
    "purchase deprioritized"
  );
  assert(
    risky.summaryKo?.includes("원인을 진단한 결과는 아닙니다") === true,
    "non-diagnosis in summary"
  );
  assert(!/rosacea|주사비|완치|치료합니다/i.test(risky.summaryKo ?? ""), "safe wording");
  // 성분·점수 불변
  assert(
    risky.recommendedIngredients.join(",") ===
      baseRec.recommendedIngredients.join(","),
    "ingredients unchanged"
  );
  assert(risky.confidenceScore === baseRec.confidenceScore, "score unchanged");
  checks += 1;

  return { ok: true, checks };
}
