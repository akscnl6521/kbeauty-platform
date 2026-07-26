/**
 * Admin helper: checkin_email_queue status counts (no PII / no payloads).
 */

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { classifyCareCheckInsProbeError } from "@/lib/admin/care-ops";

export type CheckinEmailQueueStatusCounts = {
  tablesReady: boolean;
  readinessStatus: "ready" | "migration_missing" | "permission_missing" | "query_error";
  note: string;
  counts: Record<string, number>;
  total: number;
};

const STATUS_KEYS = [
  "pending",
  "processing",
  "sent",
  "failed",
  "skipped_duplicate",
  "cancelled",
] as const;

export async function getCheckinEmailQueueStatusCounts(): Promise<CheckinEmailQueueStatusCounts> {
  const empty: CheckinEmailQueueStatusCounts = {
    tablesReady: false,
    readinessStatus: "migration_missing",
    note: "checkin_email_queue not ready",
    counts: Object.fromEntries(STATUS_KEYS.map((k) => [k, 0])),
    total: 0,
  };

  let client;
  try {
    client = createSupabaseAdminClient();
  } catch {
    return { ...empty, readinessStatus: "query_error", note: "admin client unavailable" };
  }

  const { data, error } = await client
    .from("checkin_email_queue")
    .select("status")
    .limit(5000);

  if (error) {
    const readinessStatus = classifyCareCheckInsProbeError(error);
    return {
      ...empty,
      readinessStatus,
      note:
        readinessStatus === "migration_missing"
          ? "checkin_email_queue migration missing"
          : readinessStatus === "permission_missing"
            ? "checkin_email_queue permission missing"
            : "checkin_email_queue query error",
    };
  }

  const counts: Record<string, number> = Object.fromEntries(
    STATUS_KEYS.map((k) => [k, 0])
  );
  let total = 0;
  for (const row of data ?? []) {
    const status = String((row as { status?: string }).status ?? "unknown");
    counts[status] = (counts[status] ?? 0) + 1;
    total += 1;
  }

  return {
    tablesReady: true,
    readinessStatus: "ready",
    note: "status counts only — no PII",
    counts,
    total,
  };
}
