/**
 * DB persistence for check-in email queue (Schema A).
 * Preview test-send must NOT call these helpers.
 */

import {
  assertSafeCheckinEmailPayload,
  type CheckinEmailContentPayload,
  type CheckinEmailKind,
  type CheckinEmailQueueItem,
} from "@/lib/retention/checkinEmailQueuePolicy";
import {
  CHECKIN_EMAIL_MAX_RETRY_ATTEMPTS,
  nextRetryAtIso,
  sanitizeCheckinEmailError,
} from "@/lib/retention/checkinEmailErrorSanitize";
import {
  dbStatusToMemoryStatus,
  memoryStatusToDbStatus,
  type DbCheckinEmailQueueStatus,
} from "@/lib/retention/checkinEmailQueueStatusMap";
import type { CheckinMilestone, CheckinLocale } from "@/lib/retention/checkinPolicy";

export type CheckinEmailQueueRow = {
  id: string;
  user_id: string;
  checkin_id: string;
  milestone: CheckinMilestone;
  kind: CheckinEmailKind;
  channel: "email";
  status: DbCheckinEmailQueueStatus;
  idempotency_key: string;
  recipient_mask: string;
  locale: CheckinLocale | string;
  timezone: string;
  template_version: string;
  payload: CheckinEmailContentPayload | Record<string, unknown>;
  provider_message_id: string | null;
  retry_count: number;
  last_error: string | null;
  next_attempt_at: string | null;
  created_at: string;
  updated_at: string;
  scheduled_at: string | null;
  claimed_at: string | null;
  sent_at: string | null;
  failed_at: string | null;
};

export type EnqueueCheckinEmailInput = {
  userId: string;
  checkInId: string;
  milestone: CheckinMilestone;
  kind: CheckinEmailKind;
  idempotencyKey: string;
  recipientMask: string;
  locale: CheckinLocale | string;
  timezone: string;
  templateVersion?: string;
  payload: CheckinEmailContentPayload;
  scheduledAt?: string | null;
  nextAttemptAt?: string | null;
};

export type EnqueueCheckinEmailResult =
  | { outcome: "inserted"; row: CheckinEmailQueueRow }
  | { outcome: "duplicate"; row: CheckinEmailQueueRow };

type ThenableQuery<T> = PromiseLike<{ data: T; error: { message?: string; code?: string } | null }>;

/** Minimal Supabase-like client surface for tests and admin client. */
export type CheckinEmailQueueDb = {
  from: (table: string) => {
    select: (columns?: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => ThenableQuery<CheckinEmailQueueRow | null>;
      };
    };
    insert: (values: Record<string, unknown>) => {
      select: (columns?: string) => {
        single: () => ThenableQuery<CheckinEmailQueueRow>;
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => {
        select: (columns?: string) => {
          maybeSingle: () => ThenableQuery<CheckinEmailQueueRow | null>;
        };
      };
    };
  };
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => ThenableQuery<CheckinEmailQueueRow[] | null>;
};

export function rowToQueueItem(row: CheckinEmailQueueRow): CheckinEmailQueueItem {
  const payload = row.payload as CheckinEmailContentPayload;
  return {
    id: row.id,
    subjectId: row.user_id,
    checkInId: row.checkin_id,
    milestone: row.milestone,
    kind: row.kind,
    recipientMask: row.recipient_mask,
    locale: (row.locale as CheckinLocale) ?? "ko",
    timezone: row.timezone,
    status: dbStatusToMemoryStatus(row.status),
    attemptCount: row.retry_count,
    nextAttemptAt: row.next_attempt_at,
    lastErrorCode: (row.last_error as CheckinEmailQueueItem["lastErrorCode"]) ?? null,
    idempotencyKey: row.idempotency_key,
    payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at,
    cancelledAt: row.status === "cancelled" ? row.updated_at : null,
  };
}

export async function enqueueCheckinEmail(
  db: CheckinEmailQueueDb,
  input: EnqueueCheckinEmailInput
): Promise<EnqueueCheckinEmailResult> {
  assertSafeCheckinEmailPayload(input.payload);

  if (!input.idempotencyKey.startsWith("checkin-email:v1:")) {
    throw new Error("enqueue_requires_production_idempotency_v1");
  }
  if (input.idempotencyKey.startsWith("preview-email-test:")) {
    throw new Error("enqueue_rejects_preview_test_key");
  }

  const existing = await db
    .from("checkin_email_queue")
    .select("*")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();

  if (existing.error) {
    throw new Error(
      sanitizeCheckinEmailError(existing.error.message, "enqueue_lookup_failed")
    );
  }
  if (existing.data) {
    return { outcome: "duplicate", row: existing.data };
  }

  const now = new Date().toISOString();
  const insertPayload = {
    user_id: input.userId,
    checkin_id: input.checkInId,
    milestone: input.milestone,
    kind: input.kind,
    channel: "email",
    status: "pending" satisfies DbCheckinEmailQueueStatus,
    idempotency_key: input.idempotencyKey,
    recipient_mask: input.recipientMask,
    locale: input.locale,
    timezone: input.timezone,
    template_version: input.templateVersion ?? "v1",
    payload: input.payload,
    retry_count: 0,
    last_error: null,
    next_attempt_at: input.nextAttemptAt ?? input.scheduledAt ?? null,
    scheduled_at: input.scheduledAt ?? null,
    claimed_at: null,
    sent_at: null,
    failed_at: null,
    created_at: now,
    updated_at: now,
  };

  const inserted = await db
    .from("checkin_email_queue")
    .insert(insertPayload)
    .select("*")
    .single();

  if (inserted.error) {
    // Unique race: treat as duplicate fetch
    const code = inserted.error.code ?? "";
    if (code === "23505") {
      const again = await db
        .from("checkin_email_queue")
        .select("*")
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();
      if (again.data) {
        return { outcome: "duplicate", row: again.data };
      }
    }
    throw new Error(
      sanitizeCheckinEmailError(inserted.error.message, "enqueue_insert_failed")
    );
  }

  return { outcome: "inserted", row: inserted.data };
}

export async function claimCheckinEmailJobs(
  db: CheckinEmailQueueDb,
  options: { limit?: number; staleSeconds?: number } = {}
): Promise<CheckinEmailQueueRow[]> {
  const limit = Math.min(50, Math.max(1, options.limit ?? 5));
  const staleSeconds = Math.max(60, options.staleSeconds ?? 900);
  const result = await db.rpc("claim_checkin_email_jobs", {
    p_limit: limit,
    p_stale_seconds: staleSeconds,
  });
  if (result.error) {
    throw new Error(
      sanitizeCheckinEmailError(result.error.message, "claim_failed")
    );
  }
  return Array.isArray(result.data) ? result.data : [];
}

export async function markCheckinEmailSent(
  db: CheckinEmailQueueDb,
  input: {
    id: string;
    providerMessageId?: string | null;
    now?: Date;
  }
): Promise<CheckinEmailQueueRow> {
  const now = (input.now ?? new Date()).toISOString();
  const updated = await db
    .from("checkin_email_queue")
    .update({
      status: "sent" satisfies DbCheckinEmailQueueStatus,
      provider_message_id: input.providerMessageId ?? null,
      sent_at: now,
      claimed_at: null,
      next_attempt_at: null,
      last_error: null,
      updated_at: now,
    })
    .eq("id", input.id)
    .select("*")
    .maybeSingle();

  if (updated.error || !updated.data) {
    throw new Error(
      sanitizeCheckinEmailError(updated.error?.message, "mark_sent_failed")
    );
  }
  return updated.data;
}

export async function markCheckinEmailFailed(
  db: CheckinEmailQueueDb,
  input: {
    id: string;
    error: string;
    retryable: boolean;
    retryCount: number;
    now?: Date;
  }
): Promise<CheckinEmailQueueRow> {
  const nowDate = input.now ?? new Date();
  const now = nowDate.toISOString();
  const safeError = sanitizeCheckinEmailError(input.error);

  const nextRetryCount = input.retryCount + 1;
  const canRetry =
    input.retryable && nextRetryCount <= CHECKIN_EMAIL_MAX_RETRY_ATTEMPTS;

  if (canRetry) {
    // retry_scheduled → pending + retry_count++ + scheduled_at/next_attempt_at
    const nextAttempt = nextRetryAtIso(nextRetryCount, nowDate);
    const updated = await db
      .from("checkin_email_queue")
      .update({
        status: "pending" satisfies DbCheckinEmailQueueStatus,
        retry_count: nextRetryCount,
        last_error: safeError,
        next_attempt_at: nextAttempt,
        scheduled_at: nextAttempt,
        claimed_at: null,
        updated_at: now,
      })
      .eq("id", input.id)
      .select("*")
      .maybeSingle();

    if (updated.error || !updated.data) {
      throw new Error(
        sanitizeCheckinEmailError(updated.error?.message, "mark_retry_failed")
      );
    }
    return updated.data;
  }

  const updated = await db
    .from("checkin_email_queue")
    .update({
      status: "failed" satisfies DbCheckinEmailQueueStatus,
      retry_count: Math.min(nextRetryCount, CHECKIN_EMAIL_MAX_RETRY_ATTEMPTS + 1),
      last_error: safeError,
      next_attempt_at: null,
      claimed_at: null,
      failed_at: now,
      updated_at: now,
    })
    .eq("id", input.id)
    .select("*")
    .maybeSingle();

  if (updated.error || !updated.data) {
    throw new Error(
      sanitizeCheckinEmailError(updated.error?.message, "mark_failed_failed")
    );
  }
  return updated.data;
}

export async function markCheckinEmailCancelled(
  db: CheckinEmailQueueDb,
  input: { id: string; reason?: string; now?: Date }
): Promise<CheckinEmailQueueRow> {
  const now = (input.now ?? new Date()).toISOString();
  const updated = await db
    .from("checkin_email_queue")
    .update({
      status: "cancelled" satisfies DbCheckinEmailQueueStatus,
      last_error: sanitizeCheckinEmailError(input.reason, "cancelled"),
      next_attempt_at: null,
      claimed_at: null,
      updated_at: now,
    })
    .eq("id", input.id)
    .select("*")
    .maybeSingle();

  if (updated.error || !updated.data) {
    throw new Error(
      sanitizeCheckinEmailError(updated.error?.message, "mark_cancelled_failed")
    );
  }
  return updated.data;
}

export async function markCheckinEmailSkippedDuplicate(
  db: CheckinEmailQueueDb,
  input: { id: string; now?: Date }
): Promise<CheckinEmailQueueRow> {
  const now = (input.now ?? new Date()).toISOString();
  const updated = await db
    .from("checkin_email_queue")
    .update({
      status: "skipped_duplicate" satisfies DbCheckinEmailQueueStatus,
      claimed_at: null,
      next_attempt_at: null,
      updated_at: now,
    })
    .eq("id", input.id)
    .select("*")
    .maybeSingle();

  if (updated.error || !updated.data) {
    throw new Error(
      sanitizeCheckinEmailError(
        updated.error?.message,
        "mark_skipped_duplicate_failed"
      )
    );
  }
  return updated.data;
}

/** Expose mapping helper for workers that still speak memory statuses. */
export function toDbStatusFromMemory(
  status: Parameters<typeof memoryStatusToDbStatus>[0]
): DbCheckinEmailQueueStatus {
  return memoryStatusToDbStatus(status);
}

/**
 * Admin manual retry: reset job to pending.
 * Choice: retry_count reset to 0; last_error cleared.
 */
export async function adminResetCheckinEmailJobToPending(
  db: CheckinEmailQueueDb,
  input: { id: string; now?: Date }
): Promise<CheckinEmailQueueRow> {
  const now = (input.now ?? new Date()).toISOString();
  const updated = await db
    .from("checkin_email_queue")
    .update({
      status: "pending" satisfies DbCheckinEmailQueueStatus,
      retry_count: 0,
      last_error: null,
      next_attempt_at: now,
      scheduled_at: now,
      claimed_at: null,
      failed_at: null,
      updated_at: now,
    })
    .eq("id", input.id)
    .select("*")
    .maybeSingle();

  if (updated.error || !updated.data) {
    throw new Error(
      sanitizeCheckinEmailError(updated.error?.message, "admin_reset_pending_failed")
    );
  }
  return updated.data;
}

export async function getCheckinEmailQueueRowById(
  db: CheckinEmailQueueDb,
  id: string
): Promise<CheckinEmailQueueRow | null> {
  const result = await db
    .from("checkin_email_queue")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (result.error) {
    throw new Error(
      sanitizeCheckinEmailError(result.error.message, "queue_row_lookup_failed")
    );
  }
  return result.data;
}
