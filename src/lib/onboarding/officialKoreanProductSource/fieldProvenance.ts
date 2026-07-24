/**
 * Field-level provenance builders (P3-T01).
 * Unknown values stay unknown — never invent previews or verified status.
 */

import type {
  FieldProvenanceEntry,
  OfficialKrProductFields,
  OfficialKrProductRawItem,
  OfficialProductSourceKind,
  OfficialSourceTier,
  ProvenanceStatus,
} from "./types";

function preview(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
}

function entry(input: {
  fieldKey: string;
  value: string | null | undefined;
  sourceKind: OfficialProductSourceKind | null;
  sourceUrl: string | null;
  sourceTier: OfficialSourceTier | null;
  verifiedAt: string | null;
  noteKo?: string | null;
  forceStatus?: ProvenanceStatus;
}): FieldProvenanceEntry {
  const valuePreview = preview(input.value);
  const status: ProvenanceStatus =
    input.forceStatus ??
    (valuePreview == null ? "unknown" : "present");
  return {
    fieldKey: input.fieldKey,
    valuePreview,
    sourceKind: input.sourceKind,
    sourceUrl: input.sourceUrl,
    sourceTier: input.sourceTier,
    status,
    verifiedAt: valuePreview == null ? null : input.verifiedAt,
    noteKo: input.noteKo ?? null,
  };
}

export function buildFieldProvenance(
  raw: OfficialKrProductRawItem,
  fields: OfficialKrProductFields,
): FieldProvenanceEntry[] {
  const kind = raw.sourceKind;
  const tier = raw.sourceTier;
  const verifiedAt = raw.sourceVerifiedAt;
  const brandUrl = raw.brandOfficialUrl;
  const mallUrl = raw.officialMallUrl;
  const inciUrl = raw.inciDisclosureUrl;

  const rows: FieldProvenanceEntry[] = [
    entry({
      fieldKey: "brandName",
      value: fields.brandName,
      sourceKind: kind,
      sourceUrl: brandUrl,
      sourceTier: tier,
      verifiedAt,
      noteKo: "공식 브랜드명 — 번역·발명 금지",
    }),
    entry({
      fieldKey: "productNameKo",
      value: fields.productNameKo,
      sourceKind: kind,
      sourceUrl: brandUrl ?? mallUrl,
      sourceTier: tier,
      verifiedAt,
    }),
    entry({
      fieldKey: "productNameEn",
      value: fields.productNameEn,
      sourceKind: kind,
      sourceUrl: brandUrl,
      sourceTier: tier,
      verifiedAt,
    }),
    entry({
      fieldKey: "category",
      value: fields.category,
      sourceKind: kind,
      sourceUrl: brandUrl ?? mallUrl,
      sourceTier: tier,
      verifiedAt,
    }),
    entry({
      fieldKey: "fullIngredients",
      value: fields.fullIngredients,
      sourceKind: fields.fullIngredients
        ? "official_inci_disclosure"
        : kind,
      sourceUrl: inciUrl ?? brandUrl,
      sourceTier: fields.fullIngredients ? 1 : tier,
      verifiedAt,
      noteKo: fields.fullIngredients
        ? "공식 전성분 공개"
        : "전성분 미확인 — unknown 유지",
      forceStatus: fields.fullIngredients ? "present" : "missing",
    }),
    entry({
      fieldKey: "volumeLabel",
      value: fields.volumeLabel,
      sourceKind: kind,
      sourceUrl: brandUrl ?? mallUrl,
      sourceTier: tier,
      verifiedAt,
    }),
    entry({
      fieldKey: "brandOfficialUrl",
      value: fields.brandOfficialUrl,
      sourceKind: "brand_official_page",
      sourceUrl: brandUrl,
      sourceTier: 1,
      verifiedAt,
      forceStatus: fields.brandOfficialUrl ? "present" : "missing",
    }),
    entry({
      fieldKey: "officialMallUrl",
      value: fields.officialMallUrl,
      sourceKind: "official_kr_mall_page",
      sourceUrl: mallUrl,
      sourceTier: 1,
      verifiedAt,
      forceStatus: fields.officialMallUrl ? "present" : "unknown",
    }),
    entry({
      fieldKey: "inciDisclosureUrl",
      value: fields.inciDisclosureUrl,
      sourceKind: "official_inci_disclosure",
      sourceUrl: inciUrl,
      sourceTier: 1,
      verifiedAt,
      forceStatus: fields.inciDisclosureUrl ? "present" : "missing",
    }),
    entry({
      fieldKey: "variants",
      value:
        raw.variants.length > 0
          ? `${raw.variants.length} variant(s)`
          : null,
      sourceKind: kind,
      sourceUrl: brandUrl ?? mallUrl,
      sourceTier: tier,
      verifiedAt,
      forceStatus: raw.variants.length > 0 ? "present" : "unknown",
      noteKo: "미확인 변형은 빈 목록 유지",
    }),
    entry({
      fieldKey: "images",
      value:
        raw.images.length > 0 ? `${raw.images.length} image(s)` : null,
      sourceKind: kind,
      sourceUrl: brandUrl,
      sourceTier: tier,
      verifiedAt,
      forceStatus: raw.images.length > 0 ? "present" : "unknown",
    }),
    entry({
      fieldKey: "offers.price",
      value:
        raw.offers.find((o) => o.price != null)?.price?.toString() ?? null,
      sourceKind:
        raw.offers.some((o) => o.isOfficial)
          ? "official_kr_mall_page"
          : kind,
      sourceUrl: mallUrl ?? brandUrl,
      sourceTier: tier,
      verifiedAt,
      forceStatus: raw.offers.some((o) => o.price != null)
        ? "present"
        : "unknown",
      noteKo: "가격 미발명 — 확인된 공식 가격만",
    }),
    entry({
      fieldKey: "offers.stockStatus",
      value:
        raw.offers.find((o) => o.stockStatus !== "unknown")?.stockStatus ??
        null,
      sourceKind: kind,
      sourceUrl: mallUrl,
      sourceTier: tier,
      verifiedAt,
      forceStatus: raw.offers.some((o) => o.stockStatus !== "unknown")
        ? "present"
        : "unknown",
    }),
    entry({
      fieldKey: "offers.shipsToCountries",
      value:
        raw.offers.flatMap((o) => o.shipsToCountries).join("|") || null,
      sourceKind: kind,
      sourceUrl: mallUrl,
      sourceTier: tier,
      verifiedAt,
      forceStatus: raw.offers.some((o) => o.shipsToCountries.length > 0)
        ? "present"
        : "unknown",
      noteKo: "국가 가용성 미발명",
    }),
    entry({
      fieldKey: "usageGuidance",
      value: raw.usageGuidance?.complete
        ? "complete"
        : raw.usageGuidance
          ? "partial"
          : null,
      sourceKind: kind,
      sourceUrl: raw.usageGuidance?.sourceUrl ?? brandUrl,
      sourceTier: tier,
      verifiedAt,
      forceStatus: raw.usageGuidance ? "present" : "unknown",
    }),
  ];

  return rows;
}

export function countUnknownProvenance(
  provenance: FieldProvenanceEntry[],
): number {
  return provenance.filter(
    (p) => p.status === "unknown" || p.status === "missing",
  ).length;
}
