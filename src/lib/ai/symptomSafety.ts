import type { Recommendation } from "@/lib/recommend";
import {
  routeProfessionalGuidance,
  type SymptomArea,
} from "@/lib/care/professionalRouting";
import type { RednessObservation } from "./rednessObservation";
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

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function appendUnique(base: string[] | undefined, values: string[]): string[] {
  return unique([...(base ?? []), ...values].filter(Boolean));
}

function rednessFallbackObservation(
  redness: RednessObservation | null | undefined
): ConcernObservation | null {
  if (!redness) return null;

  const areas = (redness.areas ?? []).flatMap((area) => {
    switch (area) {
      case "cheeks":
        return ["cheek" as const];
      case "nose":
        return ["nose" as const];
      case "forehead":
        return ["forehead" as const];
      case "chin":
        return ["chin" as const];
      case "eye_area":
        return ["eye_area" as const];
      case "whole_face":
        return ["forehead" as const, "cheek" as const, "nose" as const, "chin" as const];
      default:
        return [];
    }
  });

  const symptoms = redness.symptoms ?? [];
  const hasSwelling = symptoms.includes("swelling");
  const hasBurning = symptoms.includes("burning");
  const hasStinging = symptoms.includes("stinging");
  const hasEyeArea = (redness.areas ?? []).includes("eye_area");

  const severity =
    hasSwelling || hasBurning
      ? "severe"
      : symptoms.some((symptom) => symptom !== "none")
        ? "moderate"
        : "mild";

  const duration = (() => {
    switch (redness.duration) {
      case "persistent":
        return "over_3_months" as const;
      case "recurrent":
        return "under_3_months" as const;
      case "over_one_day":
        return "under_2_weeks" as const;
      case "under_one_hour":
      case "several_hours":
        return "under_3_days" as const;
      default:
        return "unknown" as const;
    }
  })();

  const redFlags: RedFlag[] = [];
  if (hasEyeArea && (hasStinging || hasBurning || hasSwelling)) {
    redFlags.push("eye_irritation");
  }

  return {
    concern: "붉은기",
    ...(areas.length > 0 ? { areas: unique(areas) } : {}),
    severity,
    duration,
    worsening: false,
    ...(redFlags.length > 0 ? { redFlags } : {}),
  };
}

function observations(input: AnalyzeSkinRequest): ConcernObservation[] {
  if (Array.isArray(input.concernObservations) && input.concernObservations.length > 0) {
    return input.concernObservations;
  }

  const fallback = rednessFallbackObservation(input.rednessObservation);
  return fallback ? [fallback] : [];
}

function mapConcernToSymptomArea(concern: string): SymptomArea | null {
  const c = concern.toLowerCase();
  if (/여드름|acne|트러블|breakout/.test(c)) return "acne";
  if (/붉은|홍조|redness|혈관|flush/.test(c)) return "redness_vascular";
  if (/민감|sensitive|자극/.test(c)) return "sensitivity";
  if (/색소|기미|잡티|pigment|melasma|dark.?spot/.test(c)) return "pigmentation";
  if (/흉터|scar/.test(c)) return "scarring";
  if (/알레르기|allergy|알러지/.test(c)) return "allergy";
  if (/탈모|두피|hair.?loss|scalp|비듬/.test(c)) return "hair_loss_scalp_inflammation";
  if (/손톱|nail/.test(c)) return "nail_change";
  if (/치아|구강|oral|smile|whitening/.test(c)) return "oral_smile";
  return null;
}

function buildProfessionalRoutes(
  rows: ConcernObservation[],
  redFlags: RedFlag[],
  hasSevereWorsening: boolean,
  hasSeverePersistent: boolean
) {
  const areas = unique(
    rows
      .map((row) => mapConcernToSymptomArea(row.concern))
      .filter((area): area is SymptomArea => area != null)
  );
  if (areas.length === 0 && redFlags.length > 0) {
    areas.push(
      redFlags.includes("systemic_allergy") || redFlags.includes("breathing_difficulty")
        ? "allergy"
        : "sudden_change"
    );
  }
  if (areas.length === 0 && (hasSevereWorsening || hasSeverePersistent)) {
    areas.push("prolonged_non_improvement");
  }

  return routeProfessionalGuidance({
    areas,
    pain: redFlags.includes("pain"),
    bleeding: redFlags.includes("bleeding"),
    discharge: redFlags.includes("oozing"),
    severeInflammation: hasSevereWorsening || hasSeverePersistent,
    spreadingRash: redFlags.includes("spreading_rash"),
    breathingDifficulty: redFlags.includes("breathing_difficulty"),
    suspectedInfection: redFlags.includes("suspected_infection"),
    suddenWorsening: hasSevereWorsening || redFlags.includes("rapid_swelling"),
  });
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
  const professionalRoutes = buildProfessionalRoutes(
    rows,
    redFlags,
    hasSevereWorsening,
    hasSeverePersistent
  );
  const routeReasons = professionalRoutes.map(
    (route) =>
      `${route.professionalType} · ${route.urgency} · ${route.reason}`
  );

  if (hasUrgentFlag) {
    return {
      ...recommendation,
      managementLevel: "urgent_check",
      recommendedIngredients: [],
      manageableWithCosmetics: [],
      professionalRoutes,
      expertReferralReasons: appendUnique(recommendation.expertReferralReasons, [
        ...flagReasons,
        ...routeReasons,
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
    professionalRoutes,
    expertReferralReasons: appendUnique(recommendation.expertReferralReasons, [
      ...flagReasons,
      ...routeReasons,
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
