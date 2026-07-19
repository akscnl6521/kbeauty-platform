import type { EnrichmentRecord } from "@/lib/catalog/enrichment";

export type ExistingCatalogIdentity = {
  productId: string;
  canonicalKey: string;
  officialUrl: string | null;
  imageContentHash: string | null;
};

export type CollectionDecision =
  | { action: "reject"; reason: string }
  | { action: "manual_review"; reason: string }
  | { action: "create_candidate"; canonicalKey: string }
  | { action: "update_candidate"; productId: string; canonicalKey: string }
  | { action: "no_change"; productId: string; canonicalKey: string };

function slug(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

export function canonicalCollectionKey(record: EnrichmentRecord): string {
  const brand = slug(record.brand);
  const name = slug(record.officialName || record.nameRaw);
  const category = slug(record.category || "unknown");
  return `${brand}::${name}::${category}`;
}

export function decideCollectedProduct(input: {
  record: EnrichmentRecord;
  existing: ExistingCatalogIdentity[];
}): CollectionDecision {
  const { record, existing } = input;

  if (
    record.matchClass === "placeholder" ||
    record.matchClass === "rejected_candidate" ||
    record.curatedProvenance === "category_discovery"
  ) {
    return { action: "reject", reason: "placeholder_or_rejected" };
  }

  if (record.matchClass === "match_failed") {
    return { action: "manual_review", reason: "official_match_failed" };
  }

  if (record.robotsAllowed === false) {
    return { action: "manual_review", reason: "robots_disallowed" };
  }

  if (!record.officialUrl || !record.sourceHost || !record.fetchedAt) {
    return { action: "manual_review", reason: "official_source_incomplete" };
  }

  const canonicalKey = canonicalCollectionKey(record);
  const sameCanonical = existing.find((item) => item.canonicalKey === canonicalKey);
  const sameUrl = existing.find(
    (item) => item.officialUrl && item.officialUrl === record.officialUrl
  );
  const match = sameCanonical ?? sameUrl;

  if (!match) {
    return { action: "create_candidate", canonicalKey };
  }

  const imageChanged = Boolean(
    record.imageContentHash &&
      match.imageContentHash &&
      record.imageContentHash !== match.imageContentHash
  );
  const urlChanged = Boolean(
    record.officialUrl && match.officialUrl && record.officialUrl !== match.officialUrl
  );
  const dataChanged =
    imageChanged ||
    urlChanged ||
    record.fullIngredients.length > 0 ||
    record.price !== null ||
    record.availability !== null;

  if (dataChanged) {
    return {
      action: "update_candidate",
      productId: match.productId,
      canonicalKey,
    };
  }

  return { action: "no_change", productId: match.productId, canonicalKey };
}
