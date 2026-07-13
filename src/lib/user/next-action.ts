import type { UserJourneyAction } from "./journey-types";

export function journeyActionHref(action: UserJourneyAction): string {
  const hrefs: Record<UserJourneyAction, string> = {
    start_analysis: "/analyze",
    confirm_email: "/login?next=%2Fmy",
    link_local: "/auth/link-local?next=%2Fonboarding",
    continue_onboarding: "/onboarding",
    save_routine: "/my/routine/new",
    complete_checkin: "/my/check-ins",
    view_referral: "/my/check-ins",
    retry_sync: "/my",
    view_today_routine: "/my/routine",
    continue_analysis: "/results",
    view_my: "/my",
  };
  return hrefs[action];
}
