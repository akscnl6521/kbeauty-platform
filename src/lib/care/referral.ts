// Dermatology referral rules — guidance only, never a diagnosis.

import type {
  CareCheckInAnswers,
  CareReferralLevel,
} from "@/lib/care/types";

export type ReferralEvaluation = {
  level: CareReferralLevel;
  reasons: string[];
  userMessage: string;
  emergencyHint: boolean;
};

const REFERRAL_RANK: Record<CareReferralLevel, number> = {
  none: 0,
  consider_soon: 1,
  seek_promptly: 2,
  seek_emergency_care: 3,
};

function raiseLevel(
  current: CareReferralLevel,
  next: CareReferralLevel
): CareReferralLevel {
  return REFERRAL_RANK[next] > REFERRAL_RANK[current] ? next : current;
}

export function evaluateDermatologyReferral(
  answers: CareCheckInAnswers,
  options?: { daysSinceStart?: number; worsening?: boolean }
): ReferralEvaluation {
  const reasons: string[] = [];
  let level: CareReferralLevel = "none";
  let emergencyHint = false;
  const high = (n: number | null, t = 8) => n != null && n >= t;
  const acute = answers.acuteSignals ?? {};

  if (acute.breathingDifficulty || acute.systemicAllergy) {
    reasons.push(
      acute.breathingDifficulty ? "호흡 곤란 보고" : "전신 알레르기 반응 보고"
    );
    level = raiseLevel(level, "seek_emergency_care");
    emergencyHint = true;
  }

  if (acute.rapidSwelling || high(answers.swelling, 8)) {
    reasons.push("심하거나 급격한 붓기 보고");
    level = raiseLevel(level, "seek_emergency_care");
    emergencyHint = true;
  }

  if (acute.eyeIrritation) {
    reasons.push("눈 내부 자극 보고");
    level = raiseLevel(level, "seek_promptly");
  }
  if (acute.infectionSuspect || acute.burn) {
    reasons.push(
      acute.burn ? "화상 가능성 보고" : "감염 의심 신호 보고"
    );
    level = raiseLevel(level, "seek_promptly");
  }
  if (acute.bleeding || acute.oozing || acute.pain || acute.spreadingRash) {
    reasons.push("통증·출혈·진물·퍼지는 발진 중 하나 이상 보고");
    level = raiseLevel(level, "seek_promptly");
  }

  if (high(answers.sting, 8) || high(answers.itch, 8)) {
    reasons.push("강한 따가움/가려움 지속 가능");
    level = raiseLevel(level, "seek_promptly");
  }
  if (high(answers.redness, 8) && high(answers.breakouts, 7)) {
    reasons.push("붉음과 트러블이 함께 높게 보고됨");
    level = raiseLevel(level, "seek_promptly");
  }
  if (answers.stillUsing === false && high(answers.redness, 7)) {
    reasons.push("제품 중단 후에도 붉음이 높게 보고됨");
    level = raiseLevel(level, "seek_promptly");
  }

  const days = options?.daysSinceStart ?? 0;
  if (options?.worsening && days >= 14) {
    reasons.push("2주 이상 관찰 중에도 악화 신호");
    level = raiseLevel(level, "consider_soon");
  }
  if (days >= 28 && (answers.satisfaction ?? 10) <= 3) {
    reasons.push("4주 전후에도 만족도가 낮음");
    level = raiseLevel(level, "consider_soon");
  }

  const userMessage =
    level === "seek_emergency_care"
      ? "호흡 곤란, 전신 알레르기 반응 또는 급격한 붓기가 있으면 지체하지 말고 가까운 의료기관·응급서비스에 문의하세요. 이 안내는 진단이 아닙니다."
      : level === "seek_promptly"
        ? "제품 사용을 우선하기보다 피부과 등 전문가 확인을 권장합니다. 이 안내는 진단이 아닙니다."
        : level === "consider_soon"
          ? "경과가 기대와 다르면 피부과 등 전문가 상담을 고려해 보세요."
          : "현재 자기보고만으로는 추가 상담 신호가 뚜렷하지 않습니다.";

  return { level, reasons, userMessage, emergencyHint };
}