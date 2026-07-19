import { compareProductIdentity } from "@/lib/catalog/automation/productIdentity";
import type { ParsedCatalogProduct } from "@/lib/catalog/automation/types";
import type { EnrichmentRecord } from "./enrichOfficial";

function asProduct(record: EnrichmentRecord): ParsedCatalogProduct {
  const attrs = record.attributes;
  const text = (key: string) =>
    typeof attrs[key] === "string" && String(attrs[key]).trim()
      ? String(attrs[key]).trim()
      : undefined;
  const number = (key: string) =>
    typeof attrs[key] === "number" && Number.isFinite(attrs[key])
      ? Number(attrs[key])
      : undefined;

  return {
    brandRaw: record.brand,
    brandCanonical: record.brand,
    productNameRaw: record.nameRaw,
    productNameEn: record.officialName ?? undefined,
    categoryRaw: record.category ?? undefined,
    categoryCanonical: record.category ?? undefined,
    sizeValue: number("sizeValue"),
    sizeUnit: text("sizeUnit"),
    gtin: text("gtin"),
    sku: text("sku"),
    imageUrls: record.imageRemoteUrl ? [record.imageRemoteUrl] : [],
    officialProductUrl: record.officialUrl ?? undefined,
    sourceUrls: record.officialUrl ? [record.officialUrl] : [],
    sourceTier: 1,
  };
}

export function applyIdentityDecisions(records: EnrichmentRecord[]): EnrichmentRecord[] {
  const accepted: EnrichmentRecord[] = [];

  return records.map((record) => {
    if (record.matchClass !== "official_matched") return record;
    let current = record;

    for (const prior of accepted) {
      const decision = compareProductIdentity(asProduct(prior), asProduct(current));
      const identityReasons = decision.reasons.map((reason) => `identity:${reason}`);

      if (decision.kind === "exact_duplicate") {
        current = {
          ...current,
          matchClass: "duplicate",
          reasons: [...current.reasons, `duplicate_of:${prior.externalProductId}`, ...identityReasons],
          attributes: {
            ...current.attributes,
            duplicateOfExternalProductId: prior.externalProductId,
            identityConfidence: decision.confidence,
          },
        };
        break;
      }

      if (decision.kind === "renewal_suspect") {
        current = {
          ...current,
          matchClass: "renewal_suspect",
          reasons: [...current.reasons, `renewal_candidate_of:${prior.externalProductId}`, ...identityReasons],
          attributes: {
            ...current.attributes,
            renewalCandidateOfExternalProductId: prior.externalProductId,
            identityConfidence: decision.confidence,
          },
        };
        break;
      }

      if (decision.kind === "same_product_different_size") {
        current = {
          ...current,
          reasons: [...current.reasons, `size_variant_of:${prior.externalProductId}`, ...identityReasons],
          attributes: {
            ...current.attributes,
            variantOfExternalProductId: prior.externalProductId,
            identityConfidence: decision.confidence,
          },
        };
        break;
      }
    }

    if (current.matchClass === "official_matched") accepted.push(current);
    return current;
  });
}
