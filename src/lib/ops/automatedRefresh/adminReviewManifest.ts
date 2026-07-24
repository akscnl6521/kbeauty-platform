/**
 * Admin review manifest builder (P3-T03).
 * Read-only artifact — never publishes · never destructive updates.
 */

import { EMPTY_PRIORITY_COUNTS, PRIORITY_RANK } from "./constants";
import type {
  AdminReviewManifest,
  AdminReviewManifestItem,
  DueQueueItem,
  ExceptionQueueItem,
} from "./types";
import { AUTOMATED_REFRESH_TASK_ID } from "./types";

function dueToManifestItem(item: DueQueueItem): AdminReviewManifestItem {
  return {
    id: `${item.entityKind}-refresh-${item.entityId}`,
    source:
      item.entityKind === "product" ? "product_refresh" : "clinic_refresh",
    entityKind: item.entityKind,
    priority: item.priority,
    title:
      item.entityKind === "product"
        ? `제품 갱신: ${item.displayName}`
        : `병원 갱신: ${item.displayName}`,
    reasons: item.reasons,
    dueAt: item.dueAt,
    payload: {
      entityId: item.entityId,
      displayName: item.displayName,
      refreshStatus: item.refreshStatus,
      exceptionKind: null,
      sourceChanged: item.sourceChanged,
      checks: item.checks,
    },
  };
}

function exceptionToManifestItem(
  item: ExceptionQueueItem,
): AdminReviewManifestItem {
  return {
    id: `exception-${item.exceptionId}`,
    source: "exception",
    entityKind: item.entityKind,
    priority: item.priority,
    title: `예외: ${item.displayName} (${item.kind})`,
    reasons: item.reasons,
    dueAt: item.dueAt,
    payload: {
      entityId: item.entityId,
      displayName: item.displayName,
      refreshStatus: null,
      exceptionKind: item.kind,
      sourceChanged: item.sourceChanged,
      checks: [],
    },
  };
}

export function buildAdminReviewManifest(input: {
  runId: string;
  dueItems: DueQueueItem[];
  exceptions: ExceptionQueueItem[];
  now?: Date;
}): AdminReviewManifest {
  const now = input.now ?? new Date();
  const byId = new Map<string, AdminReviewManifestItem>();

  for (const item of input.dueItems) {
    const mapped = dueToManifestItem(item);
    byId.set(mapped.id, mapped);
  }
  for (const item of input.exceptions) {
    const mapped = exceptionToManifestItem(item);
    // Prefer higher priority / keep exception rows distinct
    byId.set(mapped.id, mapped);
  }

  const items = [...byId.values()].sort((a, b) => {
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    return a.id.localeCompare(b.id);
  });

  const byPriority = EMPTY_PRIORITY_COUNTS();
  const bySource: AdminReviewManifest["totals"]["bySource"] = {
    product_refresh: 0,
    clinic_refresh: 0,
    exception: 0,
  };
  for (const item of items) {
    byPriority[item.priority] += 1;
    bySource[item.source] += 1;
  }

  return {
    taskId: AUTOMATED_REFRESH_TASK_ID,
    generatedAt: now.toISOString(),
    runId: input.runId,
    items,
    totals: {
      total: items.length,
      byPriority,
      bySource,
    },
    publishAllowed: false,
    destructiveUpdateAllowed: false,
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
  };
}
