/**
 * Click / conversion event contracts + analytics privacy boundaries.
 * Health / symptom / beauty-profile targeting is forbidden.
 */

import {
  ANALYTICS_PRIVACY_BOUNDARY,
  HEALTH_TARGETING_KEYS,
} from "./constants";
import type {
  AnalyticsPrivacyBoundary,
  ClickConversionEventInput,
  RevenueRejectionCode,
} from "./types";

export function getAnalyticsPrivacyBoundary(): AnalyticsPrivacyBoundary {
  return { ...ANALYTICS_PRIVACY_BOUNDARY };
}

export function findHealthTargetingKeys(
  profile: Record<string, unknown> | null | undefined,
): string[] {
  if (!profile) return [];
  return HEALTH_TARGETING_KEYS.filter((key) => key in profile);
}

export function validateClickConversionEvent(
  input: ClickConversionEventInput,
): { ok: boolean; reasons: RevenueRejectionCode[] } {
  const reasons: RevenueRejectionCode[] = [];

  if (!input.entityId?.trim() || !input.offerOrPlacementId?.trim()) {
    reasons.push("evidence_unverified");
  }

  if (input.kind === "conversion") {
    // Conversion may carry amount only when explicitly provided — never invent.
    if (
      input.revenueAmount != null &&
      (Number.isNaN(input.revenueAmount) || input.revenueAmount < 0)
    ) {
      reasons.push("commission_rate_invented");
    }
  }

  const healthKeys = findHealthTargetingKeys(input.targetingProfile ?? null);
  if (healthKeys.length > 0) {
    reasons.push("health_targeting_forbidden");
  }

  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export function scrubEventForAnalytics(
  input: ClickConversionEventInput,
): Record<string, unknown> | null {
  const validation = validateClickConversionEvent(input);
  if (!validation.ok) return null;

  const allowed = new Set(ANALYTICS_PRIVACY_BOUNDARY.allowedEventFields);
  const raw: Record<string, unknown> = {
    eventId: input.eventId,
    kind: input.kind,
    lane: input.lane,
    entityType: input.entityType,
    entityId: input.entityId,
    offerOrPlacementId: input.offerOrPlacementId,
    countryCode: input.countryCode,
    revenueAmount: input.revenueAmount ?? null,
    currency: input.currency ?? null,
    createdAt: new Date().toISOString(),
  };

  const scrubbed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (allowed.has(key)) scrubbed[key] = value;
  }
  return scrubbed;
}
