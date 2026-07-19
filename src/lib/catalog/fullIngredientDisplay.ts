export type FullIngredientSource =
  | "official_brand"
  | "official_retailer"
  | "package_label"
  | "verified_editorial";

export type FullIngredientRecord = {
  ingredients: string[];
  sourceType: FullIngredientSource;
  sourceUrl: string | null;
  verifiedAt: string;
};

export type FullIngredientDisplay = {
  ingredients: string[];
  displayText: string;
  count: number;
  verifiedAt: string;
  sourceUrl: string | null;
};

function normalizeToken(value: unknown): string | null {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0 ? text : null;
}

export function normalizeFullIngredientList(value: unknown): string[] {
  let raw: unknown[] = [];

  if (Array.isArray(value)) {
    raw = value;
  } else if (typeof value === "string") {
    const text = value.trim();
    if (!text) return [];

    if (text.startsWith("[") && text.endsWith("]")) {
      try {
        const parsed: unknown = JSON.parse(text);
        if (Array.isArray(parsed)) raw = parsed;
      } catch {
        raw = [];
      }
    }

    if (raw.length === 0) {
      raw = text.split(/[,;\n|]/g);
    }
  } else {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of raw) {
    const token = normalizeToken(item);
    if (!token) continue;
    const key = token.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(token);
  }

  return normalized;
}

export function buildFullIngredientDisplay(
  record: FullIngredientRecord | null | undefined
): FullIngredientDisplay | null {
  if (!record) return null;

  const ingredients = normalizeFullIngredientList(record.ingredients);
  if (ingredients.length === 0) return null;

  const verifiedAt = new Date(record.verifiedAt);
  if (Number.isNaN(verifiedAt.getTime())) return null;

  if (
    record.sourceType !== "official_brand" &&
    record.sourceType !== "official_retailer" &&
    record.sourceType !== "package_label" &&
    record.sourceType !== "verified_editorial"
  ) {
    return null;
  }

  const sourceUrl = record.sourceUrl?.trim() || null;
  if (sourceUrl && !sourceUrl.startsWith("https://")) return null;

  return {
    ingredients,
    displayText: ingredients.join(", "),
    count: ingredients.length,
    verifiedAt: verifiedAt.toISOString(),
    sourceUrl,
  };
}
