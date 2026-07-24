/**
 * Deterministic duplicate merge for verified product pool (P3-T02).
 * Prefer brand+name+volume; keep richest verified gates.
 */

import type { VerifiedPoolCandidate } from "./types";

function normalizeKeyPart(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()[\]{}·・]/g, "")
    .trim();
}

export function deterministicPoolDedupeKey(
  candidate: Pick<
    VerifiedPoolCandidate,
    "candidateId" | "brandName" | "productNameKo" | "volumeLabel" | "officialSourceUrl" | "poolCategory"
  >,
): string {
  const brand = normalizeKeyPart(candidate.brandName);
  const name = normalizeKeyPart(candidate.productNameKo);
  const volume = normalizeKeyPart(candidate.volumeLabel);
  if (brand && name) {
    return `identity:${candidate.poolCategory}:${brand}|${name}|${volume}`;
  }
  if (candidate.officialSourceUrl) {
    try {
      const u = new URL(candidate.officialSourceUrl);
      return `url:${u.host}${u.pathname}`.toLowerCase().replace(/\/$/, "");
    } catch {
      return `url:${normalizeKeyPart(candidate.officialSourceUrl)}`;
    }
  }
  return `id:${candidate.candidateId}`;
}

function gateScore(c: VerifiedPoolCandidate): number {
  let score = 0;
  if (c.gate.sourceVerified) score += 4;
  if (c.gate.ingredientsVerified) score += 4;
  if (c.gate.imageRightsVerified) score += 3;
  if (c.gate.purchaseOfferVerified) score += 3;
  if (c.gate.recommendationReady) score += 2;
  if (!c.isFixture) score += 1;
  if (!c.isDryRunRecord) score += 1;
  return score;
}

export type DedupeMergeResult = {
  unique: VerifiedPoolCandidate[];
  mergedAway: VerifiedPoolCandidate[];
};

/**
 * Keep the richest candidate per dedupe key; mark others as duplicate_merged.
 */
export function mergeDuplicateCandidates(
  candidates: VerifiedPoolCandidate[],
): DedupeMergeResult {
  const groups = new Map<string, VerifiedPoolCandidate[]>();
  for (const c of candidates) {
    const key = deterministicPoolDedupeKey(c);
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }

  const unique: VerifiedPoolCandidate[] = [];
  const mergedAway: VerifiedPoolCandidate[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      unique.push(group[0]);
      continue;
    }
    const sorted = [...group].sort((a, b) => {
      const diff = gateScore(b) - gateScore(a);
      if (diff !== 0) return diff;
      return a.candidateId.localeCompare(b.candidateId);
    });
    const winner = sorted[0];
    const losers = sorted.slice(1);
    const merged: VerifiedPoolCandidate = {
      ...winner,
      mergedFromIds: [
        ...new Set([
          ...winner.mergedFromIds,
          ...losers.map((l) => l.candidateId),
        ]),
      ],
      status:
        winner.status === "rejected" || winner.status === "safety_hold"
          ? winner.status
          : winner.status,
    };
    unique.push(merged);
    for (const loser of losers) {
      mergedAway.push({
        ...loser,
        status: "duplicate_merged",
        duplicateOf: winner.candidateId,
        rejectionReasons: [
          ...new Set([...loser.rejectionReasons, "duplicate_merged" as const]),
        ],
        reviewReasons: [...loser.reviewReasons, "duplicate_merged"],
        publicTop5Allowed: false,
        gate: {
          ...loser.gate,
          publicTop5Allowed: false,
          recommendationReady: false,
          rejectionCodes: [
            ...new Set([...loser.gate.rejectionCodes, "duplicate_merged" as const]),
          ],
        },
      });
    }
  }

  unique.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  mergedAway.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  return { unique, mergedAway };
}
