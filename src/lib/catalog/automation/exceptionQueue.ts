export type CatalogExceptionKind =
  | "duplicate"
  | "renewal_suspect"
  | "missing_inci"
  | "missing_image"
  | "missing_offer"
  | "broken_image"
  | "source_mismatch"
  | "fetch_failed";

export type CatalogExceptionInput = {
  externalProductId: string;
  brand: string;
  productName: string;
  kind: CatalogExceptionKind;
  confidence?: number | null;
  sourceUrl?: string | null;
  reasons?: string[];
};

export type CatalogExceptionQueueItem = CatalogExceptionInput & {
  priority: "critical" | "high" | "medium" | "low";
  score: number;
  reviewGroup: "identity" | "source" | "content" | "commerce";
};

export type CatalogExceptionStagingRow = {
  external_product_id: string;
  brand_canonical: string;
  product_name_raw: string;
  official_product_url?: string | null;
  match_class?: string | null;
  enrichment_reasons?: unknown;
  ingredients_status?: string | null;
  primary_image_url?: string | null;
  image_status?: string | null;
  product_attributes?: Record<string, unknown> | null;
};

const BASE_SCORE: Record<CatalogExceptionKind, number> = {
  source_mismatch: 95,
  duplicate: 90,
  renewal_suspect: 85,
  fetch_failed: 75,
  broken_image: 65,
  missing_inci: 60,
  missing_image: 45,
  missing_offer: 35,
};

function groupFor(kind: CatalogExceptionKind): CatalogExceptionQueueItem["reviewGroup"] {
  if (kind === "duplicate" || kind === "renewal_suspect") return "identity";
  if (kind === "source_mismatch" || kind === "fetch_failed") return "source";
  if (kind === "missing_offer") return "commerce";
  return "content";
}

function priorityFor(score: number): CatalogExceptionQueueItem["priority"] {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function reasonsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function confidenceOf(attrs: Record<string, unknown> | null | undefined): number | null {
  const value = attrs?.identityConfidence;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function deriveCatalogExceptionsFromStagingRows(
  rows: CatalogExceptionStagingRow[]
): CatalogExceptionInput[] {
  const out: CatalogExceptionInput[] = [];

  for (const row of rows) {
    const reasons = reasonsOf(row.enrichment_reasons);
    const base = {
      externalProductId: row.external_product_id,
      brand: row.brand_canonical,
      productName: row.product_name_raw,
      sourceUrl: row.official_product_url ?? null,
      reasons,
    };

    if (row.match_class === "duplicate") {
      out.push({ ...base, kind: "duplicate", confidence: confidenceOf(row.product_attributes) });
    }
    if (row.match_class === "renewal_suspect") {
      out.push({ ...base, kind: "renewal_suspect", confidence: confidenceOf(row.product_attributes) });
    }
    if (reasons.some((reason) => reason.includes("official_domain_not_allowlisted") || reason.includes("name_mismatch"))) {
      out.push({ ...base, kind: "source_mismatch" });
    }
    if (row.match_class === "match_failed" || reasons.some((reason) => reason.startsWith("fetch_error:") || /^http_5\d\d$/.test(reason))) {
      out.push({ ...base, kind: "fetch_failed" });
    }
    if (row.image_status === "broken") out.push({ ...base, kind: "broken_image" });
    if (!row.primary_image_url) out.push({ ...base, kind: "missing_image" });
    if (row.ingredients_status !== "raw_collected") out.push({ ...base, kind: "missing_inci" });

    const attrs = row.product_attributes ?? {};
    const price = attrs.price;
    const currency = attrs.currency;
    if (!(typeof price === "number" && price > 0 && typeof currency === "string" && currency.trim())) {
      out.push({ ...base, kind: "missing_offer" });
    }
  }

  return out;
}

export function buildCatalogExceptionQueue(
  inputs: CatalogExceptionInput[]
): CatalogExceptionQueueItem[] {
  const deduped = new Map<string, CatalogExceptionInput>();
  for (const input of inputs) {
    const key = `${input.externalProductId}:${input.kind}`;
    if (!deduped.has(key)) deduped.set(key, input);
  }

  return [...deduped.values()]
    .map((input) => {
      const confidenceBoost =
        typeof input.confidence === "number" && Number.isFinite(input.confidence)
          ? Math.round(Math.max(0, Math.min(1, input.confidence)) * 5)
          : 0;
      const score = Math.min(100, BASE_SCORE[input.kind] + confidenceBoost);
      return {
        ...input,
        score,
        priority: priorityFor(score),
        reviewGroup: groupFor(input.kind),
      };
    })
    .sort((a, b) => b.score - a.score || a.externalProductId.localeCompare(b.externalProductId));
}
