import type { IngredientParseResult } from "@/lib/pipeline/types";

export type IngredientMatchKind =
  | "exact"
  | "alias"
  | "normalized"
  | "ambiguous"
  | "unmatched";

export type NormalizedIngredientToken = {
  token: string;
  normalizedName: string;
  confidence: number;
  matchedIngredientId: number | null;
  needsReview: boolean;
  matchKind: IngredientMatchKind;
  order: number;
};

function normalizeTextKey(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[_\-·•|/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Protect common multi-word tokens from naive split on "and"/"및".
 */
function protectCompounds(raw: string): string {
  return raw
    .replace(/\bwater\s+and\s+/gi, "water+")
    .replace(/\baqua\s+and\s+/gi, "aqua+")
    .replace(/\band\s+/gi, ", ")
    .replace(/\s+및\s+/g, ", ")
    .replace(/\s+&\s+/g, ", ");
}

function stripConcentration(token: string): string {
  return token
    .replace(/\b\d+([.,]\d+)?\s*%/g, " ")
    .replace(/\*{1,3}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split and normalize an INCI / full-ingredient string.
 * Preserves order; does not invent names.
 */
export function parseIngredientList(
  raw: string | null | undefined
): IngredientParseResult {
  if (!raw || !raw.trim()) {
    return { rawTokens: [], normalized: [] };
  }

  let working = protectCompounds(raw);
  // Keep botanical parentheses content as part of token when short; strip long notes
  working = working.replace(/\(([^)]{80,})\)/g, " ");
  working = working
    .replace(/\r\n|\r|\n/g, ",")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[;/|]/g, ",")
    .replace(/\s+/g, " ")
    .trim();

  const rawTokens = working
    .split(",")
    .map((t) => stripConcentration(t.trim().replace(/\+/g, " ")))
    .filter((t) => t.length > 1 && t.length < 120);

  const seen = new Set<string>();
  const normalized: IngredientParseResult["normalized"] = [];

  let order = 0;
  for (const token of rawTokens) {
    const normalizedName = normalizeTextKey(token)
      .replace(/\bparfum\b/g, "fragrance")
      .replace(/\bfragrance\b/g, "fragrance")
      .replace(/\baqua\b/g, "water")
      .replace(/\bci\s*(\d{5})\b/g, "ci $1");

    if (!normalizedName || seen.has(normalizedName)) continue;
    // Reject marketing fragments
    if (
      /^(contains|with|free of|무첨가|포함)/i.test(normalizedName) ||
      normalizedName.split(" ").length > 12
    ) {
      continue;
    }
    seen.add(normalizedName);
    order += 1;

    const confidence =
      /^ci\s*\d{5}$/i.test(normalizedName)
        ? 0.9
        : token === token.toUpperCase() && token.length > 3
          ? 0.8
          : /[가-힯]/.test(token)
            ? 0.55
            : 0.7;

    normalized.push({
      token,
      normalizedName,
      confidence,
      matchedIngredientId: null,
      needsReview: confidence < 0.6,
      matchKind: "unmatched" as const,
      order,
    });
  }

  return { rawTokens, normalized };
}

export type IngredientLookupMaps = {
  bySlug: Map<string, number>;
  byNameEn: Map<string, number>;
  byNameKo: Map<string, number>;
  byAlias: Map<string, number>;
};

/**
 * Match tokens: slug → name_en → name_ko → alias.
 * Ambiguous (multiple ids for same key) → unmatched + needs_review.
 */
export function attachIngredientMatches(
  parsed: IngredientParseResult,
  maps: IngredientLookupMaps | Map<string, number>
): IngredientParseResult {
  const lookup: IngredientLookupMaps =
    maps instanceof Map
      ? {
          bySlug: maps,
          byNameEn: maps,
          byNameKo: new Map(),
          byAlias: new Map(),
        }
      : maps;

  return {
    rawTokens: parsed.rawTokens,
    normalized: parsed.normalized.map((item) => {
      const key = item.normalizedName;
      const candidates: Array<{ id: number; kind: IngredientMatchKind; boost: number }> =
        [];

      const slugId = lookup.bySlug.get(key);
      if (slugId != null) candidates.push({ id: slugId, kind: "exact", boost: 0.95 });

      const enId = lookup.byNameEn.get(key);
      if (enId != null) candidates.push({ id: enId, kind: "exact", boost: 0.92 });

      const koId = lookup.byNameKo.get(key);
      if (koId != null) candidates.push({ id: koId, kind: "normalized", boost: 0.88 });

      const aliasId = lookup.byAlias.get(key);
      if (aliasId != null) candidates.push({ id: aliasId, kind: "alias", boost: 0.9 });

      const uniqueIds = [...new Set(candidates.map((c) => c.id))];
      if (uniqueIds.length > 1) {
        return {
          ...item,
          matchedIngredientId: null,
          matchKind: "ambiguous" as const,
          confidence: Math.min(item.confidence, 0.5),
          needsReview: true,
        };
      }
      if (uniqueIds.length === 1) {
        const best = candidates[0]!;
        return {
          ...item,
          matchedIngredientId: best.id,
          matchKind: best.kind,
          confidence: Math.max(item.confidence, best.boost),
          needsReview: false,
        };
      }
      return {
        ...item,
        matchedIngredientId: null,
        matchKind: "unmatched" as const,
        needsReview: true,
      };
    }),
  };
}
