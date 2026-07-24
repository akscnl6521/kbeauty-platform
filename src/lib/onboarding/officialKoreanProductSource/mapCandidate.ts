/**
 * Map raw manifest items → candidate records (P3-T01).
 * Unknown fields stay null. Never invent price/stock/country.
 */

import { createHash } from "node:crypto";
import { buildFieldProvenance, countUnknownProvenance } from "./fieldProvenance";
import { evaluatePolicyFilters } from "./eligibility";
import type {
  OfficialKrProductCandidate,
  OfficialKrProductFields,
  OfficialKrProductRawItem,
} from "./types";

export function buildCandidateId(raw: OfficialKrProductRawItem): string {
  const basis = [
    raw.sourceId,
    raw.brandName ?? "",
    raw.productNameKo ?? "",
    raw.volumeLabel ?? "",
    raw.brandOfficialUrl ?? raw.officialMallUrl ?? "",
  ].join("|");
  const hash = createHash("sha256").update(basis).digest("hex").slice(0, 12);
  return `p3t01-${hash}`;
}

export function mapRawToFields(
  raw: OfficialKrProductRawItem,
  collectedAt: string,
): OfficialKrProductFields {
  return {
    brandName: raw.brandName?.trim() || null,
    productNameKo: raw.productNameKo?.trim() || null,
    productNameEn: raw.productNameEn?.trim() || null,
    category: raw.category?.trim() || null,
    fullIngredients: raw.fullIngredients?.trim() || null,
    volumeLabel: raw.volumeLabel?.trim() || null,
    brandOfficialUrl: raw.brandOfficialUrl?.trim() || null,
    officialMallUrl: raw.officialMallUrl?.trim() || null,
    inciDisclosureUrl: raw.inciDisclosureUrl?.trim() || null,
    collectedAt,
    sourceVerifiedAt: raw.sourceVerifiedAt,
  };
}

export function mapRawToCandidate(
  raw: OfficialKrProductRawItem,
  collectedAt: string,
): OfficialKrProductCandidate {
  const fields = mapRawToFields(raw, collectedAt);
  const provenance = buildFieldProvenance(raw, fields);
  const policy = evaluatePolicyFilters(raw);
  const candidateId = buildCandidateId(raw);

  let status = policy.status;
  if (!policy.pass && policy.status === "blocked_policy") {
    status = "blocked_policy";
  } else if (!policy.pass) {
    status = "filtered_out";
  } else if (raw.isFixture) {
    status = "needs_review";
  } else {
    // Structurally complete non-fixture → candidate_ready (still non-public)
    const complete =
      Boolean(fields.brandName) &&
      Boolean(fields.productNameKo) &&
      Boolean(fields.fullIngredients) &&
      (Boolean(fields.brandOfficialUrl) ||
        Boolean(fields.officialMallUrl) ||
        Boolean(fields.inciDisclosureUrl));
    status = complete ? "candidate_ready" : "needs_review";
  }

  return {
    candidateId,
    status,
    fields,
    variants: raw.variants.map((v) => ({
      ...v,
      sizeLabel: v.sizeLabel ?? null,
      shadeLabel: v.shadeLabel ?? null,
      sku: v.sku ?? null,
      barcode: v.barcode ?? null,
    })),
    images: raw.images.map((img) => ({
      ...img,
      sourceUrl: img.sourceUrl ?? null,
    })),
    offers: raw.offers.map((o) => ({
      ...o,
      retailerName: o.retailerName ?? null,
      retailerCountry: o.retailerCountry ?? null,
      shipsToCountries: [...o.shipsToCountries],
      purchaseUrl: o.purchaseUrl ?? null,
      price: o.price ?? null,
      currency: o.currency ?? null,
      lastCheckedAt: o.lastCheckedAt ?? null,
    })),
    usageGuidance: raw.usageGuidance
      ? {
          ...raw.usageGuidance,
          amountHint: raw.usageGuidance.amountHint ?? null,
          orderHint: raw.usageGuidance.orderHint ?? null,
          frequencyHint: raw.usageGuidance.frequencyHint ?? null,
          cautions: [...raw.usageGuidance.cautions],
          patchTestRecommended: raw.usageGuidance.patchTestRecommended,
          sourceUrl: raw.usageGuidance.sourceUrl ?? null,
        }
      : null,
    provenance,
    reviewReasons: [...policy.reasons],
    filterReasons: policy.pass ? [] : [...policy.reasons],
    duplicateOf: null,
    sourceKind: raw.sourceKind,
    accessMode: raw.accessMode,
    sourceTier: raw.sourceTier,
    isFixture: raw.isFixture,
    publishAllowed: false,
    publicVisible: false,
  };
}

export function tallyUnknownFields(
  candidates: OfficialKrProductCandidate[],
): number {
  return candidates.reduce(
    (sum, c) => sum + countUnknownProvenance(c.provenance),
    0,
  );
}
