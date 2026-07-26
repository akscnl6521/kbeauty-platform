/**
 * Field provenance helpers — every onboarded field must declare origin.
 * Missing provenance blocks eligibility (no invented completeness).
 */

import type { FieldProvenanceRecord, ProvenanceStatus, SourceKind } from "./types";
import { getSourceTier, isOfficialPrioritySource } from "./sourceManifest";

export const PRODUCT_REQUIRED_PROVENANCE_FIELDS = [
  "brand",
  "product_name",
  "full_ingredients",
  "official_source_url",
] as const;

export const CLINIC_REQUIRED_PROVENANCE_FIELDS = [
  "clinic_name",
  "specialties",
  "address",
  "operating_hours",
  "official_site_url",
  "symptom_tags",
] as const;

export function buildProvenanceRecord(input: {
  fieldKey: string;
  valuePreview?: string | null;
  sourceKind?: SourceKind | null;
  sourceUrl?: string | null;
  status?: ProvenanceStatus;
  verifiedAt?: string | null;
  noteKo?: string | null;
}): FieldProvenanceRecord {
  const kind = input.sourceKind ?? null;
  return {
    fieldKey: input.fieldKey,
    valuePreview: input.valuePreview ?? null,
    sourceKind: kind,
    sourceUrl: input.sourceUrl ?? null,
    sourceTier: kind ? getSourceTier(kind) : null,
    status: input.status ?? (kind ? "unverified" : "missing"),
    verifiedAt: input.verifiedAt ?? null,
    noteKo: input.noteKo ?? null,
  };
}

export function provenanceMapFromList(
  records: FieldProvenanceRecord[],
): Map<string, FieldProvenanceRecord> {
  const map = new Map<string, FieldProvenanceRecord>();
  for (const record of records) {
    const existing = map.get(record.fieldKey);
    if (!existing) {
      map.set(record.fieldKey, record);
      continue;
    }
    // Prefer official / verified over weaker provenance.
    const existingScore =
      (existing.status === "verified" ? 10 : 0) +
      (existing.sourceTier != null ? 5 - existing.sourceTier : 0);
    const nextScore =
      (record.status === "verified" ? 10 : 0) +
      (record.sourceTier != null ? 5 - record.sourceTier : 0);
    if (nextScore > existingScore) map.set(record.fieldKey, record);
  }
  return map;
}

export function missingRequiredProvenance(
  records: FieldProvenanceRecord[],
  required: readonly string[],
): string[] {
  const map = provenanceMapFromList(records);
  const missing: string[] = [];
  for (const key of required) {
    const record = map.get(key);
    if (!record || record.status === "missing" || !record.sourceKind) {
      missing.push(key);
      continue;
    }
    if (record.status === "rejected" || record.status === "conflict") {
      missing.push(key);
    }
  }
  return missing;
}

export function hasOfficialProvenanceForField(
  records: FieldProvenanceRecord[],
  fieldKey: string,
): boolean {
  const record = provenanceMapFromList(records).get(fieldKey);
  if (!record?.sourceKind) return false;
  return (
    isOfficialPrioritySource(record.sourceKind) &&
    (record.status === "verified" || record.status === "unverified")
  );
}

export function summarizeProvenanceCompleteness(
  records: FieldProvenanceRecord[],
  required: readonly string[],
): {
  complete: boolean;
  missingFields: string[];
  staleFields: string[];
  conflictFields: string[];
} {
  const map = provenanceMapFromList(records);
  const missingFields = missingRequiredProvenance(records, required);
  const staleFields: string[] = [];
  const conflictFields: string[] = [];
  for (const key of required) {
    const record = map.get(key);
    if (!record) continue;
    if (record.status === "stale") staleFields.push(key);
    if (record.status === "conflict") conflictFields.push(key);
  }
  return {
    complete: missingFields.length === 0 && conflictFields.length === 0,
    missingFields,
    staleFields,
    conflictFields,
  };
}
