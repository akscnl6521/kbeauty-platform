import { resolveUserJourney } from "./journey";
import type { UserJourneyInput } from "./journey-types";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const base: UserJourneyInput = {
  authenticated: true,
  emailConfirmed: true,
  hasLocalAnalysis: false,
  hasLocalCare: false,
  onboardingComplete: true,
  onboardingPartial: false,
  hasRoutine: false,
  hasDueCheckIn: false,
  referralLevel: "none",
  syncError: false,
};

export function runJourneySelftests(): { ok: true; checks: number } {
  const cases: Array<[Partial<UserJourneyInput>, string]> = [
    [{ referralLevel: "seek_promptly", hasDueCheckIn: true }, "referral_attention"],
    [{ hasDueCheckIn: true }, "checkin_due"],
    [{ emailConfirmed: false }, "signed_up_unconfirmed"],
    [
      { onboardingComplete: false, onboardingPartial: true },
      "authenticated_onboarding_partial",
    ],
    [{ onboardingComplete: false }, "authenticated_no_onboarding"],
    [{ hasRoutine: false, syncError: true }, "sync_error"],
    [{ hasRoutine: false }, "authenticated_no_routine"],
    [{ hasRoutine: true }, "care_active"],
    [
      { authenticated: false, hasLocalAnalysis: true },
      "anonymous_analyzed",
    ],
    [{ authenticated: false }, "anonymous_new"],
  ];
  for (const [override, expected] of cases) {
    assert(
      resolveUserJourney({ ...base, ...override }).state === expected,
      `expected ${expected}`
    );
  }
  return { ok: true, checks: cases.length };
}
