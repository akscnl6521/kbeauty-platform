export type ReferralLevel =
  | "none"
  | "consider_soon"
  | "seek_promptly"
  | "seek_emergency_care";

export type UserJourneyInput = {
  authenticated: boolean;
  emailConfirmed?: boolean;
  hasLocalAnalysis: boolean;
  hasLocalCare: boolean;
  onboardingComplete: boolean;
  onboardingPartial?: boolean;
  hasRoutine: boolean;
  hasDueCheckIn: boolean;
  referralLevel: ReferralLevel;
  syncError: boolean;
};

export type UserJourneyState =
  | "anonymous_new"
  | "anonymous_analyzed"
  | "signed_up_unconfirmed"
  | "authenticated_no_onboarding"
  | "authenticated_onboarding_partial"
  | "authenticated_no_routine"
  | "care_active"
  | "checkin_due"
  | "referral_attention"
  | "sync_error";

export type UserJourneyAction =
  | "start_analysis"
  | "confirm_email"
  | "link_local"
  | "continue_onboarding"
  | "save_routine"
  | "complete_checkin"
  | "view_referral"
  | "retry_sync"
  | "view_today_routine"
  | "continue_analysis"
  | "view_my";

export type UserJourney = {
  state: UserJourneyState;
  primaryAction: UserJourneyAction;
  label: string;
};
