/**
 * Public Top 5 recommendation gate (P3-T02).
 * Products missing verified source, ingredients, image rights, or purchase offer
 * MUST NOT enter public Top 5.
 */

import { PUBLIC_TOP5_LIMIT } from "./constants";
import type { VerifiedPoolCandidate, VerifiedPoolRejectionCode } from "./types";

export type Top5GateDecision = {
  allowed: boolean;
  reasons: VerifiedPoolRejectionCode[];
};

/**
 * Hard gate: all four verification pillars + safety + non-public exclusions.
 */
export function evaluatePublicTop5Eligibility(
  candidate: VerifiedPoolCandidate,
): Top5GateDecision {
  const reasons: VerifiedPoolRejectionCode[] = [];

  if (!candidate.gate.sourceVerified) reasons.push("source_not_verified");
  if (!candidate.gate.ingredientsVerified) {
    reasons.push("ingredients_not_verified");
  }
  if (!candidate.gate.imageRightsVerified) {
    reasons.push("image_rights_not_verified");
  }
  if (!candidate.gate.purchaseOfferVerified) {
    reasons.push("purchase_offer_missing");
  }
  if (!candidate.gate.safetyEligible) reasons.push("safety_ineligible");
  if (candidate.isFixture) reasons.push("fixture_non_public");
  if (candidate.isDryRunRecord) reasons.push("dry_run_non_public");
  if (!candidate.manifestApproved) {
    reasons.push("official_manifest_not_approved");
  }
  if (candidate.status === "duplicate_merged") {
    reasons.push("duplicate_merged");
  }
  if (candidate.status === "rejected" || candidate.status === "safety_hold") {
    if (!reasons.length) reasons.push("safety_ineligible");
  }

  const allowed =
    reasons.length === 0 &&
    candidate.gate.publicTop5Allowed === true &&
    candidate.publicTop5Allowed === true;

  return { allowed, reasons: [...new Set(reasons)] };
}

/**
 * Build public Top 5 from a pool — enforces hard gates and limit.
 * Incomplete / fixture / dry-run candidates are excluded.
 */
export function selectPublicTop5(
  candidates: VerifiedPoolCandidate[],
  limit: number = PUBLIC_TOP5_LIMIT,
): {
  selected: VerifiedPoolCandidate[];
  blocked: Array<{
    candidateId: string;
    reasons: VerifiedPoolRejectionCode[];
  }>;
} {
  const blocked: Array<{
    candidateId: string;
    reasons: VerifiedPoolRejectionCode[];
  }> = [];
  const eligible: VerifiedPoolCandidate[] = [];

  for (const c of candidates) {
    const decision = evaluatePublicTop5Eligibility(c);
    if (!decision.allowed) {
      blocked.push({ candidateId: c.candidateId, reasons: decision.reasons });
      continue;
    }
    eligible.push(c);
  }

  // Stable order by candidateId — no invented ranking scores in dry-run.
  eligible.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  return {
    selected: eligible.slice(0, Math.max(0, limit)),
    blocked,
  };
}

/**
 * Prove a single missing pillar blocks Top 5 entry.
 */
export function assertMissingPillarBlocksTop5(
  candidate: VerifiedPoolCandidate,
  missing:
    | "source"
    | "ingredients"
    | "image_rights"
    | "purchase_offer",
): boolean {
  const decision = evaluatePublicTop5Eligibility(candidate);
  if (decision.allowed) return false;
  if (missing === "source") {
    return decision.reasons.includes("source_not_verified");
  }
  if (missing === "ingredients") {
    return decision.reasons.includes("ingredients_not_verified");
  }
  if (missing === "image_rights") {
    return decision.reasons.includes("image_rights_not_verified");
  }
  return decision.reasons.includes("purchase_offer_missing");
}
