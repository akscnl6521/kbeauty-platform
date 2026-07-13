/**
 * Care worker tasks (idempotent). Cursor must not execute these against prod.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshCheckInStatuses } from "@/lib/care/schedule";
import type { CareCheckIn } from "@/lib/care/types";

export type CareWorkerResult = {
  attempted: string[];
  applied: string[];
  skipped: string[];
  counts: Record<string, number>;
};

/**
 * When care tables exist: mark due/expired check-ins.
 * If tables are missing, skip safely.
 */
export async function runCareWorkerTick(
  client: SupabaseClient
): Promise<CareWorkerResult> {
  const result: CareWorkerResult = {
    attempted: ["refresh_checkin_status"],
    applied: [],
    skipped: [],
    counts: {},
  };

  const nowIso = new Date().toISOString();

  const { error: probe } = await client
    .from("care_check_ins")
    .select("id")
    .limit(1);

  if (probe) {
    result.skipped.push("care_tables_missing");
    return result;
  }

  const { data: rows, error } = await client
    .from("care_check_ins")
    .select("id, status, due_at, completed_at")
    .in("status", ["scheduled", "due"])
    .limit(500);

  if (error) {
    result.skipped.push("select_failed");
    return result;
  }

  const mapped: CareCheckIn[] = (rows ?? []).map((r) => {
    const row = r as {
      id: string;
      status: CareCheckIn["status"];
      due_at: string;
      completed_at: string | null;
    };
    return {
      id: String(row.id),
      analysisSessionId: "",
      routineId: null,
      day: 3,
      status: row.status,
      scheduledFor: String(row.due_at),
      dueAt: String(row.due_at),
      completedAt: row.completed_at,
      timezone: "Asia/Seoul",
      answers: null,
      progressDelta: null,
      referralLevel: "none",
      suggestionIds: [],
    };
  });

  const refreshed = refreshCheckInStatuses(mapped, nowIso);
  let due = 0;
  let expired = 0;
  for (const c of refreshed) {
    if (c.status === "due" || c.status === "expired") {
      const { error: upErr } = await client
        .from("care_check_ins")
        .update({ status: c.status, updated_at: nowIso })
        .eq("id", c.id)
        .in("status", ["scheduled", "due"]);
      if (!upErr) {
        if (c.status === "due") due += 1;
        if (c.status === "expired") expired += 1;
      }
    }
  }

  result.applied.push("refresh_checkin_status");
  result.counts.due = due;
  result.counts.expired = expired;
  return result;
}
