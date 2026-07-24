/**
 * Deterministic dedupe for Seoul dermatology candidates (primary key: ykiho).
 */

import type { SeoulDermatologyCandidate } from "./types";

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()[\]{}]/g, "")
    .trim();
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D+/g, "");
  return digits.length >= 8 ? digits : null;
}

function normalizeAddress(addr: string | null): string | null {
  if (!addr) return null;
  return addr.replace(/\s+/g, "").toLowerCase();
}

/**
 * Deterministic duplicate key.
 * Prefer institutionId (ykiho). Fallback: name+address+phone composite.
 */
export function deterministicDedupeKey(
  candidate: Pick<SeoulDermatologyCandidate, "fields">,
): string {
  const id = candidate.fields.institutionId?.trim();
  if (id) return `ykiho:${id}`;
  const name = normalizeName(candidate.fields.name);
  const addr = normalizeAddress(candidate.fields.address) ?? "";
  const phone = normalizePhone(candidate.fields.phone) ?? "";
  return `composite:${name}|${addr}|${phone}`;
}

export type DedupeResult = {
  unique: SeoulDermatologyCandidate[];
  duplicates: SeoulDermatologyCandidate[];
};

/**
 * Keep first occurrence of each key; later rows become status=duplicate.
 * Sort keys for stable output order by candidateId.
 */
export function dedupeCandidates(
  candidates: SeoulDermatologyCandidate[],
): DedupeResult {
  const seen = new Map<string, string>();
  const unique: SeoulDermatologyCandidate[] = [];
  const duplicates: SeoulDermatologyCandidate[] = [];

  for (const c of candidates) {
    const key = deterministicDedupeKey(c);
    const prior = seen.get(key);
    if (prior) {
      const dup: SeoulDermatologyCandidate = {
        ...c,
        status: "duplicate",
        duplicateOf: prior,
        filterReasons: [...c.filterReasons, "deterministic_duplicate"],
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
