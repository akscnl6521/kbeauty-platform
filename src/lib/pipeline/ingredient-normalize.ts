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

/**
 * 토큰과 사전 항목이 **같은 규칙으로** 키를 만들게 하려고 내보낸다.
 * 여기서 하이픈이 공백이 되므로, 사전 쪽에서 `Polyquaternium-10` 을 원문
 * 그대로 키로 쓰면 토큰 `폴리쿼터늄 10` 과 영영 만나지 못한다.
 */
export function normalizeTextKey(value: string | null | undefined): string {
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

export type IngredientDictionaryRow = {
  id: number;
  slug?: string | null;
  name_en?: string | null;
  name_ko?: string | null;
};

export type IngredientAliasRow = {
  ingredient_id: number;
  normalized_alias?: string | null;
  alias?: string | null;
};

/**
 * 사전 조회 맵을 만든다. 키는 토큰과 **같은 정규화**를 쓴다.
 *
 * 한 키가 서로 다른 성분 두 개를 가리키면 그 키는 통째로 버린다. 그냥 Map 에
 * 넣으면 나중 행이 앞 행을 덮어써서 «조용히 아무거나» 고르게 되는데, 사전에
 * 중복 행이 있을 때 어느 쪽이 이길지는 조회 순서에 달린 문제다. 잘못 붙은
 * 성분은 안전 정보까지 틀리게 만드니, 확실하지 않으면 미매칭으로 남겨
 * needs_review 로 보내는 편이 옳다.
 */
export function buildIngredientLookupMaps(
  ingredients: readonly IngredientDictionaryRow[],
  aliases: readonly IngredientAliasRow[] = []
): IngredientLookupMaps & { collisions: string[] } {
  const collisions: string[] = [];

  const collect = (
    entries: ReadonlyArray<readonly [string | null | undefined, number]>,
    label: string
  ): Map<string, number> => {
    const seen = new Map<string, Set<number>>();
    for (const [raw, id] of entries) {
      const key = normalizeTextKey(raw);
      if (!key) continue;
      const bucket = seen.get(key);
      if (bucket) bucket.add(id);
      else seen.set(key, new Set([id]));
    }
    const out = new Map<string, number>();
    for (const [key, ids] of seen) {
      if (ids.size > 1) {
        collisions.push(`${label} "${key}": ${[...ids].join(", ")}`);
        continue;
      }
      out.set(key, [...ids][0]!);
    }
    return out;
  };

  return {
    bySlug: collect(
      ingredients.map((r) => [r.slug, r.id] as const),
      "slug"
    ),
    byNameEn: collect(
      ingredients.map((r) => [r.name_en, r.id] as const),
      "name_en"
    ),
    byNameKo: collect(
      ingredients.map((r) => [r.name_ko, r.id] as const),
      "name_ko"
    ),
    byAlias: collect(
      aliases.map((a) => [a.normalized_alias || a.alias, a.ingredient_id] as const),
      "alias"
    ),
    collisions,
  };
}

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
