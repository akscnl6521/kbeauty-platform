import type {
  CareAnalysisSession,
  CareCheckIn,
  CareReferralLevel,
} from "./types";

const REFERRAL_PRIORITY: Record<CareReferralLevel, number> = {
  none: 0,
  consider_soon: 1,
  seek_promptly: 2,
  seek_emergency_care: 3,
};

export type CareDashboardSummary = {
  latestSession: CareAnalysisSession | null;
  nextCheckIn: CareCheckIn | null;
  referralLevel: CareReferralLevel;
};

export function summarizeCareDashboard(input: {
  sessions: CareAnalysisSession[];
  checkIns: CareCheckIn[];
}): CareDashboardSummary {
  const latestSession = [...input.sessions].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  )[0] ?? null;

  const nextCheckIn = [...input.checkIns]
    .filter((checkIn) => checkIn.status === "due" || checkIn.status === "scheduled")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "due" ? -1 : 1;
      return Date.parse(a.dueAt) - Date.parse(b.dueAt);
    })[0] ?? null;

  const referralLevel = input.checkIns.reduce<CareReferralLevel>((current, checkIn) => {
    return REFERRAL_PRIORITY[checkIn.referralLevel] > REFERRAL_PRIORITY[current]
      ? checkIn.referralLevel
      : current;
  }, "none");

  return { latestSession, nextCheckIn, referralLevel };
}

export function referralLabel(level: CareReferralLevel): string {
  switch (level) {
    case "seek_emergency_care":
      return "긴급 확인이 필요합니다";
    case "seek_promptly":
      return "빠른 전문가 확인이 권장됩니다";
    case "consider_soon":
      return "가까운 시일 내 상담을 고려하세요";
    default:
      return "현재 감지된 상담 우선 신호가 없습니다";
  }
}

export function referralTone(level: CareReferralLevel): "normal" | "warning" | "urgent" {
  if (level === "seek_emergency_care") return "urgent";
  if (level === "seek_promptly" || level === "consider_soon") return "warning";
  return "normal";
}

export function managementLevelLabel(session: CareAnalysisSession | null): string {
  const value = session?.recommendationSnapshot?.managementLevel;
  if (value === "urgent_check") return "긴급 확인 우선";
  if (value === "expert_first") return "전문가 상담 우선";
  if (value === "cosmetic_care") return "화장품 관리 가능 범위";
  return "관리 단계 확인 전";
}
