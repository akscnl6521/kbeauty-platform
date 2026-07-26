/**
 * Source-change diffs for refresh review (P3-T03).
 */

import type {
  RefreshEntityRecord,
  SourceChangeDiff,
  SourceFieldChange,
  SourceSnapshot,
} from "./types";

const HIGH_IMPACT_FIELDS: Array<keyof SourceSnapshot> = [
  "ingredientsFingerprint",
  "officialUrl",
  "operatingStatus",
  "evidenceFingerprint",
  "name",
];

function normalizeValue(
  value: string | number | boolean | null | undefined,
): string | number | boolean | null {
  if (value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  return value;
}

export function diffSourceSnapshots(
  before: SourceSnapshot | null,
  after: SourceSnapshot | null,
): SourceFieldChange[] {
  const left = before ?? {
    name: null,
    officialUrl: null,
    priceAmount: null,
    currency: null,
    inStock: null,
    ingredientsFingerprint: null,
    imageUrl: null,
    operatingStatus: null,
    specialtyCount: null,
    evidenceFingerprint: null,
  };
  const right = after ?? left;
  const fields = Object.keys(left) as Array<keyof SourceSnapshot>;
  const changes: SourceFieldChange[] = [];

  for (const field of fields) {
    const a = normalizeValue(left[field]);
    const b = normalizeValue(right[field]);
    if (a !== b) {
      changes.push({ field, before: a, after: b });
    }
  }
  return changes;
}

export function buildSourceChangeDiff(
  entity: RefreshEntityRecord,
): SourceChangeDiff {
  const changes = diffSourceSnapshots(
    entity.previousSource,
    entity.currentSource,
  );
  const changed = changes.length > 0 || entity.sourceChanged;
  const highImpact = changes.some((c) => HIGH_IMPACT_FIELDS.includes(c.field));
  const reviewReasons: string[] = [];

  if (changed) reviewReasons.push("source_snapshot_diff");
  if (highImpact) reviewReasons.push("high_impact_field_changed");
  if (entity.manualReviewRequired) reviewReasons.push("manual_review_flag");
  if (
    changes.some((c) => c.field === "ingredientsFingerprint")
  ) {
    reviewReasons.push("ingredients_changed");
  }
  if (changes.some((c) => c.field === "operatingStatus")) {
    reviewReasons.push("operating_status_changed");
  }

  return {
    entityId: entity.entityId,
    entityKind: entity.entityKind,
    changed,
    changes,
    requiresManualReview:
      highImpact || entity.manualReviewRequired || entity.sourceChanged,
    reviewReasons: [...new Set(reviewReasons)],
  };
}

export function buildSourceChangeDiffs(
  entities: RefreshEntityRecord[],
): SourceChangeDiff[] {
  return entities.map(buildSourceChangeDiff);
}
