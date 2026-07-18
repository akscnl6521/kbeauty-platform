/**
 * Dermatology referral rules — guidance only, never a diagnosis.
 */

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

/**
 * Evaluate self-reported symptoms. Does not diagnose disease.
 */
export function evaluateDermatologyReferral(
  answers: CareCheckInAnswers,
  options?: { daysSinceStart?: number; worsening?: boolean }
): ReferralEvaluation {
  const reasons: string[] = [];
  let level: CareReferralLevel = "none";
  let emergencyHint = false;

  const high = (n: number | null | undefined, t = 8) => n != null && n >= t;
  const flags = answers.emergencyFlags ?? {};

  if (flags.breathingDifficulty) {
    reasons.push("호흡 곤란 보고");
    level = raiseLevel(level, "seek_emergency_care");
    emergencyHint = true;
  }
  if (flags.persistentBleeding) {
    reasons.push("지속적인 출혈 보고");
    level = raiseLevel(level, "seek_emergency_care");
    emergencyHint = true;
  }
  if (flags.immediateSevereReaction) {
    reasons.push("사용 직후 심한 반응 보고");
    level = raiseLevel(level, "seek_emergency_care");
    emergencyHint = true;
  }
  if (flags.severeSwelling || high(answers.swelling, 8)) {
    reasons.push("심한 붓기 보고");
    level = raiseLevel(level, "seek_emergency_care");
    emergencyHint = true;
  }
  if (flags.blisters) {
    reasons.push("수포 보고");
    level = raiseLevel(level, "seek_promptly");
  }
  if (flags.severePain) {
    reasons.push("심한 통증 보고");
    level = raiseLevel(level, "seek_promptly");
  }
  if (flags.eyeAreaSevere) {
    reasons.push("눈 주변 심한 반응 보고");
    level = raiseLevel(level, "seek_promptly");
  }
  if (flags.rapidWorsening) {
    reasons.push("급격한 악화 보고");
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
  if (answers.adverseReaction === true) {
    reasons.push("이상 반응 자가 보고");
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
  if (days >= 28 && answers.wantReanalysis === true) {
    reasons.push("한 달 후 재분석 희망");
    level = raiseLevel(level, "consider_soon");
  }

  const userMessage =
    level === "seek_emergency_care"
      ? "증상이 심하거나 급격히 악화되면 가까운 의료기관·응급서비스에 문의하세요. 이 안내는 진단이 아닙니다."
      : level === "seek_promptly"
        ? "전문가 상담을 권장합니다. 화장품만으로 해결하기 어려운 신호일 수 있습니다. 진단은 하지 않습니다."
        : level === "consider_soon"
          ? "경과가 기대와 다르면 피부과 등 전문가 상담을 고려해 보세요."
          : "현재 자기보고만으로는 추가 상담 신호가 뚜렷하지 않습니다.";

  return { level, reasons, userMessage, emergencyHint };
}
