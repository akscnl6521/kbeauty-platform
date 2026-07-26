/**
 * Exception prioritization for refresh failures / source changes (P3-T03).
 */

import { PRIORITY_RANK } from "./constants";
import type {
  ExceptionKind,
  ExceptionQueueItem,
  RefreshEntityRecord,
  RefreshPriority,
  SourceChangeDiff,
} from "./types";

const BASE_SCORE: Record<ExceptionKind, number> = {
  source_changed: 92,
  conflict: 90,
  source_unavailable: 88,
  discontinued_suspect: 84,
  refresh_failed: 78,
  stale_evidence: 70,
  missing_required_field: 62,
  manual_review_required: 55,
};

function priorityForScore(score: number): RefreshPriority {
  if (score >= 90) return "critical";
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function reviewGroupFor(
  entityKind: RefreshEntityRecord["entityKind"],
  kind: ExceptionKind,
): ExceptionQueueItem["reviewGroup"] {
  if (entityKind === "clinic") return "clinic";
  if (kind === "source_changed" || kind === "source_unavailable") return "source";
  if (kind === "discontinued_suspect" || kind === "conflict") return "identity";
  if (kind === "missing_required_field") return "content";
  return "commerce";
}

function kindsFor(
  entity: RefreshEntityRecord,
  diff: SourceChangeDiff | undefined,
): ExceptionKind[] {
  const kinds: ExceptionKind[] = [];
  if (diff?.changed || entity.sourceChanged) kinds.push("source_changed");
  if (entity.refreshStatus === "source_unavailable") {
    kinds.push("source_unavailable");
  }
  if (entity.refreshStatus === "refresh_failed") kinds.push("refresh_failed");
  if (
    entity.refreshStatus === "verification_required" ||
    entity.refreshStatus === "stale_but_usable"
  ) {
    kinds.push("stale_evidence");
  }
  if (entity.discontinued) kinds.push("discontinued_suspect");
  if (entity.manualReviewRequired) kinds.push("manual_review_required");
  if (
    entity.currentSource == null ||
    (entity.entityKind === "product" &&
      !entity.currentSource?.ingredientsFingerprint &&
      !entity.currentSource?.officialUrl)
  ) {
    kinds.push("missing_required_field");
  }
  if (diff?.reviewReasons.includes("ingredients_changed")) {
    kinds.push("conflict");
  }
  return [...new Set(kinds)];
}

export function prioritizeExceptions(input: {
  entities: RefreshEntityRecord[];
  diffs?: SourceChangeDiff[];
}): ExceptionQueueItem[] {
  const diffById = new Map(
    (input.diffs ?? []).map((d) => [d.entityId, d] as const),
  );
  const out: ExceptionQueueItem[] = [];

  for (const entity of input.entities) {
    const diff = diffById.get(entity.entityId);
    const kinds = kindsFor(entity, diff);
    if (kinds.length === 0) continue;

    for (const kind of kinds) {
      let score = BASE_SCORE[kind];
      if (entity.failureCount >= 3) score += 8;
      if (entity.entityKind === "clinic" && kind === "source_unavailable") {
        score += 4;
      }
      score = Math.min(99, score);
      const priority = priorityForScore(score);
      const reasons = [
        kind,
        ...(diff?.reviewReasons ?? []),
        ...(entity.manualReviewRequired ? ["manual_review_required"] : []),
        ...(entity.failureCount > 0
          ? [`failure_count_${entity.failureCount}`]
          : []),
      ];

      out.push({
        exceptionId: `${entity.entityKind}:${entity.entityId}:${kind}`,
        entityId: entity.entityId,
        entityKind: entity.entityKind,
        displayName: entity.displayName,
        kind,
        priority,
        score,
        reasons: [...new Set(reasons)],
        sourceChanged: entity.sourceChanged || Boolean(diff?.changed),
        failureCount: entity.failureCount,
        dueAt: entity.refreshDueAt,
        reviewGroup: reviewGroupFor(entity.entityKind, kind),
      });
    }
  }

  return out.sort((a, b) => {
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    if (b.score !== a.score) return b.score - a.score;
    return a.exceptionId.localeCompare(b.exceptionId);
  });
}
