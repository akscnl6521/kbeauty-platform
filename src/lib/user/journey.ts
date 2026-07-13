import type { UserJourney, UserJourneyInput } from "./journey-types";

/**
 * Shared customer journey resolver for home / results / my.
 * Priority: referral → due check-in → email → onboarding → routine/sync → care → analysis → start.
 * Uses already-evaluated referralLevel only — never diagnoses.
 */
export function resolveUserJourney(input: UserJourneyInput): UserJourney {
  if (
    input.referralLevel === "seek_emergency_care" ||
    input.referralLevel === "seek_promptly" ||
    input.referralLevel === "consider_soon"
  ) {
    return {
      state: "referral_attention",
      primaryAction: "view_referral",
      label: "전문가 상담 안내 확인하기",
    };
  }

  if (input.hasDueCheckIn) {
    return {
      state: "checkin_due",
      primaryAction: "complete_checkin",
      label: "오늘 체크인 하기",
    };
  }

  if (input.authenticated && input.emailConfirmed === false) {
    return {
      state: "signed_up_unconfirmed",
      primaryAction: "confirm_email",
      label: "이메일 인증 확인하기",
    };
  }

  if (input.authenticated && input.onboardingPartial && !input.onboardingComplete) {
    return {
      state: "authenticated_onboarding_partial",
      primaryAction: "continue_onboarding",
      label: "온보딩 이어서 하기",
    };
  }

  if (input.authenticated && !input.onboardingComplete) {
    return {
      state: "authenticated_no_onboarding",
      primaryAction: "continue_onboarding",
      label: "내 피부 관리 설정하기",
    };
  }

  if (input.authenticated && input.onboardingComplete && !input.hasRoutine) {
    if (input.syncError) {
      return {
        state: "sync_error",
        primaryAction: "retry_sync",
        label: "서버 동기화 다시 시도",
      };
    }
    return {
      state: "authenticated_no_routine",
      primaryAction: "save_routine",
      label: "내 루틴 초안 만들기",
    };
  }

  if (input.authenticated && input.hasRoutine) {
    return {
      state: "care_active",
      primaryAction: "view_today_routine",
      label: "오늘의 루틴 보기",
    };
  }

  if (!input.authenticated && input.hasLocalAnalysis) {
    return {
      state: "anonymous_analyzed",
      primaryAction: "continue_analysis",
      label: "이전 분석 이어보기",
    };
  }

  if (!input.authenticated) {
    return {
      state: "anonymous_new",
      primaryAction: "start_analysis",
      label: "피부 분석 시작하기",
    };
  }

  return {
    state: "care_active",
    primaryAction: "view_my",
    label: "내 피부 관리 보기",
  };
}
