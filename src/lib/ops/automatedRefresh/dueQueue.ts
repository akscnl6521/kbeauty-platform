/**
 * Unified due queues for product + clinic refresh (P3-T03).
 */

import { EMPTY_PRIORITY_COUNTS, PRIORITY_RANK } from "./constants";
import { buildRetryBackoffPlan } from "./retryBackoff";
import { applyStaleStatus, detectStale } from "./staleDetection";
import type {
  DueQueueArtifact,
  DueQueueItem,
  RefreshEntityKind,
  RefreshEntityRecord,
  RefreshPriority,
  RefreshStatus,
} from "./types";

function defaultChecks(kind: RefreshEntityKind): string[] {
  return kind === "product"
    ? ["official_page", "full_inci", "image", "stock_price"]
    : ["operating_status", "official_site", "specialties", "evidence"];
}

function priorityFor(input: {
  status: RefreshStatus;
  failureCount: number;
  sourceChanged: boolean;
  manualReviewRequired: boolean;
  hardStale: boolean;
}): RefreshPriority {
  if (
    input.status === "blocked" ||
    input.status === "source_unavailable" ||
    input.failureCount >= 3
  ) {
    return "critical";
  }
  if (
    input.status === "refresh_failed" ||
    input.sourceChanged ||
    input.manualReviewRequired ||
    input.hardStale ||
    input.status === "verification_required"
  ) {
    return "high";
  }
  if (input.status === "refresh_due" || input.status === "stale_but_usable") {
    return "medium";
  }
  return "low";
}

function reasonsFor(
  entity: RefreshEntityRecord,
  now: Date,
): string[] {
  const reasons: string[] = [];
  const stale = detectStale(entity, now);
  reasons.push(...stale.reasons);
  if (entity.refreshStatus === "refresh_due") reasons.push("refresh_due");
  if (entity.refreshStatus === "refresh_failed") reasons.push("refresh_failed");
  if (entity.refreshStatus === "source_unavailable") {
    reasons.push("source_unavailable");
  }
  if (entity.sourceChanged) reasons.push("source_changed");
  if (entity.manualReviewRequired) reasons.push("manual_review_required");
  if (entity.failureCount > 0) reasons.push(`failure_count_${entity.failureCount}`);
  return [...new Set(reasons)];
}

export function toDueQueueItem(
  entity: RefreshEntityRecord,
  now: Date = new Date(),
): DueQueueItem | null {
  const normalized = applyStaleStatus(entity, now);
  const dueAt =
    normalized.refreshDueAt ??
    (normalized.lastFailureAt
      ? buildRetryBackoffPlan({
          failureCount: normalized.failureCount,
          now,
        }).nextRetryAt
      : now.toISOString());

  const dueMs = Date.parse(dueAt);
  const isDue =
    Number.isFinite(dueMs) &&
    dueMs <= now.getTime() &&
    normalized.refreshStatus !== "current" &&
    normalized.refreshStatus !== "discontinued";

  const forceException =
    normalized.sourceChanged ||
    normalized.manualReviewRequired ||
    normalized.refreshStatus === "refresh_failed" ||
    normalized.refreshStatus === "source_unavailable" ||
    normalized.refreshStatus === "verification_required" ||
    normalized.refreshStatus === "blocked";

  if (!isDue && !forceException) return null;

  const stale = detectStale(normalized, now);
  const priority = priorityFor({
    status: normalized.refreshStatus,
    failureCount: normalized.failureCount,
    sourceChanged: normalized.sourceChanged,
    manualReviewRequired: normalized.manualReviewRequired,
    hardStale: stale.isHardStale,
  });

  const retry =
    normalized.failureCount > 0
      ? buildRetryBackoffPlan({
          failureCount: normalized.failureCount,
          now,
          retryable: normalized.refreshStatus !== "blocked",
        })
      : null;

  return {
    entityId: normalized.entityId,
    entityKind: normalized.entityKind,
    displayName: normalized.displayName,
    priority,
    refreshStatus: normalized.refreshStatus,
    dueAt,
    reasons: reasonsFor(normalized, now),
    checks: defaultChecks(normalized.entityKind),
    failureCount: normalized.failureCount,
    nextRetryAt: retry && !retry.exhausted ? retry.nextRetryAt : null,
    sourceChanged: normalized.sourceChanged,
    manualReviewRequired: normalized.manualReviewRequired,
  };
}

export function buildDueQueue(
  entities: RefreshEntityRecord[],
  input?: {
    now?: Date;
    entityKind?: RefreshEntityKind | "unified";
    scheduleHint?: string;
  },
): DueQueueArtifact {
  const now = input?.now ?? new Date();
  const filtered =
    input?.entityKind && input.entityKind !== "unified"
      ? entities.filter((e) => e.entityKind === input.entityKind)
      : entities;

  const items = filtered
    .map((e) => toDueQueueItem(e, now))
    .filter((item): item is DueQueueItem => item != null)
    .sort((a, b) => {
      const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (p !== 0) return p;
      return a.dueAt.localeCompare(b.dueAt);
    });

  const byPriority = EMPTY_PRIORITY_COUNTS();
  const byKind: Record<RefreshEntityKind, number> = {
    product: 0,
    clinic: 0,
  };
  for (const item of items) {
    byPriority[item.priority] += 1;
    byKind[item.entityKind] += 1;
  }

  return {
    entityKind: input?.entityKind ?? "unified",
    generatedAt: now.toISOString(),
    cutoffAt: now.toISOString(),
    scheduleHint:
      input?.scheduleHint ??
      "artifact_only_no_production_schedule",
    items,
    totals: {
      due: items.length,
      byPriority,
      byKind,
    },
  };
}
