/**
 * Care worker tasks (idempotent). Cursor must not execute these against prod.
 */

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  buildCheckInDueNotification,
  checkInDueFingerprint,
} from "@/lib/care/notifications";
import { refreshCheckInStatuses } from "@/lib/care/schedule";
import type { CareCheckIn } from "@/lib/care/types";

export type CareWorkerResult = {
  attempted: string[];
  applied: string[];
  skipped: string[];
  counts: Record<string, number>;
};

async function writeCareAuditEvent(
  eventType: string,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("care_audit_events").insert({
      event_type: eventType,
      meta: meta ?? {},
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    if (e instanceof AdminConfigurationError) return;
  }
}

/**
 * When care tables exist: mark due/expired check-ins and create due notifications.
 * If tables are missing, skip safely.
 */
export async function runCareWorkerTick(
  client: SupabaseClient
): Promise<CareWorkerResult> {
  const result: CareWorkerResult = {
    attempted: [
      "refresh_checkin_status",
      "create_due_notifications",
      "audit_events",
    ],
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
    .select(
      "id, user_id, status, due_at, completed_at, day, analysis_session_id, routine_id, timezone"
    )
    .in("status", ["scheduled", "due"])
    .limit(500);

  if (error) {
    result.skipped.push("select_failed");
    return result;
  }

  const mapped: CareCheckIn[] = (rows ?? []).map((r) => {
    const row = r as {
      id: string;
      user_id: string | null;
      status: CareCheckIn["status"];
      due_at: string;
      completed_at: string | null;
      day: CareCheckIn["day"];
      analysis_session_id: string;
      routine_id: string | null;
      timezone: string;
    };
    return {
      id: String(row.id),
      analysisSessionId: row.analysis_session_id,
      routineId: row.routine_id,
      day: row.day,
      status: row.status,
      scheduledFor: String(row.due_at),
      dueAt: String(row.due_at),
      completedAt: row.completed_at,
      timezone: row.timezone ?? "Asia/Seoul",
      answers: null,
      progressDelta: null,
      referralLevel: "none",
      suggestionIds: [],
    };
  });

  const refreshed = refreshCheckInStatuses(mapped, nowIso);
  let due = 0;
  let expired = 0;
  let notificationsCreated = 0;

  for (const c of refreshed) {
    const original = mapped.find((m) => m.id === c.id);
    if (!original || original.status === c.status) continue;

    if (c.status === "completed" || c.status === "skipped") continue;

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

  const dueRows = refreshed.filter((c) => c.status === "due");
  for (const checkIn of dueRows) {
    const row = (rows ?? []).find(
      (r) => (r as { id: string }).id === checkIn.id
    ) as { user_id: string | null } | undefined;
    if (!row?.user_id) continue;

    const notif = buildCheckInDueNotification(checkIn, () => checkIn.id);
    const fingerprint = checkInDueFingerprint(checkIn.id);

    const { error: nErr } = await client.from("care_notifications").upsert(
      {
        id: randomUUID(),
        user_id: row.user_id,
        check_in_id: checkIn.id,
        notification_type: "checkin_due",
        kind: notif.kind,
        title: notif.title,
        message: notif.message,
        related_check_in_id: checkIn.id,
        fingerprint,
        status: "unread",
        read: false,
        due_at: checkIn.dueAt,
        created_at: nowIso,
      },
      { onConflict: "fingerprint", ignoreDuplicates: true }
    );

    if (!nErr) notificationsCreated += 1;
  }

  result.applied.push("refresh_checkin_status");
  if (notificationsCreated > 0) {
    result.applied.push("create_due_notifications");
  } else {
    result.skipped.push("no_new_due_notifications");
  }

  result.counts.due = due;
  result.counts.expired = expired;
  result.counts.notifications = notificationsCreated;

  await writeCareAuditEvent("worker_tick", {
    due,
    expired,
    notifications: notificationsCreated,
  });
  result.applied.push("audit_events");

  console.info(
    `[care-worker] due=${due} expired=${expired} notifications=${notificationsCreated}`
  );

  return result;
}
