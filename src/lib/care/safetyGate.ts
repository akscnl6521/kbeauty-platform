/**
 * Explicit safety gate — rule-based, not hidden AI.
 * When urgent signals fire: prioritize guidance, do not push new product recommendations.
 */

import type {
  CareCheckInAnswers,
  CareEmergencyFlags,
  CareReferralLevel,
} from "@/lib/care/types";
import { evaluateDermatologyReferral } from "@/lib/care/referral";

export const EMERGENCY_FLAG_LABELS: Record<keyof CareEmergencyFlags, string> = {
  severeSwelling: "심한 붓기",
  breathingDifficulty: "호흡 곤란",
  severePain: "심한 통증",
  blisters: "수포",
  rapidWorsening: "급격한 악화",
  persistentBleeding: "지속적인 출혈",
  eyeAreaSevere: "눈 주변 심한 반응",
  immediateSevereReaction: "사용 직후 심한 반응",
};

export function collectActiveEmergencyFlags(
  flags: CareEmergencyFlags | null | undefined
): (keyof CareEmergencyFlags)[] {
  if (!flags) return [];
  return (Object.keys(EMERGENCY_FLAG_LABELS) as (keyof CareEmergencyFlags)[]).filter(
    (k) => flags[k] === true
  );
}

export type SafetyGateResult = {
  level: CareReferralLevel;
  urgent: boolean;
  suppressProductPush: boolean;
  suggestPauseProducts: boolean;
  reasons: string[];
  userMessage: string;
  /** Mild irritation only — not emergency */
  mildIrritation: boolean;
};

export function evaluateSafetyGate(answers: CareCheckInAnswers): SafetyGateResult {
  const flagKeys = collectActiveEmergencyFlags(answers.emergencyFlags);
  const referral = evaluateDermatologyReferral(answers, {
    daysSinceStart: 0,
    worsening: false,
  });

  const urgentFromFlags = flagKeys.length > 0;
  const urgent =
    urgentFromFlags ||
    referral.level === "seek_emergency_care" ||
    referral.level === "seek_promptly";

  const mildIrritation =
    !urgent &&
    ((answers.sting ?? 0) >= 4 ||
      (answers.redness ?? 0) >= 4 ||
      (answers.itch ?? 0) >= 4) &&
    (answers.swelling ?? 0) < 6;

  const reasons = [
    ...flagKeys.map((k) => EMERGENCY_FLAG_LABELS[k]),
    ...referral.reasons,
  ];

  let level = referral.level;
  if (urgentFromFlags) {
    level =
      flagKeys.includes("breathingDifficulty") ||
      flagKeys.includes("persistentBleeding") ||
      flagKeys.includes("immediateSevereReaction")
        ? "seek_emergency_care"
        : level === "none"
          ? "seek_promptly"
          : level;
  }

  const userMessage = urgent
    ? level === "seek_emergency_care"
      ? "보고하신 신호는 긴급할 수 있습니다. 제품 사용을 중단하고 가까운 의료기관·응급 도움을 받으세요. 이 안내는 진단이 아닙니다."
      : "강한 반응이 보고되었습니다. 새 제품 추가는 미루고, 사용 중단을 고려한 뒤 필요하면 전문가 상담을 받으세요. 진단이 아닙니다."
    : mildIrritation
      ? "가벼운 자극이 있을 수 있습니다. 사용량을 줄이거나 간격을 두고, 악화되면 중단하세요. 진단이 아닙니다."
      : referral.userMessage;

  return {
    level,
    urgent,
    suppressProductPush: urgent,
    suggestPauseProducts: urgent || mildIrritation,
    reasons,
    userMessage,
    mildIrritation,
  };
}
