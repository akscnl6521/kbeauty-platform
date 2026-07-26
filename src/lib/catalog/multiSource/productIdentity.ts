/**
 * Product identity normalization for multi-scenario pilot enrichment.
 */

export function normalizeBrand(brand: string): string {
  return brand
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.+]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function normalizeProductName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildProductId(
  brand: string,
  productName: string,
  volumeLabel?: string | null
): string {
  const b = normalizeBrand(brand);
  const n = normalizeProductName(productName).replace(/\s+/g, "-");
  const v = volumeLabel
    ? volumeLabel
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .trim()
    : "";
  return v ? `${b}-${n}-${v}` : `${b}-${n}`;
}

function tokenSet(s: string): Set<string> {
  return new Set(
    normalizeProductName(s)
      .split(/\s+/)
      .filter((t) => t.length >= 2)
  );
}

export function nameSimilarity(a: string, b: string): number {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  const union = new Set([...sa, ...sb]).size;
  return union ? inter / union : 0;
}

export type SameProductInput = {
  brand: string;
  productName: string;
  volumeLabel?: string | null;
  gtin?: string | null;
  canonicalUrl?: string | null;
};

/**
 * Heuristic same-product check for pilot merge (no network).
 */
export function maybeSameProduct(
  a: SameProductInput,
  b: SameProductInput
): { same: boolean; reason: string; score: number } {
  if (a.gtin && b.gtin && a.gtin === b.gtin) {
    return { same: true, reason: "gtin_match", score: 1 };
  }
  if (
    a.canonicalUrl &&
    b.canonicalUrl &&
    a.canonicalUrl.replace(/\/$/, "") === b.canonicalUrl.replace(/\/$/, "")
  ) {
    return { same: true, reason: "canonical_url_match", score: 0.98 };
  }
  if (normalizeBrand(a.brand) !== normalizeBrand(b.brand)) {
    return { same: false, reason: "brand_mismatch", score: 0 };
  }
  const sim = nameSimilarity(a.productName, b.productName);
  if (sim >= 0.88) {
    const va = (a.volumeLabel || "").toLowerCase().replace(/\s+/g, "");
    const vb = (b.volumeLabel || "").toLowerCase().replace(/\s+/g, "");
    if (va && vb && va !== vb) {
      return { same: false, reason: "volume_mismatch", score: sim };
    }
    return { same: true, reason: "name_similarity", score: sim };
  }
  return { same: false, reason: "name_below_threshold", score: sim };
}
