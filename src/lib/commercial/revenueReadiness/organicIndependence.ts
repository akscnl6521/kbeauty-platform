/**
 * Prove Organic ranking and symptom/professional routing stay independent
 * from paid affiliate/sponsored relationships.
 */

import {
  ORGANIC_SCORE_FORBIDDEN_PAID_KEYS,
  PROFESSIONAL_ROUTING_FORBIDDEN_PAID_KEYS,
} from "./constants";
import type { OrganicIndependenceProof } from "./types";

export type OrganicRankProbe = {
  id: string;
  organicScore: number;
};

export type ProfessionalRouteProbe = {
  id: string;
  routePriority: number;
  expertFirst: boolean;
};

function orderIdsByScore(items: OrganicRankProbe[]): string[] {
  return [...items]
    .sort((a, b) => b.organicScore - a.organicScore || a.id.localeCompare(b.id))
    .map((i) => i.id);
}

function orderIdsByRoute(items: ProfessionalRouteProbe[]): string[] {
  return [...items]
    .sort(
      (a, b) =>
        Number(b.expertFirst) - Number(a.expertFirst) ||
        b.routePriority - a.routePriority ||
        a.id.localeCompare(b.id),
    )
    .map((i) => i.id);
}

function findForbiddenKeys(
  payload: Record<string, unknown>,
  forbidden: readonly string[],
): string[] {
  return forbidden.filter((key) => key in payload && payload[key] != null);
}

/**
 * Compare base Organic order vs order when paid noise is attached to payloads.
 * Scores/routes themselves must be identical — paid keys must not be in score math.
 */
export function proveOrganicAndProfessionalIndependence(input: {
  organicBase: OrganicRankProbe[];
  organicWithPaidNoise: OrganicRankProbe[];
  organicScorePayloadWithPaid?: Record<string, unknown>;
  professionalBase: ProfessionalRouteProbe[];
  professionalWithPaidNoise: ProfessionalRouteProbe[];
  professionalRoutingPayloadWithPaid?: Record<string, unknown>;
}): OrganicIndependenceProof {
  const organicOrderUnchanged =
    JSON.stringify(orderIdsByScore(input.organicBase)) ===
    JSON.stringify(orderIdsByScore(input.organicWithPaidNoise));

  const professionalRoutingUnchanged =
    JSON.stringify(orderIdsByRoute(input.professionalBase)) ===
    JSON.stringify(orderIdsByRoute(input.professionalWithPaidNoise));

  const paidKeysInOrganicScore = findForbiddenKeys(
    input.organicScorePayloadWithPaid ?? {},
    ORGANIC_SCORE_FORBIDDEN_PAID_KEYS,
  );
  const paidKeysInProfessionalRouting = findForbiddenKeys(
    input.professionalRoutingPayloadWithPaid ?? {},
    PROFESSIONAL_ROUTING_FORBIDDEN_PAID_KEYS,
  );

  return {
    organicOrderUnchanged,
    professionalRoutingUnchanged,
    paidKeysInOrganicScore,
    paidKeysInProfessionalRouting,
    ok:
      organicOrderUnchanged &&
      professionalRoutingUnchanged &&
      paidKeysInOrganicScore.length === 0 &&
      paidKeysInProfessionalRouting.length === 0,
  };
}
