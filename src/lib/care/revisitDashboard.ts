/**
 * Revisit dashboard pure view-model (client + server safe).
 */

import {
  managementLevelLabel,
  referralLabel,
  referralTone,
  summarizeCareDashboard,
} from "@/lib/care/dashboardSummary";
import { hasWorseningSignal } from "@/lib/care/progress";
import type {
  CareAnalysisSession,
  CareCheckIn,
  CareCheckInOverallResponse,
  CareProgressDelta,
  CareReferralLevel,
  CareRoutine,
} from "@/lib/care/types";

export type RevisitUiState =
  | "logged_out"
  | "no_analysis"
  | "analysis_only"
  | "routine_active"
  | "checkin_scheduled"
  | "checkin_overdue"
  | "worsening"
  | "photo_no_consent"
  | "photo_feature_pending"
  | "partial_data"
  | "api_error"
  | "on_track";

export type RevisitNextActionKind =
  | "seek_care_guidance"
  | "complete_checkin"
  | "create_routine"
  | "reanalyze"
  | "record_progress"
  | "maintain_routine"
  | "start_analysis"
  | "retry_sync";

export type { QuickSkinCheckChoice } from "@/lib/care/quickSkinCheck";

export type CareProgressState = {
  hasWorsening: boolean;
  lastOutcome: CareCheckInOverallResponse | null;
  completedCount: number;
  scheduledCount: number;
  overdueCount: number;
};

export type RevisitPhotoStatus = {
  kind: "pending_migration" | "no_consent" | "saved_enabled" | "unknown";
  label: string;
};

export type RevisitNextCheckIn = {
  id: string;
  day: number;
  dueAt: string;
  status: CareCheckIn["status"];
  label: string;
};

export type RevisitNextAction = {
  kind: RevisitNextActionKind;
  label: string;
  href: string;
  priorityReason: string;
};

export type RevisitDashboardSummary = {
  uiState: RevisitUiState;
  lastAnalysisAt: string | null;
  lastAnalysisLabel: string;
  primaryConcerns: string[];
  focusAreas: string[];
  activeRoutineTitle: string | null;
  activeItemCount: number;
  nextCheckIn: RevisitNextCheckIn | null;
  latestCheckInAnswerSummary: string | null;
  photoStatus: RevisitPhotoStatus;
  referral: {
    level: CareReferralLevel;
    label: string;
    tone: ReturnType<typeof referralTone>;
  };
  managementLabel: string;
  nextAction: RevisitNextAction;
  quickCheckVisible: boolean;
  sectionsOrder: string[];
  progress: CareProgressState;
};

export type RevisitDashboardInput = {
  authenticated?: boolean;
  sessions: CareAnalysisSession[];
  checkIns: CareCheckIn[];
  activeRoutine: CareRoutine | null;
  progressDeltas?: CareProgressDelta[];
  syncError?: boolean;
  apiError?: boolean;
  photoConsent?: {
    saveForComparison: boolean;
    migrationPending: boolean;
    loaded?: boolean;
  };
  nowIso?: string;
};

const MS_PER_DAY = 24 * 3600_000;
const REANALYSIS_AFTER_DAYS = 30;

const REFERRAL_PRIORITY: Record<CareReferralLevel, number> = {
  none: 0,
  consider_soon: 1,
  seek_promptly: 2,
  seek_emergency_care: 3,
};

function stringList(value: unknown, max = 3): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].slice(
    0,
    max
  );
}

function latestCompletedCheckIn(checkIns: CareCheckIn[]): CareCheckIn | null {
  return (
    [...checkIns]
      .filter((c) => c.status === "completed" && c.answers)
      .sort(
        (a, b) =>
          Date.parse(b.completedAt ?? b.dueAt) - Date.parse(a.completedAt ?? a.dueAt)
      )[0] ?? null
  );
}

function summarizeOverallResponse(
  value: CareCheckInOverallResponse | null | undefined
): string | null {
  switch (value) {
    case "improved":
      return "전반적으로 나아짐";
    case "unchanged":
      return "큰 변화 없음";
    case "worsened":
      return "악화됨";
    case "unsure":
      return "변화 불확실";
    case "not_started":
      return "아직 시작 전";
    case "stopped":
      return "사용 중단";
    default:
      return null;
  }
}

function checkInStatusLabel(status: CareCheckIn["status"]): string {
  switch (status) {
    case "due":
      return "지금 작성 가능";
    case "scheduled":
      return "예약됨";
    case "completed":
      return "완료";
    case "expired":
      return "기한 지남";
    case "skipped":
      return "건너뜀";
    case "cancelled":
      return "취소됨";
    default:
      return status;
  }
}

function needsReferralGuidance(level: CareReferralLevel): boolean {
  return REFERRAL_PRIORITY[level] >= REFERRAL_PRIORITY.consider_soon;
}

function analysisAgeDays(
  session: CareAnalysisSession | null,
  nowIso: string
): number | null {
  if (!session) return null;
  const ms = Date.parse(nowIso) - Date.parse(session.createdAt);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / MS_PER_DAY);
}

function resolvePhotoStatus(
  photoConsent: RevisitDashboardInput["photoConsent"]
): RevisitPhotoStatus {
  if (!photoConsent || photoConsent.loaded === false) {
    return { kind: "unknown", label: "사진 저장 설정 확인 전" };
  }
  if (photoConsent.migrationPending) {
    return { kind: "pending_migration", label: "사진 저장 기능 준비 중" };
  }
  if (photoConsent.saveForComparison) {
    return { kind: "saved_enabled", label: "비교용 사진 저장 동의됨" };
  }
  return { kind: "no_consent", label: "비교용 사진 저장 미동의" };
}

function extractFocusAreas(session: CareAnalysisSession | null): string[] {
  const snap = session?.recommendationSnapshot;
  if (!snap || typeof snap !== "object") return [];
  return stringList(
    (snap as Record<string, unknown>).focusAreas ??
      (snap as Record<string, unknown>).focus_areas,
    3
  );
}

function extractPrimaryConcerns(session: CareAnalysisSession | null): string[] {
  if (!session) return [];
  const snap = session.recommendationSnapshot;
  const fromSnap =
    snap && typeof snap === "object"
      ? stringList((snap as Record<string, unknown>).skinConcerns, 3)
      : [];
  if (fromSnap.length > 0) return fromSnap;
  return stringList(session.concerns, 3);
}

function routineTitle(routine: CareRoutine | null): string | null {
  if (!routine) return null;
  return routine.version > 1 ? `루틴 v${routine.version}` : "진행 중인 루틴";
}

export function getCareProgressState(input: {
  checkIns: CareCheckIn[];
  progressDeltas?: CareProgressDelta[];
}): CareProgressState {
  const completed = input.checkIns.filter((c) => c.status === "completed");
  const scheduled = input.checkIns.filter((c) => c.status === "scheduled");
  const overdue = input.checkIns.filter(
    (c) => c.status === "due" || c.status === "expired"
  );
  const latest = latestCompletedCheckIn(input.checkIns);
  const deltas = input.progressDeltas ?? [];
  const hasWorsening =
    hasWorseningSignal(deltas) ||
    latest?.answers?.overallResponse === "worsened" ||
    input.checkIns.some(
      (c) =>
        c.referralLevel === "seek_promptly" ||
        c.referralLevel === "seek_emergency_care"
    );

  return {
    hasWorsening,
    lastOutcome: latest?.answers?.overallResponse ?? null,
    completedCount: completed.length,
    scheduledCount: scheduled.length,
    overdueCount: overdue.length,
  };
}

export function getNextRecommendedAction(input: RevisitDashboardInput): RevisitNextAction {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const dashboard = summarizeCareDashboard({
    sessions: input.sessions,
    checkIns: input.checkIns,
  });
  const progress = getCareProgressState({
    checkIns: input.checkIns,
    progressDeltas: input.progressDeltas,
  });
  const latest = dashboard.latestSession;
  const dueCheckIn = dashboard.nextCheckIn;
  const referralLevel = dashboard.referralLevel;
  const photo = input.photoConsent;

  if (input.apiError) {
    return {
      kind: "retry_sync",
      label: "동기화 다시 시도",
      href: "/my",
      priorityReason: "데이터를 불러오지 못했습니다",
    };
  }

  if (input.syncError) {
    return {
      kind: "retry_sync",
      label: "서버 동기화 다시 시도",
      href: "/my",
      priorityReason: "서버와 동기화에 실패했습니다",
    };
  }

  if (needsReferralGuidance(referralLevel) || progress.hasWorsening) {
    return {
      kind: "seek_care_guidance",
      label: "상담·가이드 확인하기",
      href: "/my/guidance",
      priorityReason: progress.hasWorsening
        ? "악화 신호 또는 체크인 기록이 확인되었습니다"
        : "상담 우선 신호가 감지되었습니다",
    };
  }

  if (
    dueCheckIn &&
    (dueCheckIn.status === "due" || dueCheckIn.status === "expired")
  ) {
    return {
      kind: "complete_checkin",
      label:
        dueCheckIn.status === "expired" ? "지난 체크인 작성하기" : "체크인 작성하기",
      href: `/my/check-ins/${dueCheckIn.id}`,
      priorityReason:
        dueCheckIn.status === "expired"
          ? "예정된 체크인 기한이 지났습니다"
          : "작성 가능한 체크인이 있습니다",
    };
  }

  if (latest && !input.activeRoutine) {
    return {
      kind: "create_routine",
      label: "루틴 만들기",
      href: "/my/routine/new",
      priorityReason: "분석은 있지만 활성 루틴이 없습니다",
    };
  }

  const ageDays = analysisAgeDays(latest, nowIso);
  if (latest && ageDays != null && ageDays >= REANALYSIS_AFTER_DAYS) {
    return {
      kind: "reanalyze",
      label: "피부 분석 다시하기",
      href: "/analyze",
      priorityReason: "마지막 분석이 30일 이상 지났습니다",
    };
  }

  if (photo?.saveForComparison && !photo.migrationPending) {
    return {
      kind: "record_progress",
      label: "변화 기록하기",
      href: "/my/progress",
      priorityReason: "비교용 사진 저장에 동의하셨습니다",
    };
  }

  if (input.activeRoutine) {
    return {
      kind: "maintain_routine",
      label: "오늘 루틴 확인하기",
      href: "/my/routine",
      priorityReason: "활성 루틴을 유지 중입니다",
    };
  }

  if (latest) {
    return {
      kind: "maintain_routine",
      label: "케어 기록 보기",
      href: "/my/analyses",
      priorityReason: "분석 기록이 있습니다",
    };
  }

  return {
    kind: "start_analysis",
    label: "피부 분석 시작하기",
    href: "/analyze",
    priorityReason: "저장된 분석이 없습니다",
  };
}

function resolveUiState(
  input: RevisitDashboardInput,
  progress: CareProgressState
): RevisitUiState {
  const authenticated = input.authenticated ?? true;
  const hasAnalysis = input.sessions.length > 0;
  const photo = input.photoConsent;
  const dashboard = summarizeCareDashboard(input);

  if (input.apiError) return "api_error";
  if (!authenticated && !hasAnalysis) return "logged_out";
  if (input.syncError && !hasAnalysis) return "api_error";
  if (!hasAnalysis) return "no_analysis";

  if (needsReferralGuidance(dashboard.referralLevel) || progress.hasWorsening) {
    return "worsening";
  }

  if (progress.overdueCount > 0) return "checkin_overdue";

  if (progress.scheduledCount > 0 && progress.overdueCount === 0) {
    return "checkin_scheduled";
  }

  if (photo?.migrationPending) return "photo_feature_pending";

  const latest = dashboard.latestSession;
  if (latest && extractPrimaryConcerns(latest).length === 0) {
    return "partial_data";
  }

  if (
    photo?.loaded !== false &&
    photo &&
    !photo.migrationPending &&
    !photo.saveForComparison &&
    (input.activeRoutine || progress.completedCount > 0)
  ) {
    return "photo_no_consent";
  }

  if (input.activeRoutine) return "routine_active";
  if (hasAnalysis && !input.activeRoutine && input.checkIns.length === 0) {
    return "analysis_only";
  }

  return "on_track";
}

function buildSectionsOrder(
  uiState: RevisitUiState,
  referralLevel: CareReferralLevel
): string[] {
  const base = [
    "next_action",
    "status",
    "quick_check",
    "next_checkin",
    "routine",
    "concerns",
    "photo",
    "consultation",
    "stats",
  ];
  if (uiState === "worsening" || needsReferralGuidance(referralLevel)) {
    return [
      "next_action",
      "consultation",
      "status",
      "quick_check",
      "next_checkin",
      "routine",
      "concerns",
      "photo",
      "stats",
    ];
  }
  if (uiState === "photo_feature_pending" || uiState === "photo_no_consent") {
    return [
      "next_action",
      "photo",
      "status",
      "quick_check",
      "next_checkin",
      "routine",
      "concerns",
      "consultation",
      "stats",
    ];
  }
  return base;
}

export function getRevisitDashboardSummary(
  input: RevisitDashboardInput
): RevisitDashboardSummary {
  const dashboard = summarizeCareDashboard({
    sessions: input.sessions,
    checkIns: input.checkIns,
  });
  const progress = getCareProgressState({
    checkIns: input.checkIns,
    progressDeltas: input.progressDeltas,
  });
  const latest = dashboard.latestSession;
  const nextCheckInRaw = dashboard.nextCheckIn;
  const referralLevel = dashboard.referralLevel;
  const photoStatus = resolvePhotoStatus(input.photoConsent);
  const uiState = resolveUiState(input, progress);
  const activeItemCount =
    input.activeRoutine?.items.filter((item) => item.active).length ?? 0;
  const latestCompleted = latestCompletedCheckIn(input.checkIns);

  const nextCheckIn: RevisitNextCheckIn | null = nextCheckInRaw
    ? {
        id: nextCheckInRaw.id,
        day: nextCheckInRaw.day,
        dueAt: nextCheckInRaw.dueAt,
        status: nextCheckInRaw.status,
        label: checkInStatusLabel(nextCheckInRaw.status),
      }
    : null;

  return {
    uiState,
    lastAnalysisAt: latest?.createdAt ?? null,
    lastAnalysisLabel: latest ? managementLevelLabel(latest) : "분석 없음",
    primaryConcerns: extractPrimaryConcerns(latest),
    focusAreas: extractFocusAreas(latest),
    activeRoutineTitle: routineTitle(input.activeRoutine),
    activeItemCount,
    nextCheckIn,
    latestCheckInAnswerSummary: summarizeOverallResponse(
      latestCompleted?.answers?.overallResponse
    ),
    photoStatus,
    referral: {
      level: referralLevel,
      label: referralLabel(referralLevel),
      tone: referralTone(referralLevel),
    },
    managementLabel: managementLevelLabel(latest),
    nextAction: getNextRecommendedAction(input),
    quickCheckVisible: Boolean(input.activeRoutine || input.checkIns.length > 0),
    sectionsOrder: buildSectionsOrder(uiState, referralLevel),
    progress,
  };
}

export function createApiErrorRevisitSummary(): RevisitDashboardSummary {
  return getRevisitDashboardSummary({
    authenticated: false,
    sessions: [],
    checkIns: [],
    activeRoutine: null,
    apiError: true,
  });
}
