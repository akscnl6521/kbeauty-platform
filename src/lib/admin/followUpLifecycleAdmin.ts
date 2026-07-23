/**
 * Admin-facing follow-up lifecycle visibility (counts only · no PII).
 */

import {
  summarizeDeliveryRecords,
  type FollowUpDeliveryRecord,
} from "@/lib/retention/followUpDelivery";
import type { FollowUpLifecycleSnapshot } from "@/lib/retention/followUpLifecycle";

export type FollowUpLifecycleAdminSummary = {
  analysisSessions: number;
  byPhase: Record<string, number>;
  checkInsByStatus: Record<string, number>;
  checkInsByDay: Record<string, number>;
  delivery: ReturnType<typeof summarizeDeliveryRecords>;
  redFlagEscalations: number;
  routineAdjustmentsProposed: number;
  persistenceFallbackCount: number;
  realDeliveryClaimed: false;
  note: string;
};

export function buildFollowUpLifecycleAdminSummary(
  snapshots: FollowUpLifecycleSnapshot[]
): FollowUpLifecycleAdminSummary {
  const byPhase: Record<string, number> = {};
  const checkInsByStatus: Record<string, number> = {};
  const checkInsByDay: Record<string, number> = {};
  const records: FollowUpDeliveryRecord[] = [];
  let redFlagEscalations = 0;
  let routineAdjustmentsProposed = 0;
  let persistenceFallbackCount = 0;

  for (const snap of snapshots) {
    byPhase[snap.phase] = (byPhase[snap.phase] ?? 0) + 1;
    if (snap.persistenceSource === "fallback_empty") {
      persistenceFallbackCount += 1;
    }
    if (snap.lastEscalation?.escalate) redFlagEscalations += 1;
    if (
      snap.lastAdjustment?.primary &&
      snap.lastAdjustment.primary.type !== "keep_current" &&
      snap.lastAdjustment.primary.type !== "record_only"
    ) {
      routineAdjustmentsProposed += 1;
    }
    for (const c of snap.checkIns) {
      checkInsByStatus[c.status] = (checkInsByStatus[c.status] ?? 0) + 1;
      const dayKey = `day${c.day}`;
      checkInsByDay[dayKey] = (checkInsByDay[dayKey] ?? 0) + 1;
    }
    records.push(...snap.deliveryRecords);
  }

  return {
    analysisSessions: snapshots.length,
    byPhase,
    checkInsByStatus,
    checkInsByDay,
    delivery: summarizeDeliveryRecords(records),
    redFlagEscalations,
    routineAdjustmentsProposed,
    persistenceFallbackCount,
    realDeliveryClaimed: false,
    note:
      "집계만 표시 · PII 없음 · 실발송(email/SMS/push) 미주장 · dry-run/live_blocked 상태만",
  };
}

/** In-memory store for Preview/admin dry visibility (no DB). */
const memorySnapshots = new Map<string, FollowUpLifecycleSnapshot>();

export function upsertFollowUpLifecycleAdminMemory(
  snapshot: FollowUpLifecycleSnapshot
): void {
  memorySnapshots.set(snapshot.analysisSessionId, snapshot);
}

export function listFollowUpLifecycleAdminMemory(): FollowUpLifecycleSnapshot[] {
  return Array.from(memorySnapshots.values());
}

export function clearFollowUpLifecycleAdminMemory(): void {
  memorySnapshots.clear();
}

export function getFollowUpLifecycleAdminSummaryFromMemory(): FollowUpLifecycleAdminSummary {
  return buildFollowUpLifecycleAdminSummary(listFollowUpLifecycleAdminMemory());
}
