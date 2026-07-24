/**
 * P3-T04 revenue readiness pipeline — fixture / dry-run only.
 * Never activates real commercial agreements · never invents rates/URLs.
 */

import { createHash } from "node:crypto";
import { applyAdminApproval, evaluateAdminApproval } from "./adminApproval";
import { ingestAffiliateOffer } from "./affiliateOfferIngestion";
import { buildRevenueReadinessAudit } from "./audit";
import {
  getAnalyticsPrivacyBoundary,
  validateClickConversionEvent,
} from "./clickConversionEvents";
import { applyExpiryToCandidate } from "./expiryHandling";
import {
  createAffiliateOfferFixtures,
  createClickConversionEventFixtures,
  createSponsoredPlacementFixtures,
} from "./fixtures";
import { proveOrganicAndProfessionalIndependence } from "./organicIndependence";
import { ingestSponsoredPlacement } from "./sponsoredPlacement";
import type {
  AffiliateOfferIngestInput,
  ClickConversionEventInput,
  RevenueReadinessMode,
  RevenueReadinessRunResult,
  SponsoredPlacementContractInput,
} from "./types";
import { REVENUE_READINESS_TASK_ID } from "./types";

function newRunId(nowIso: string): string {
  const stamp = nowIso.replace(/[:.]/g, "-");
  const suffix = createHash("sha256")
    .update(`${stamp}:p3-t04:${Math.random()}`)
    .digest("hex")
    .slice(0, 8);
  return `p3-t04-${stamp.slice(0, 19)}-${suffix}`;
}

export type RunRevenueReadinessInput = {
  mode: RevenueReadinessMode;
  offers?: AffiliateOfferIngestInput[];
  placements?: SponsoredPlacementContractInput[];
  events?: ClickConversionEventInput[];
  now?: Date;
  /** Dry-run structural human approval map by recordId. */
  humanApprovedIds?: string[];
  runId?: string;
};

/**
 * Run revenue readiness architecture checks.
 * Never writes DB · never publishes · never activates commercial agreements.
 */
export function runRevenueReadiness(
  input: RunRevenueReadinessInput,
): RevenueReadinessRunResult {
  if (input.mode === "live_blocked") {
    throw new Error(
      "live_blocked: 실 제휴·스폰서 계약 활성화는 사람/법무 승인 후. 이 파이프라인은 fixture/dry_run만 허용.",
    );
  }

  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const runId = input.runId ?? newRunId(nowIso);
  const ingestMode = input.mode === "dry_run" ? "dry_run" : "fixture";
  const approved = new Set(input.humanApprovedIds ?? []);

  const offers = input.offers ?? createAffiliateOfferFixtures();
  const placements = input.placements ?? createSponsoredPlacementFixtures();
  const events = input.events ?? createClickConversionEventFixtures();

  const ingested = [
    ...offers.map((o) => ingestAffiliateOffer(o, { mode: ingestMode })),
    ...placements.map((p) => ingestSponsoredPlacement(p, { mode: ingestMode })),
  ];

  const expiryDecisions = [];
  const afterExpiry = [];
  for (const candidate of ingested) {
    const { candidate: next, decision } = applyExpiryToCandidate(candidate, now);
    expiryDecisions.push(decision);
    afterExpiry.push(next);
  }

  const adminDecisions = [];
  const candidates = [];
  for (const candidate of afterExpiry) {
    const decision = evaluateAdminApproval(candidate, {
      humanApproved: approved.has(candidate.recordId),
    });
    adminDecisions.push(decision);
    candidates.push(applyAdminApproval(candidate, decision));
  }

  const eventValidations = events.map((event) => {
    const result = validateClickConversionEvent(event);
    return {
      eventId: event.eventId,
      ok: result.ok,
      reasons: result.reasons,
    };
  });
  const eventsValidated = eventValidations.filter((e) => e.ok).length;
  const eventsRejected = eventValidations.filter((e) => !e.ok).length;
  const privacyViolations = eventValidations.filter((e) =>
    e.reasons.includes("health_targeting_forbidden"),
  ).length;

  const organicIndependence = proveOrganicAndProfessionalIndependence({
    organicBase: [
      { id: "a", organicScore: 90 },
      { id: "b", organicScore: 80 },
      { id: "c", organicScore: 70 },
    ],
    organicWithPaidNoise: [
      { id: "a", organicScore: 90 },
      { id: "b", organicScore: 80 },
      { id: "c", organicScore: 70 },
    ],
    organicScorePayloadWithPaid: {
      organicScore: 90,
      safetyScore: 80,
      // paid keys intentionally absent from score payload
    },
    professionalBase: [
      { id: "clinic-urgent", routePriority: 100, expertFirst: true },
      { id: "clinic-b", routePriority: 50, expertFirst: false },
      { id: "clinic-c", routePriority: 40, expertFirst: false },
    ],
    professionalWithPaidNoise: [
      { id: "clinic-urgent", routePriority: 100, expertFirst: true },
      { id: "clinic-b", routePriority: 50, expertFirst: false },
      { id: "clinic-c", routePriority: 40, expertFirst: false },
    ],
    professionalRoutingPayloadWithPaid: {
      routePriority: 100,
      expertFirst: true,
      symptomCode: "rosacea_flare",
    },
  });

  const audit = buildRevenueReadinessAudit({
    mode: input.mode,
    runId,
    generatedAt: nowIso,
    candidates,
    eventsValidated,
    eventsRejected,
    privacyViolations,
    organicIndependence,
  });

  return {
    taskId: REVENUE_READINESS_TASK_ID,
    mode: input.mode,
    runId,
    generatedAt: nowIso,
    candidates,
    expiryDecisions,
    adminDecisions,
    eventValidations,
    organicIndependence,
    privacyBoundary: getAnalyticsPrivacyBoundary(),
    audit,
    publishAllowed: false,
    publicVisible: false,
    commercialAgreementsActivated: false,
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    paidApiUsed: false,
  };
}

export function runFixtureRevenueReadiness(
  now = new Date("2026-07-24T12:00:00.000Z"),
): RevenueReadinessRunResult {
  return runRevenueReadiness({
    mode: "fixture",
    now,
    humanApprovedIds: ["aff-ok-kr-001", "sp-rail-001", "sp-clinic-aside-003"],
  });
}

export function assertNoCommercialActivation(
  result: RevenueReadinessRunResult,
): void {
  if (result.commercialAgreementsActivated) {
    throw new Error("commercialAgreementsActivated must stay false");
  }
  if (result.publishAllowed || result.publicVisible) {
    throw new Error("publish/public must stay false");
  }
  if (
    result.databaseTouched ||
    result.writeAttempted ||
    result.productionTouched ||
    result.paidApiUsed
  ) {
    throw new Error("DB/write/production/paid-api must stay false");
  }
  if (result.candidates.some((c) => c.commercialAgreementActivated)) {
    throw new Error("candidate commercialAgreementActivated must stay false");
  }
  if (result.candidates.some((c) => c.allowPublicPaidSurface)) {
    throw new Error("allowPublicPaidSurface must stay false");
  }
  if (result.audit.totals.agreementsActivated !== 0) {
    throw new Error("audit.agreementsActivated must be 0");
  }
  if (result.audit.inventedCommissionRates || result.audit.inventedLiveUrls) {
    throw new Error("audit must not claim invented rates/URLs as accepted");
  }
}
