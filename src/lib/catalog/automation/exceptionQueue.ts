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
