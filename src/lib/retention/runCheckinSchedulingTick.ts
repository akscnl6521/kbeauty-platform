/**
 * Run check-in scheduling tick: in-app due notifications + email enqueue (no live send).
 */

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCheckInDueNotification,
  checkInDueFingerprint,
} from "@/lib/care/notifications";
import type { CareCheckIn, CareUserSettings } from "@/lib/care/types";
import { normalizeCareUserSettings } from "@/lib/care/settingsDefaults";
import {
  enqueueCheckinEmail,
  type CheckinEmailQueueDb,
} from "@/lib/retention/checkinEmailQueuePersistence";
import {
  orchestrateCheckinScheduling,
  type CheckinSchedulingSettingsInput,
} from "@/lib/retention/checkinSchedulingOrchestrator";
import { maskEmailAddress } from "@/lib/retention/checkinEmailQueuePolicy";

export type CheckinSchedulingTickDeps = {
  loadUserSettings?: (userId: string) => Promise<CareUserSettings | null>;
  loadUserEmail?: (userId: string) => Promise<string | null>;
  loadEmailIdempotencyKeys?: (userId: string) => Promise<string[]>;
  now?: Date;
};

export type CheckinSchedulingTickResult = {
  attempted: string[];
  applied: string[];
  skipped: string[];
  counts: Record<string, number>;
};

function isMissingRelationError(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("could not find the table") ||
    m.includes("relation") && m.includes("exist") ||
    m.includes("pgrst205")
  );
}

async function loadExistingNotificationFingerprints(
  client: SupabaseClient,
  userId: string,
  checkInIds: string[]
): Promise<string[]> {
  if (checkInIds.length === 0) return [];
  const { data, error } = await client
    .from("care_notifications")
    .select("fingerprint")
    .eq("user_id", userId)
    .in(
      "fingerprint",
      checkInIds.map((id) => checkInDueFingerprint(id))
    );
  if (error) return [];
  return (data ?? [])
    .map((r) => String((r as { fingerprint?: string }).fingerprint ?? ""))
    .filter(Boolean);
}

async function loadQueueKeysForUser(
  client: SupabaseClient,
  userId: string
): Promise<{ keys: string[]; tableMissing: boolean }> {
  const { data, error } = await client
    .from("checkin_email_queue")
    .select("idempotency_key, kind, checkin_id, status")
    .eq("user_id", userId)
    .limit(500);

  if (error) {
    if (isMissingRelationError(error.message) || error.code === "PGRST205" || error.code === "42P01") {
      return { keys: [], tableMissing: true };
    }
    return { keys: [], tableMissing: false };
  }

  const keys: string[] = [];
  for (const row of data ?? []) {
    const r = row as {
      idempotency_key?: string;
      kind?: string;
      checkin_id?: string;
      status?: string;
    };
    if (r.idempotency_key) keys.push(r.idempotency_key);
    if (
      r.kind === "checkin_reminder" &&
      (r.status === "sent" || r.status === "pending" || r.status === "processing") &&
      r.checkin_id
    ) {
      keys.push("sent-reminder:" + String(r.checkin_id).toLowerCase());
    }
  }
  return { keys, tableMissing: false };
}

/**
 * For due check-ins with user_id: decide in-app + email, enqueue eligible emails only.
 * Never calls a live email provider.
 */
export async function runCheckinSchedulingTick(
  client: SupabaseClient,
  dueCheckIns: Array<CareCheckIn & { userId?: string | null }>,
  deps: CheckinSchedulingTickDeps = {}
): Promise<CheckinSchedulingTickResult> {
  const result: CheckinSchedulingTickResult = {
    attempted: ["checkin_scheduling_orchestrator", "enqueue_checkin_email"],
    applied: [],
    skipped: [],
    counts: {
      users: 0,
      in_app: 0,
      email_due_enqueued: 0,
      email_reminder_enqueued: 0,
      email_skipped: 0,
    },
  };

  const now = deps.now ?? new Date();
  const byUser = new Map<string, CareCheckIn[]>();
  for (const c of dueCheckIns) {
    const uid = c.userId;
    if (!uid) continue;
    const list = byUser.get(uid) ?? [];
    list.push(c);
    byUser.set(uid, list);
  }

  if (byUser.size === 0) {
    result.skipped.push("no_due_with_user");
    return result;
  }

  let queueTableMissing = false;

  for (const [userId, checkIns] of byUser) {
    result.counts.users += 1;

    const settingsRaw = deps.loadUserSettings
      ? await deps.loadUserSettings(userId)
      : null;
    const settings = normalizeCareUserSettings(
      settingsRaw ?? undefined,
      checkIns[0]?.timezone || "Asia/Seoul"
    );

    const email = deps.loadUserEmail
      ? (await deps.loadUserEmail(userId)) ?? ""
      : "";

    const fingerprints = await loadExistingNotificationFingerprints(
      client,
      userId,
      checkIns.map((c) => c.id)
    );

    let emailKeys: string[] = [];
    if (deps.loadEmailIdempotencyKeys) {
      emailKeys = await deps.loadEmailIdempotencyKeys(userId);
    } else {
      const loaded = await loadQueueKeysForUser(client, userId);
      emailKeys = loaded.keys;
      if (loaded.tableMissing) queueTableMissing = true;
    }

    if (queueTableMissing) {
      // Still allow in-app via orchestrator; skip email enqueue later
    }

    const schedulingSettings: CheckinSchedulingSettingsInput = {
      notificationsEnabled: settings.notificationsEnabled,
      emailOptIn: settings.emailOptIn,
      careEmailChannelConsent: settings.careEmailChannelConsent,
      locale: settings.locale,
      timezone: settings.timezone,
      careCheckinConsent: true,
    };

    const orch = orchestrateCheckinScheduling({
      subjectId: userId,
      checkIns,
      settings: schedulingSettings,
      email: email || "missing@invalid",
      existingNotificationFingerprints: fingerprints,
      existingEmailIdempotencyKeys: emailKeys,
      now,
      idFactory: () => randomUUID(),
    });

    for (const action of orch.actions) {
      if (action.type === "create_in_app_notification") {
        if (!settings.notificationsEnabled) continue;
        const notif =
          action.notification ??
          buildCheckInDueNotification(
            checkIns.find((c) => c.id === action.checkInId)!,
            () => randomUUID()
          );
        const { error: nErr } = await client.from("care_notifications").upsert(
          {
            id: randomUUID(),
            user_id: userId,
            check_in_id: action.checkInId,
            notification_type: "checkin_due",
            kind: notif.kind,
            title: notif.title,
            message: notif.message,
            related_check_in_id: action.checkInId,
            fingerprint: action.fingerprint,
            status: "unread",
            read: false,
            due_at: checkIns.find((c) => c.id === action.checkInId)?.dueAt ?? null,
            created_at: now.toISOString(),
          },
          { onConflict: "fingerprint", ignoreDuplicates: true }
        );
        if (!nErr) result.counts.in_app += 1;
      }

      if (action.type === "enqueue_email") {
        if (queueTableMissing) {
          result.counts.email_skipped += 1;
          continue;
        }
        if (!settings.careEmailChannelConsent) {
          result.counts.email_skipped += 1;
          continue;
        }
        const candidate = action.candidate;
        try {
          const enq = await enqueueCheckinEmail(client as unknown as CheckinEmailQueueDb, {
            userId,
            checkInId: candidate.checkInId,
            milestone: candidate.milestone,
            kind: candidate.kind,
            idempotencyKey: candidate.idempotencyKey,
            recipientMask: candidate.recipientMask,
            locale: candidate.locale,
            timezone: candidate.timezone,
            payload: {
              subjectKey: candidate.subjectKey,
              bodyKey: candidate.bodyKey,
              locale: candidate.locale,
              milestone: candidate.milestone,
              kind: candidate.kind,
              checkinUrlPath: candidate.checkinUrlPath,
              preferenceUrlPath: candidate.preferenceUrlPath,
              scheduledAt: now.toISOString(),
            },
            scheduledAt: now.toISOString(),
          });
          if (enq.outcome === "inserted") {
            if (action.kind === "checkin_due") result.counts.email_due_enqueued += 1;
            else result.counts.email_reminder_enqueued += 1;
          } else {
            result.counts.email_skipped += 1;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (isMissingRelationError(msg)) {
            queueTableMissing = true;
            result.counts.email_skipped += 1;
          } else {
            result.counts.email_skipped += 1;
            console.info(
              "[checkin-scheduling] enqueue skipped user=" +
                userId.slice(0, 8) +
                " mask=" +
                maskEmailAddress(email || "x@y.z") +
                " reason=enqueue_error"
            );
          }
        }
      }

      if (action.type === "skip" && action.channel !== "in_app") {
        result.counts.email_skipped += 1;
      }
    }
  }

  if (queueTableMissing) {
    result.skipped.push("checkin_email_queue_missing");
  }
  if (result.counts.in_app > 0 || result.counts.email_due_enqueued > 0 || result.counts.email_reminder_enqueued > 0) {
    result.applied.push("checkin_scheduling_orchestrator");
  }
  if (result.counts.email_due_enqueued > 0 || result.counts.email_reminder_enqueued > 0) {
    result.applied.push("enqueue_checkin_email");
  } else if (!queueTableMissing) {
    result.skipped.push("no_email_enqueued");
  }

  console.info(
    "[checkin-scheduling] users=" +
      result.counts.users +
      " in_app=" +
      result.counts.in_app +
      " email_due=" +
      result.counts.email_due_enqueued +
      " email_reminder=" +
      result.counts.email_reminder_enqueued +
      " skipped=" +
      result.counts.email_skipped
  );

  return result;
}
