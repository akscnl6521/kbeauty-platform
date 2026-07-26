/**
 * Deterministic dedupe for official Korean product candidates (P3-T01).
 * Prefer brand+name+volume; fallback to official URL; never invent keys.
 */

import type { OfficialKrProductCandidate } from "./types";

function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()[\]{}·・]/g, "")
    .trim();
}

function normalizeUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`.toLowerCase().replace(/\/$/, "");
  } catch {
    return normalizeText(url);
  }
}

/**
 * Deterministic duplicate key.
 * 1) brand|productKo|volume
 * 2) brandOfficialUrl or officialMallUrl
 * 3) candidateId (unique fallback — never collapses unknowns incorrectly)
 */
export function deterministicDedupeKey(
  candidate: Pick<
    OfficialKrProductCandidate,
    "candidateId" | "fields"
  >,
): string {
  const brand = normalizeText(candidate.fields.brandName);
  const name = normalizeText(candidate.fields.productNameKo);
  const volume = normalizeText(candidate.fields.volumeLabel);
  if (brand && name) {
    return `identity:${brand}|${name}|${volume}`;
  }
  const url =
    normalizeUrl(candidate.fields.brandOfficialUrl) ||
    normalizeUrl(candidate.fields.officialMallUrl);
  if (url) return `url:${url}`;
  return `id:${candidate.candidateId}`;
}

export type DedupeResult = {
  unique: OfficialKrProductCandidate[];
  duplicates: OfficialKrProductCandidate[];
};

/**
 * Keep first occurrence of each key; later rows become status=duplicate.
 */
export function dedupeCandidates(
  candidates: OfficialKrProductCandidate[],
): DedupeResult {
  const seen = new Map<string, string>();
  const unique: OfficialKrProductCandidate[] = [];
  const duplicates: OfficialKrProductCandidate[] = [];

  for (const c of candidates) {
    const key = deterministicDedupeKey(c);
    const prior = seen.get(key);
    if (prior) {
      const dup: OfficialKrProductCandidate = {
        ...c,
        status: "duplicate",
        duplicateOf: prior,
        filterReasons: [...c.filterReasons, "deterministic_duplicate"],
        reviewReasons: [...c.reviewReasons, "duplicate_unresolved"],
      };
      duplicates.push(dup);
    } else {
      seen.set(key, c.candidateId);
      unique.push(c);
    }
  }

  unique.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  duplicates.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  return { unique, duplicates };
}
