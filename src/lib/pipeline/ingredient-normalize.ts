import type { IngredientParseResult } from "@/lib/pipeline/types";

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
 * Split and normalize an INCI / full-ingredient string.
 * Does not invent ingredient names.
 */
export function parseIngredientList(raw: string | null | undefined): IngredientParseResult {
  if (!raw || !raw.trim()) {
    return { rawTokens: [], normalized: [] };
  }

  const cleaned = raw
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[;/|]/g, ",")
    .replace(/\s+/g, " ")
    .trim();

  const rawTokens = cleaned
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && t.length < 120);

  const seen = new Set<string>();
  const normalized: IngredientParseResult["normalized"] = [];

  for (const token of rawTokens) {
    const normalizedName = normalizeTextKey(token)
      .replace(/\bparfum\b/g, "fragrance")
      .replace(/\bfragrance\b/g, "fragrance")
      .replace(/\baqua\b/g, "water");

    if (!normalizedName || seen.has(normalizedName)) continue;
    seen.add(normalizedName);

    const confidence =
      token === token.toUpperCase() && token.length > 3
        ? 0.75
        : /[가-힯]/.test(token)
          ? 0.55
          : 0.65;

    normalized.push({
      token,
      normalizedName,
      confidence,
      matchedIngredientId: null,
      needsReview: confidence < 0.6,
    });
  }

  return { rawTokens, normalized };
}

/**
 * Match normalized tokens against a provided ingredient name map (id by key).
 */
export function attachIngredientMatches(
  parsed: IngredientParseResult,
  ingredientKeyToId: Map<string, number>
): IngredientParseResult {
  return {
    rawTokens: parsed.rawTokens,
    normalized: parsed.normalized.map((item) => {
      const id = ingredientKeyToId.get(item.normalizedName) ?? null;
      return {
        ...item,
        matchedIngredientId: id,
        confidence: id != null ? Math.max(item.confidence, 0.85) : item.confidence,
        needsReview: id == null && item.confidence < 0.7,
      };
    }),
  };
}
