/**
 * Commerce analytics — click / lead / conversion / revenue.
 * Health & personal skin data must never be used for ad targeting.
 */

export type CommerceEventType =
  | "click"
  | "lead"
  | "conversion"
  | "revenue";

export type CommerceLane = "organic" | "affiliate" | "sponsored" | "partner_clinic";

export type CommerceAnalyticsEvent = {
  id: string;
  type: CommerceEventType;
  lane: CommerceLane;
  entityType: "product" | "clinic" | "media";
  entityId: string;
  campaignId: string | null;
  partner: string | null;
  revenueAmount: number | null;
  currency: string | null;
  createdAt: string;
  /** Always false — health/PII targeting is forbidden. */
  usedHealthTargeting: false;
  databaseTouched: false;
  productionTouched: false;
};

export type CommerceEventInput = {
  type: CommerceEventType;
  lane: CommerceLane;
  entityType: "product" | "clinic" | "media";
  entityId: string;
  campaignId?: string | null;
  partner?: string | null;
  revenueAmount?: number | null;
  currency?: string | null;
  /** Rejected if present — symptoms, concerns, red flags, diagnoses, etc. */
  targetingProfile?: Record<string, unknown> | null;
};

export type CommerceEventValidation = {
  ok: boolean;
  reasons: string[];
};

const HEALTH_TARGETING_KEYS = [
  "skinConcerns",
  "concerns",
  "symptoms",
  "redFlags",
  "diagnosis",
  "medicalHistory",
  "allergy",
  "irritation",
  "beautyProfile",
  "healthCondition",
  "photoAnalysis",
  "acuteSignals",
];

export function findHealthTargetingKeys(
  profile: Record<string, unknown> | null | undefined,
): string[] {
  if (!profile) return [];
  return HEALTH_TARGETING_KEYS.filter((key) => key in profile);
}

export function validateCommerceEvent(
  input: CommerceEventInput,
): CommerceEventValidation {
  const reasons: string[] = [];
  if (!input.entityId.trim()) reasons.push("entity_id_missing");
  if (input.type === "revenue") {
    if (input.revenueAmount == null || Number.isNaN(input.revenueAmount)) {
      reasons.push("revenue_amount_missing");
    }
    if (!input.currency?.trim()) reasons.push("currency_missing");
  }
  if (input.lane === "organic" && (input.type === "revenue" || input.campaignId)) {
    reasons.push("organic_lane_must_not_carry_paid_campaign");
  }
  const healthKeys = findHealthTargetingKeys(input.targetingProfile ?? null);
  if (healthKeys.length > 0) {
    reasons.push("health_targeting_forbidden");
    for (const key of healthKeys) {
      reasons.push(`health_key:${key}`);
    }
  }
  return { ok: reasons.length === 0, reasons };
}

let seq = 0;
const eventStore: CommerceAnalyticsEvent[] = [];

export function resetCommerceAnalyticsStore(): void {
  eventStore.length = 0;
  seq = 0;
}

export function listCommerceAnalyticsEvents(): CommerceAnalyticsEvent[] {
  return [...eventStore];
}

export function recordCommerceEvent(
  input: CommerceEventInput,
  now = new Date(),
): { ok: true; event: CommerceAnalyticsEvent } | { ok: false; reasons: string[] } {
  const validation = validateCommerceEvent(input);
  if (!validation.ok) {
    return { ok: false, reasons: validation.reasons };
  }
  seq += 1;
  const event: CommerceAnalyticsEvent = {
    id: `evt-${seq}-${now.getTime()}`,
    type: input.type,
    lane: input.lane,
    entityType: input.entityType,
    entityId: input.entityId.trim(),
    campaignId: input.campaignId?.trim() || null,
    partner: input.partner?.trim() || null,
    revenueAmount: input.revenueAmount ?? null,
    currency: input.currency?.trim() || null,
    createdAt: now.toISOString(),
    usedHealthTargeting: false,
    databaseTouched: false,
    productionTouched: false,
  };
  eventStore.push(event);
  return { ok: true, event };
}

export function summarizeCommerceAnalytics(
  events: CommerceAnalyticsEvent[] = eventStore,
): {
  clicks: number;
  leads: number;
  conversions: number;
  revenueEvents: number;
  byLane: Record<CommerceLane, number>;
  healthTargetingClaims: number;
} {
  const byLane: Record<CommerceLane, number> = {
    organic: 0,
    affiliate: 0,
    sponsored: 0,
    partner_clinic: 0,
  };
  let clicks = 0;
  let leads = 0;
  let conversions = 0;
  let revenueEvents = 0;
  let healthTargetingClaims = 0;
  for (const event of events) {
    byLane[event.lane] += 1;
    if (event.type === "click") clicks += 1;
    if (event.type === "lead") leads += 1;
    if (event.type === "conversion") conversions += 1;
    if (event.type === "revenue") revenueEvents += 1;
    if (event.usedHealthTargeting) healthTargetingClaims += 1;
  }
  return {
    clicks,
    leads,
    conversions,
    revenueEvents,
    byLane,
    healthTargetingClaims,
  };
}
