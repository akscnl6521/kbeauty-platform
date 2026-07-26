import type {
  IngredientEvidence,
  IngredientEvidenceStatus,
  SourceTrustTier,
} from "./types";
import { canFinalizeIngredients, trustTierRank } from "./sourceTrust";

function normalizeInci(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.;]+$/g, "")
    .trim();
}

function tokenSet(raw: string): Set<string> {
  return new Set(
    normalizeInci(raw)
      .split(/[,;|]/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
  );
}

export function inciSimilarity(a: string, b: string): number {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  const union = new Set([...sa, ...sb]).size;
  return union ? inter / union : 0;
}

function pickPreferredRaw(
  a: IngredientEvidence,
  b: IngredientEvidence
): string {
  // Explicit A>B>C>D rank — never compare trust letters with string <=.
  if (trustTierRank(a.trust) <= trustTierRank(b.trust)) return a.raw;
  return b.raw;
}

/**
 * Decide ingredient status from multi-source evidences.
 * D-tier alone never finalizes.
 *
 * Statuses: verified | source_verified_candidate | cross_source_confirmed |
 * needs_review | ingredient_incomplete
 */
export function mergeIngredientStatus(
  evidences: IngredientEvidence[]
): {
  status: IngredientEvidenceStatus;
  raw: string | null;
  mismatches: string[];
} {
  const usable = evidences.filter(
    (e) => e.raw.trim().length >= 12 && canFinalizeIngredients(e.trust)
  );
  const mismatches: string[] = [];
  if (!usable.length) {
    const any = evidences.find((e) => e.raw.trim().length >= 12);
    if (any) {
      return {
        status: "needs_review",
        raw: any.raw,
        mismatches: ["only_non_finalizing_or_empty_sources"],
      };
    }
    return { status: "ingredient_incomplete", raw: null, mismatches: [] };
  }

  const byTrust = (t: SourceTrustTier) => usable.filter((e) => e.trust === t);
  const a = byTrust("A");
  if (a.length) {
    return { status: "verified", raw: a[0].raw, mismatches };
  }

  for (let i = 0; i < usable.length; i += 1) {
    for (let j = i + 1; j < usable.length; j += 1) {
      if (usable[i].channel === usable[j].channel) continue;
      const sim = inciSimilarity(usable[i].raw, usable[j].raw);
      if (sim >= 0.72) {
        return {
          status: "cross_source_confirmed",
          raw: pickPreferredRaw(usable[i], usable[j]),
          mismatches,
        };
      }
      if (sim > 0 && sim < 0.55) {
        mismatches.push(
          `inci_mismatch:${usable[i].channel}vs${usable[j].channel}:${sim.toFixed(2)}`
        );
      }
    }
  }

  if (mismatches.length) {
    return { status: "needs_review", raw: usable[0].raw, mismatches };
  }

  const bOrC = usable.filter((e) => e.trust === "B" || e.trust === "C");
  if (bOrC.length >= 1) {
    return {
      status: "source_verified_candidate",
      raw: bOrC[0].raw,
      mismatches,
    };
  }

  return { status: "needs_review", raw: usable[0].raw, mismatches };
}
