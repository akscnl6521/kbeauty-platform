/**
 * Open Beauty Facts read-only client (approved open_data source).
 * Rate-limited; never invents ingredients.
 */

export type ObfSearchHit = {
  code: string;
  productName: string;
  brands: string;
  url: string;
};

export type ObfProductDetail = ObfSearchHit & {
  ingredientsText: string;
  completeness?: number;
};

const UA = "KBeautyMatchBot/0.1 (+staging-obf; https://github.com/akscnl6521/kbeauty-platform)";

export async function obfSearch(
  term: string,
  pageSize = 5,
  fetchImpl: typeof fetch = fetch
): Promise<ObfSearchHit[]> {
  const u =
    "https://world.openbeautyfacts.org/cgi/search.pl?search_terms=" +
    encodeURIComponent(term) +
    `&search_simple=1&action=process&json=1&page_size=${pageSize}`;
  const res = await fetchImpl(u, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return [];
  const j = (await res.json()) as {
    products?: Array<{
      code?: string;
      product_name?: string;
      brands?: string;
      url?: string;
    }>;
  };
  return (j.products ?? [])
    .filter((p) => p.code)
    .map((p) => ({
      code: String(p.code),
      productName: String(p.product_name ?? ""),
      brands: String(p.brands ?? ""),
      url:
        p.url ||
        `https://world.openbeautyfacts.org/product/${p.code}`,
    }));
}

export async function obfFetchProduct(
  code: string,
  fetchImpl: typeof fetch = fetch
): Promise<ObfProductDetail | null> {
  const u = `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(
    code
  )}.json?fields=code,product_name,brands,ingredients_text,ingredients_text_en,url,completeness`;
  const res = await fetchImpl(u, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as {
    status?: number;
    product?: {
      code?: string;
      product_name?: string;
      brands?: string;
      ingredients_text?: string;
      ingredients_text_en?: string;
      url?: string;
      completeness?: number;
    };
  };
  if (j.status !== 1 || !j.product) return null;
  const p = j.product;
  const ingredientsText = (
    p.ingredients_text ||
    p.ingredients_text_en ||
    ""
  ).trim();
  return {
    code: String(p.code || code),
    productName: String(p.product_name ?? ""),
    brands: String(p.brands ?? ""),
    url: p.url || `https://world.openbeautyfacts.org/product/${code}`,
    ingredientsText,
    completeness: p.completeness,
  };
}

/** Normalize slug-like brands: banila-co → Banila Co */
export function humanizeBrand(brandCanonical: string): string {
  return brandCanonical
    .replace(/[-_]+/g, " ")
    .replace(/[.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Prefer Latin-heavy retail name over broken/localized marketing titles. */
export function pickSearchProductName(
  productNameEn: string | null | undefined,
  productNameRaw: string | null | undefined
): string {
  const score = (s: string | null | undefined) => {
    if (!s?.trim()) return -1;
    const latin = (s.match(/[A-Za-z]/g) || []).length;
    const hangul = (s.match(/[가-힣]/g) || []).length;
    const replacement = (s.match(/�|\?/g) || []).length;
    return latin - hangul - replacement * 5;
  };
  const en = productNameEn?.trim() ?? "";
  const raw = productNameRaw?.trim() ?? "";
  return score(raw) >= score(en) ? raw || en : en || raw;
}

export function brandMatches(brandCanonical: string, obfBrands: string): boolean {
  const a = humanizeBrand(brandCanonical)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const b = obfBrands.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!a || !b) return false;
  if (b.includes(a) || a.includes(b)) return true;
  const aTokens = a.split(/\s+/).filter((t) => t.length > 1);
  if (aTokens.length === 0) return false;
  return aTokens.every((t) => b.includes(t));
}

export function shortenProductName(productName: string): string {
  return productName
    .replace(/[-_]+/g, " ")
    .replace(
      /\b(original|classic|advanced|the|spf\d+|pa\++|ml|g|oz|\d+\s*ml|\d+\s*g)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function buildObfSearchTerms(
  brandCanonical: string,
  productName: string
): string[] {
  const brand = humanizeBrand(brandCanonical);
  const full = productName.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  const short = shortenProductName(full);
  const brandLower = brand.toLowerCase();
  const withBrand = (n: string) =>
    n.toLowerCase().startsWith(brandLower) ? n : `${brand} ${n}`.trim();
  return Array.from(
    new Set(
      [withBrand(short), withBrand(full), short, full].filter(
        (t) => t.split(/\s+/).length >= 2
      )
    )
  );
}

export function nameSimilarity(a: string, b: string): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 2 && !["the", "with", "and"].includes(t));
  const A = new Set(norm(a));
  const B = new Set(norm(b));
  if (A.size === 0 || B.size === 0) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit += 1;
  return hit / Math.max(A.size, B.size);
}

const FORM_TOKENS = [
  "balm",
  "foam",
  "gel",
  "cream",
  "serum",
  "toner",
  "essence",
  "sunscreen",
  "sun",
  "mask",
  "pad",
  "pads",
  "cleanser",
  "shampoo",
  "ampoule",
  "mist",
  "stick",
  "cushion",
  "tint",
  "lipstick",
  "mascara",
] as const;

export function extractFormTokens(name: string): Set<string> {
  const tokens = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (const t of tokens) {
    if ((FORM_TOKENS as readonly string[]).includes(t)) out.add(t);
  }
  // id/slug hints
  if (/balm/.test(name.toLowerCase())) out.add("balm");
  return out;
}

/** True when both sides declare forms and they disagree (balm vs foam). */
export function hasFormConflict(a: string, b: string): boolean {
  const A = extractFormTokens(a);
  const B = extractFormTokens(b);
  if (A.size === 0 || B.size === 0) return false;
  for (const t of A) if (B.has(t)) return false;
  return true;
}
