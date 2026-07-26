/**
 * Eligibility helpers for real-data onboarding readiness.
 */

import { validateOnboardingRowDryRun } from "./dryRunValidation";
import type {
  DryRunRowInput,
  DryRunValidationResult,
  OnboardingEligibility,
} from "./types";

const PUBLIC_SAFE: OnboardingEligibility[] = [
  // Intentionally empty — dry-run never grants public visibility.
];

export function isEligibleForStagingReview(
  result: DryRunValidationResult,
): boolean {
  return result.eligibility === "eligible_for_staging_review";
}

export function isFixtureNonPublic(result: DryRunValidationResult): boolean {
  return result.eligibility === "fixture_non_public";
}

export function mayBecomeUserVisibleFromDryRun(
  result: DryRunValidationResult,
): boolean {
  // Hard gate: dry-run / fixtures never become user-visible here.
  void PUBLIC_SAFE;
  return false && result.publicVisible;
}

export function evaluateEligibility(row: DryRunRowInput): DryRunValidationResult {
  return validateOnboardingRowDryRun(row);
}

export function summarizeEligibility(results: DryRunValidationResult[]): {
  eligibleForStagingReview: number;
  needsManualReview: number;
  rejected: number;
  fixtureNonPublic: number;
  blockedPolicy: number;
  anyPublicVisible: false;
} {
  const summary = {
    eligibleForStagingReview: 0,
    needsManualReview: 0,
    rejected: 0,
    fixtureNonPublic: 0,
    blockedPolicy: 0,
    anyPublicVisible: false as const,
  };
  for (const result of results) {
    if (result.publicVisible) {
      // Should never happen; keep type-narrowed false in summary.
      throw new Error("dry-run produced publicVisible=true");
    }
    switch (result.eligibility) {
      case "eligible_for_staging_review":
        summary.eligibleForStagingReview += 1;
        break;
      case "needs_manual_review":
        summary.needsManualReview += 1;
        break;
      case "rejected":
        summary.rejected += 1;
        break;
      case "fixture_non_public":
        summary.fixtureNonPublic += 1;
        break;
      case "blocked_policy":
        summary.blockedPolicy += 1;
        break;
      default:
        break;
    }
  }
  return summary;
}
