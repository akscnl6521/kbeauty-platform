import type { Recommendation } from "@/lib/recommend";
import type { AnalyzeSkinRequest, ConcernObservation, RedFlag } from "./types";

const URGENT_RED_FLAGS = new Set<RedFlag>([
  "breathing_difficulty",
  "systemic_allergy",
  "rapid_swelling",
  "sudden_mole_change",
  "eye_irritation",
]);

const EXPERT_RED_FLAGS = new Set<RedFlag>([
  "pain",
  "bleeding",
  "oozing",
  "spreading_rash",
  "suspected_infection",
  "burn",
  "ear_internal_symptom",
]);

const RED_FLAG_LABELS: Record<RedFlag, string> = {
  pain: "통증",
  bleeding: "출혈",
  oozing: "진물",
  rapid_swelling: "급격한 부기",
  spreading_rash: "넓게 퍼지는 발진",
  suspected_infection: "감염 의심",
  burn: "화상",
  sudden_mole_change: "갑작스러운 점 변화",
  eye_irritation: "눈 내부 자극",
  ear_internal_symptom: "귀 내부 증상",
  breathing_difficulty: "호흡 곤란",
  systemic_allergy: "전신 알레르기 반응",
};

function observations(input: AnalyzeSkinRequest): ConcernObservation[] {
  return Array.isArray(input.concernObservations)
    ? input.concernObservations
    : [];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function appendUnique(base: string[] | undefined, values: string[]): string[] {
  return unique([...(base ?? []), ...values].filter(Boolean));
}

/**
 * 사용자 자가 보고 위험 신호를 추천 결과에 반영한다.
 * 진단을 수행하지 않으며, 위험 신호가 있으면 상업적 제품 노출보다
 * 의료기관 확인 안내를 우선하도록 managementLevel을 상향한다.
 */
export function applySymptomSafetyToRecommendation(
  recommendation: Recommendation,
  input: AnalyzeSkinRequest
): Recommendation {
  const rows = observations(input);
  if (rows.length === 0) return recommendation;

  const redFlags = unique(rows.flatMap((row) => row.redFlags ?? []));
  const hasUrgentFlag = redFlags.some((flag) => URGENT_RED_FLAGS.has(flag));
  const hasExpertFlag = redFlags.some((flag) => EXPERT_RED_FLAGS.has(flag));
  const hasSevereWorsening = rows.some(
    (row) => row.severity === "severe" && row.worsening === true
  );
  const hasSeverePersistent = rows.some(
    (row) =>
      row.severity === "severe" &&
      (row.duration === "under_3_months" || row.duration === "over_3_months")
  );

  if (!hasUrgentFlag && !hasExpertFlag && !hasSevereWorsening && !hasSeverePersistent) {
    return recommendation;
  }

  const flagReasons = redFlags.map(
    (flag) => `${RED_FLAG_LABELS[flag]} 증상이 사용자 입력에 포함됨`
  );

  if (hasUrgentFlag) {
    return {
      ...recommendation,
      managementLevel: "urgent_check",
      recommendedIngredients: [],
      manageableWithCosmetics: [],
      expertReferralReasons: appendUnique(recommendation.expertReferralReasons, [
        ...flagReasons,
        "화장품 추천보다 신속한 의료기관 확인이 우선입니다.",
      ]),
      precautions: appendUnique(recommendation.precautions, [
        "새 제품 사용과 구매를 우선하지 말고 의료기관 확인을 고려하세요.",
      ]),
      notRecommendedReasons: appendUnique(recommendation.notRecommendedReasons, [
        "현재 입력에는 화장품 추천을 제한해야 하는 위험 신호가 포함되어 있습니다.",
      ]),
    };
  }

  return {
    ...recommendation,
    managementLevel: "expert_first",
    recommendedIngredients: [],
    manageableWithCosmetics: [],
    expertReferralReasons: appendUnique(recommendation.expertReferralReasons, [
      ...flagReasons,
      ...(hasSevereWorsening
        ? ["심한 증상이 악화되고 있어 전문가 상담을 우선하는 것이 안전합니다."]
        : []),
      ...(hasSeverePersistent
        ? ["심한 증상이 지속되고 있어 전문가 상담을 우선하는 것이 안전합니다."]
        : []),
    ]),
    precautions: appendUnique(recommendation.precautions, [
      "자극 가능성이 있는 새 제품 도입을 미루고 현재 상태를 전문가와 확인하세요.",
    ]),
    notRecommendedReasons: appendUnique(recommendation.notRecommendedReasons, [
      "현재 상태에서는 제품 구매보다 전문가 확인이 우선입니다.",
    ]),
  };
}
