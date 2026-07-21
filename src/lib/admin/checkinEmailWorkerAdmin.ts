/**
 * Care check-in email worker admin service.
 * Dry-run only — never invokes a live email provider.
 */

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCheckinEmailQueueStatusCounts } from "@/lib/admin/checkinEmailQueueStatus";
import { classifyCareCheckInsProbeError } from "@/lib/admin/care-ops";
import {
  assertCareWorkerAdminEnvironmentAllowed,
  canManualCancelCheckinEmailJob,
  canManualRetryCheckinEmailJob,
  isCareWorkerAdminConfirmToken,
} from "@/lib/admin/checkinEmailWorkerAdminPolicy";
import { sanitizeCheckinEmailError } from "@/lib/retention/checkinEmailErrorSanitize";
import {
  adminResetCheckinEmailJobToPending,
  getCheckinEmailQueueRowById,
  markCheckinEmailCancelled,
  type CheckinEmailQueueDb,
  type CheckinEmailQueueRow,
} from "@/lib/retention/checkinEmailQueuePersistence";
import {
  runCheckinEmailQueueDryRunWorker,
  type CheckinEmailDryRunWorkerResult,
} from "@/lib/retention/processCheckinEmailQueueDryRunWorker";

export type CheckinEmailWorkerRecentJob = {
  id: string;
  status: string;
  kind: string;
  milestone: string;
  retry_count: number;
  last_error: string | null;
  updated_at: string;
};

export type CheckinEmailWorkerRecentAudit = {
  id: string;
  event_type: string;
  created_at: string;
  meta_summary: {
    keys: string[];
    claimed?: number;
    completed?: number;
    failed?: number;
    cancelled?: number;
    retried?: number;
    providerCalls?: number;
    jobId?: string;
  };
};

export type CheckinEmailWorkerAdminSnapshot = {
  tablesReady: boolean;
  readinessStatus: string;
  note: string;
  counts: Record<string, number>;
  total: number;
  failureReasonSummary: Array<{ reason: string; count: number }>;
  staleProcessingCount: number;
  staleSeconds: number;
  recentJobs: CheckinEmailWorkerRecentJob[];
  recentAudit: CheckinEmailWorkerRecentAudit[];
};

export type CareWorkerAdminAuditWriter = (
  eventType: string,
  meta: Record<string, unknown>
) => Promise<void>;

function readAdminEnv(
  env?: Record<string, string | undefined>
): Record<string, string | undefined> {
  return (
    env ?? {
      VERCEL_ENV: process.env.VERCEL_ENV,
      APP_ENV: process.env.APP_ENV,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF,
    }
  );
}

export function assertWorkerAdminEnvOrThrow(
  env?: Record<string, string | undefined>
): void {
  const gate = assertCareWorkerAdminEnvironmentAllowed(readAdminEnv(env));
  if (!gate.ok) {
    const err = new Error(gate.code) as Error & {
      code: string;
      httpStatus: number;
    };
    err.code = gate.code;
    err.httpStatus = gate.httpStatus;
    throw err;
  }
}

export function toRecentJob(
  row: Pick<
    CheckinEmailQueueRow,
    | "id"
    | "status"
    | "kind"
    | "milestone"
    | "retry_count"
    | "last_error"
    | "updated_at"
  >
): CheckinEmailWorkerRecentJob {
  return {
    id: row.id,
    status: row.status,
    kind: row.kind,
    milestone: row.milestone,
    retry_count: row.retry_count,
    last_error: row.last_error
      ? sanitizeCheckinEmailError(row.last_error)
      : null,
    updated_at: row.updated_at,
  };
}

export function buildFailureReasonSummary(
  errors: Array<string | null | undefined>,
  limit = 10
): Array<{ reason: string; count: number }> {
  const map = new Map<string, number>();
  for (const raw of errors) {
    if (!raw) continue;
    const reason = sanitizeCheckinEmailError(raw);
    map.set(reason, (map.get(reason) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
    .slice(0, limit);
}

export function countStaleProcessing(
  rows: Array<{
    status: string;
    updated_at?: string | null;
    claimed_at?: string | null;
  }>,
  staleSeconds: number,
  now: Date = new Date()
): number {
  const cutoff = now.getTime() - Math.max(60, staleSeconds) * 1000;
  let n = 0;
  for (const row of rows) {
    if (row.status !== "processing") continue;
    const ts = Date.parse(row.claimed_at || row.updated_at || "");
    if (!Number.isFinite(ts) || ts < cutoff) n += 1;
  }
  return n;
}

export function summarizeAuditMeta(
  meta: Record<string, unknown> | null | undefined
): CheckinEmailWorkerRecentAudit["meta_summary"] {
  const safe = meta && typeof meta === "object" ? meta : {};
  const keys = Object.keys(safe).filter(
    (k) =>
      ![
        "recipient",
        "email",
        "payload",
        "user_id",
        "recipient_mask",
      ].includes(k)
  );
  const num = (k: string) =>
    typeof safe[k] === "number" ? (safe[k] as number) : undefined;
  const str = (k: string) =>
    typeof safe[k] === "string" ? (safe[k] as string) : undefined;
  return {
    keys,
    claimed: num("claimed"),
    completed: num("completed"),
    failed: num("failed"),
    cancelled: num("cancelled"),
    retried: num("retried"),
    providerCalls: num("providerCalls"),
    jobId: str("jobId"),
  };
}

async function defaultWriteAudit(
  eventType: string,
  meta: Record<string, unknown>
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("care_audit_events").insert({
      event_type: eventType,
      meta,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Best-effort audit; never block ops on audit failure.
  }
}

function asQueueDb(client: ReturnType<typeof createSupabaseAdminClient>): CheckinEmailQueueDb {
  return client as unknown as CheckinEmailQueueDb;
}

export async function getCheckinEmailWorkerAdminSnapshot(input?: {
  staleSeconds?: number;
  env?: Record<string, string | undefined>;
}): Promise<CheckinEmailWorkerAdminSnapshot> {
  assertWorkerAdminEnvOrThrow(input?.env);
  const staleSeconds = Math.max(60, input?.staleSeconds ?? 900);
  const status = await getCheckinEmailQueueStatusCounts();

  const empty: CheckinEmailWorkerAdminSnapshot = {
    tablesReady: status.tablesReady,
    readinessStatus: status.readinessStatus,
    note: status.note,
    counts: status.counts,
    total: status.total,
    failureReasonSummary: [],
    staleProcessingCount: 0,
    staleSeconds,
    recentJobs: [],
    recentAudit: [],
  };

  if (!status.tablesReady) return empty;

  let client;
  try {
    client = createSupabaseAdminClient();
  } catch {
    return { ...empty, readinessStatus: "query_error", note: "admin client unavailable" };
  }

  const now = new Date();
  const cutoffIso = new Date(now.getTime() - staleSeconds * 1000).toISOString();

  const [failedRes, staleRes, recentRes, auditRes] = await Promise.all([
    client
      .from("checkin_email_queue")
      .select("last_error")
      .eq("status", "failed")
      .limit(500),
    client
      .from("checkin_email_queue")
      .select("id, status, claimed_at, updated_at")
      .eq("status", "processing")
      .limit(500),
    client
      .from("checkin_email_queue")
      .select("id, status, kind, milestone, retry_count, last_error, updated_at")
      .order("updated_at", { ascending: false })
      .limit(20),
    client
      .from("care_audit_events")
      .select("id, event_type, meta, created_at")
      .like("event_type", "checkin_email_%")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (failedRes.error || staleRes.error || recentRes.error) {
    const err = failedRes.error || staleRes.error || recentRes.error;
    const readinessStatus = classifyCareCheckInsProbeError(err);
    return {
      ...empty,
      readinessStatus,
      note: "checkin_email_queue query error",
    };
  }

  const failureReasonSummary = buildFailureReasonSummary(
    (failedRes.data ?? []).map(
      (r) => (r as { last_error?: string | null }).last_error
    )
  );

  const staleProcessingCount = countStaleProcessing(
    (staleRes.data ?? []) as Array<{
      status: string;
      claimed_at?: string | null;
      updated_at?: string | null;
    }>,
    staleSeconds,
    now
  );

  // Also count processing older than cutoff via claimed_at/updated_at already covered.
  void cutoffIso;

  const recentJobs = (recentRes.data ?? []).map((row) =>
    toRecentJob(
      row as Pick<
        CheckinEmailQueueRow,
        | "id"
        | "status"
        | "kind"
        | "milestone"
        | "retry_count"
        | "last_error"
        | "updated_at"
      >
    )
  );

  const recentAudit: CheckinEmailWorkerRecentAudit[] = (
    auditRes.error ? [] : auditRes.data ?? []
  ).map((row) => {
    const r = row as {
      id: string;
      event_type: string;
      meta?: Record<string, unknown> | null;
      created_at: string;
    };
    return {
      id: r.id,
      event_type: r.event_type,
      created_at: r.created_at,
      meta_summary: summarizeAuditMeta(r.meta),
    };
  });

  return {
    tablesReady: true,
    readinessStatus: "ready",
    note: "worker admin snapshot — no PII / no payloads",
    counts: status.counts,
    total: status.total,
    failureReasonSummary,
    staleProcessingCount,
    staleSeconds,
    recentJobs,
    recentAudit,
  };
}

export async function runDryRunTick(input: {
  limit?: number;
  staleSeconds?: number;
  adminId: string;
  db?: CheckinEmailQueueDb;
  writeAudit?: CareWorkerAdminAuditWriter;
  env?: Record<string, string | undefined>;
}): Promise<CheckinEmailDryRunWorkerResult> {
  assertWorkerAdminEnvOrThrow(input.env);
  const writeAudit = input.writeAudit ?? defaultWriteAudit;
  const db = input.db ?? asQueueDb(createSupabaseAdminClient());

  const result = await runCheckinEmailQueueDryRunWorker({
    db,
    limit: input.limit ?? 5,
    staleSeconds: input.staleSeconds ?? 900,
  });

  if (result.providerCalls !== 0) {
    throw new Error("dry_run_provider_calls_nonzero");
  }

  await writeAudit("checkin_email_dry_run", {
    adminId: input.adminId,
    claimed: result.claimed,
    completed: result.completed,
    retried: result.retried,
    failed: result.failed,
    cancelled: result.cancelled,
    providerCalls: result.providerCalls,
  });

  return result;
}

export async function manualRetryJob(input: {
  jobId: string;
  confirm: unknown;
  adminId: string;
  allowCancelled?: boolean;
  db?: CheckinEmailQueueDb;
  writeAudit?: CareWorkerAdminAuditWriter;
  env?: Record<string, string | undefined>;
}): Promise<{ id: string; status: string; retry_count: number }> {
  assertWorkerAdminEnvOrThrow(input.env);
  if (!isCareWorkerAdminConfirmToken(input.confirm)) {
    const err = new Error("confirmation_required") as Error & {
      code: string;
      httpStatus: number;
    };
    err.code = "confirmation_required";
    err.httpStatus = 400;
    throw err;
  }

  const writeAudit = input.writeAudit ?? defaultWriteAudit;
  const db = input.db ?? asQueueDb(createSupabaseAdminClient());
  const row = await getCheckinEmailQueueRowById(db, input.jobId);
  if (!row) {
    const err = new Error("job_not_found") as Error & {
      code: string;
      httpStatus: number;
    };
    err.code = "job_not_found";
    err.httpStatus = 404;
    throw err;
  }

  const allowed = canManualRetryCheckinEmailJob({
    status: row.status,
    allowCancelled: input.allowCancelled,
  });
  if (!allowed.ok) {
    const err = new Error(allowed.code) as Error & {
      code: string;
      httpStatus: number;
    };
    err.code = allowed.code;
    err.httpStatus = 409;
    throw err;
  }

  const updated = await adminResetCheckinEmailJobToPending(db, {
    id: input.jobId,
  });

  await writeAudit("checkin_email_manual_retry", {
    adminId: input.adminId,
    jobId: updated.id,
    fromStatus: row.status,
    toStatus: updated.status,
    retry_count: updated.retry_count,
  });

  return {
    id: updated.id,
    status: updated.status,
    retry_count: updated.retry_count,
  };
}

export async function manualCancelJob(input: {
  jobId: string;
  confirm: unknown;
  adminId: string;
  db?: CheckinEmailQueueDb;
  writeAudit?: CareWorkerAdminAuditWriter;
  env?: Record<string, string | undefined>;
}): Promise<{ id: string; status: string }> {
  assertWorkerAdminEnvOrThrow(input.env);
  if (!isCareWorkerAdminConfirmToken(input.confirm)) {
    const err = new Error("confirmation_required") as Error & {
      code: string;
      httpStatus: number;
    };
    err.code = "confirmation_required";
    err.httpStatus = 400;
    throw err;
  }

  const writeAudit = input.writeAudit ?? defaultWriteAudit;
  const db = input.db ?? asQueueDb(createSupabaseAdminClient());
  const row = await getCheckinEmailQueueRowById(db, input.jobId);
  if (!row) {
    const err = new Error("job_not_found") as Error & {
      code: string;
      httpStatus: number;
    };
    err.code = "job_not_found";
    err.httpStatus = 404;
    throw err;
  }

  const allowed = canManualCancelCheckinEmailJob({ status: row.status });
  if (!allowed.ok) {
    const err = new Error(allowed.code) as Error & {
      code: string;
      httpStatus: number;
    };
    err.code = allowed.code;
    err.httpStatus = 409;
    throw err;
  }

  const updated = await markCheckinEmailCancelled(db, {
    id: input.jobId,
    reason: "admin_manual_cancel",
  });

  await writeAudit("checkin_email_manual_cancel", {
    adminId: input.adminId,
    jobId: updated.id,
    fromStatus: row.status,
    toStatus: updated.status,
  });

  return { id: updated.id, status: updated.status };
}
