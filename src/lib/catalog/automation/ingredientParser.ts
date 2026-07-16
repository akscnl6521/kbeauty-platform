/**
 * Official ingredient list parser (display/staging).
 * Does not invent INCI names or concentrations.
 */

import type { ParsedIngredientSource, ParsedIngredientToken } from "./types";

const KNOWN_ALIASES: Record<string, { inci: string; key: string; ko?: string }> = {
  aqua: { inci: "Aqua", key: "aqua", ko: "정제수" },
  water: { inci: "Aqua", key: "aqua", ko: "정제수" },
  glycerin: { inci: "Glycerin", key: "glycerin", ko: "글리세린" },
  glycerol: { inci: "Glycerin", key: "glycerin", ko: "글리세린" },
  panthenol: { inci: "Panthenol", key: "panthenol", ko: "판테놀" },
  "snail secretion filtrate": {
    inci: "Snail Secretion Filtrate",
    key: "snail_secretion_filtrate",
    ko: "달팽이분비물여과물",
  },
  "sodium hyaluronate": {
    inci: "Sodium Hyaluronate",
    key: "sodium_hyaluronate",
    ko: "히알루론산나트륨",
  },
  niacinamide: { inci: "Niacinamide", key: "niacinamide", ko: "나이아신아마이드" },
  "butyrospermum parkii butter": {
    inci: "Butyrospermum Parkii (Shea) Butter",
    key: "butyrospermum_parkii_butter",
  },
  fragrance: { inci: "Parfum", key: "parfum", ko: "향료" },
  parfum: { inci: "Parfum", key: "parfum", ko: "향료" },
};

export function stripHtml(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalIngredientKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function splitMayContain(raw: string): {
  main: string;
  mayContain: string | null;
  plusMinus: string | null;
} {
  const text = raw.replace(/\r\n/g, "\n");
  let mayContain: string | null = null;
  let plusMinus: string | null = null;
  let main = text;

  const mayMatch = text.match(
    /(?:may\s+contain|[+\/\-]\s*may\s+contain|포함될\s*수\s*있는\s*성분)\s*[:：]?\s*([\s\S]+)$/i
  );
  if (mayMatch) {
    mayContain = mayMatch[1]!.trim();
    main = text.slice(0, mayMatch.index).trim();
  }

  const pmMatch = main.match(/(?:\+\/\-|\+\/−)\s*[:：]?\s*([\s\S]+)$/i);
  if (pmMatch) {
    plusMinus = pmMatch[1]!.trim();
    main = main.slice(0, pmMatch.index).trim();
  }

  return { main, mayContain, plusMinus };
}

function tokenizeList(chunk: string): string[] {
  // Protect INCI decimal lists like 1,2-Hexanediol / 1,2,3-foo
  const placeholders: string[] = [];
  const protectedNums = chunk.replace(
    /\b(\d(?:\s*,\s*\d)+)-([A-Za-z][\w-]*)/g,
    (_m, nums: string, rest: string) => {
      const token = `${nums.replace(/\s*,\s*/g, ",")}-${rest}`;
      const key = `__NUMINCI_${placeholders.length}__`;
      placeholders.push(token);
      return key;
    }
  );

  const protectedChunk = protectedNums
    .replace(/\band\s+/gi, ", ")
    .replace(/\s+및\s+/g, ", ")
    .replace(/\s*;\s*/g, ",")
    .replace(/\n+/g, ",");

  const tokens: string[] = [];
  let buf = "";
  let depth = 0;
  for (const ch of protectedChunk) {
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    if (ch === ")" || ch === "]" || ch === "}") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      const t = buf.trim();
      if (t) tokens.push(t);
      buf = "";
      continue;
    }
    buf += ch;
  }
  const last = buf.trim();
  if (last) tokens.push(last);

  return tokens.map((t) =>
    t.replace(/__NUMINCI_(\d+)__/g, (_m, i: string) => placeholders[Number(i)]!)
  );
}

function mapToken(
  raw: string,
  order: number,
  section: ParsedIngredientToken["section"]
): ParsedIngredientToken {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  const keyLookup = cleaned
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const alias = KNOWN_ALIASES[keyLookup];
  if (alias) {
    return {
      displayOrder: order,
      ingredientRaw: cleaned,
      inciName: alias.inci,
      canonicalKey: alias.key,
      nameKo: alias.ko,
      normalizationStatus: "normalized",
      confidence: 0.92,
      section,
    };
  }

  const ciMatch = cleaned.match(/^CI\s*\d{3,5}$/i);
  if (ciMatch) {
    const inci = cleaned.toUpperCase().replace(/\s+/g, " ");
    return {
      displayOrder: order,
      ingredientRaw: cleaned,
      inciName: inci,
      canonicalKey: canonicalIngredientKey(inci),
      normalizationStatus: "parsed",
      confidence: 0.85,
      section: section === "main" ? "plus_minus_colorants" : section,
      notes: ["ci_colorant"],
    };
  }

  // Keep unknown tokens — never delete.
  return {
    displayOrder: order,
    ingredientRaw: cleaned,
    inciName: cleaned,
    canonicalKey: canonicalIngredientKey(cleaned) || undefined,
    normalizationStatus: "unknown",
    confidence: 0.35,
    section,
    notes: ["unknown_token_preserved"],
  };
}

export function parseOfficialIngredientsRaw(input: {
  ingredientsRaw: string;
  sourceUrl: string;
  sourceType: string;
  sourceTier: 1 | 2 | 3 | 4;
  sourceVerified: boolean;
}): ParsedIngredientSource {
  const plain = stripHtml(input.ingredientsRaw);
  const { main, mayContain, plusMinus } = splitMayContain(plain);
  const tokens: ParsedIngredientToken[] = [];
  let order = 0;

  for (const t of tokenizeList(main)) {
    tokens.push(mapToken(t, order++, "main"));
  }
  if (mayContain) {
    for (const t of tokenizeList(mayContain)) {
      tokens.push(mapToken(t, order++, "may_contain"));
    }
  }
  if (plusMinus) {
    for (const t of tokenizeList(plusMinus)) {
      tokens.push(mapToken(t, order++, "plus_minus_colorants"));
    }
  }

  return {
    ingredientsRaw: plain,
    sourceUrl: input.sourceUrl,
    sourceType: input.sourceType,
    sourceTier: input.sourceTier,
    sourceVerified: input.sourceVerified,
    tokens,
  };
}
