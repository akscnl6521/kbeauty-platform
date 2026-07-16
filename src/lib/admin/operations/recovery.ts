import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { tryInsertWriteAudit } from "@/lib/admin/audit-log";
import { loadPipelineOperationConfig } from "@/lib/pipeline/operation-config";
import { DEFAULT_MONITORING_CONFIG } from "@/lib/admin/operations/types";
import {
  FORBIDDEN_RECOVERY_ACTIONS,
  listAllowedRecoveryActions,
  type RecoveryActionCode,
} from "@/lib/admin/operations/recovery-policy";

export type { RecoveryActionCode };
export {
  isRecoveryAllowed,
  listAllowedRecoveryActions,
  listForbiddenRecoveryActions,
} from "@/lib/admin/operations/recovery-policy";

export type RecoveryResult = {
  attempted: RecoveryActionCode[];
  applied: RecoveryActionCode[];
  skipped: Array<{ action: RecoveryActionCode; reason: string }>;
  counts: Record<string, number>;
};

/**
 * Run safe recovery steps. Never publishes/deletes/demotes.
 */
export async function runSafeAutoRecovery(
  client: SupabaseClient,
  input?: { batchId?: string }
): Promise<RecoveryResult> {
  const op = loadPipelineOperationConfig();
  const monitoring = op.monitoring ?? DEFAULT_MONITORING_CONFIG;
  const result: RecoveryResult = {
    attempted: [],
    applied: [],
    skipped: [],
    counts: {},
  };

  if (!monitoring.autoRecoveryEnabled) {
    result.skipped.push({
      action: "noop_forbidden",
      reason: "autoRecoveryEnabled=false",
    });
    return result;
  }

  if (
    op.allowDelete ||
    op.allowPublish ||
    op.allowProductDemotion ||
    op.allowBulkStatusRewrite
  ) {
    result.skipped.push({
      action: "noop_forbidden",
      reason: "hard_policy_violation",
    });
    return result;
  }

  const staleMinutes = monitoring.staleHeartbeatMinutes;
  const staleBefore = new Date(
    Date.now() - staleMinutes * 60_000
  ).toISOString();

  result.attempted.push("requeue_stale_running_jobs");
  {
    let q = client
      .from("pipeline_jobs")
      .update({
        status: "queued",
        claimed_by: null,
        claim_heartbeat_at: null,
      })
      .eq("status", "running")
      .lt("claim_heartbeat_at", staleBefore);
    if (input?.batchId) q = q.eq("batch_id", input.batchId);
    const { data, error } = await q.select("id");
    if (error) {
      result.skipped.push({
        action: "requeue_stale_running_jobs",
        reason: "update_failed",
      });
    } else {
      result.applied.push("requeue_stale_running_jobs");
      result.counts.requeuedJobs = (data ?? []).length;
    }
  }

  result.attempted.push("release_stale_batch_locks");
  {
    const { data, error } = await client
      .from("pipeline_batches")
      .update({
        lock_owner: null,
        lock_heartbeat_at: null,
      })
      .eq("status", "running")
      .lt("lock_heartbeat_at", staleBefore)
      .select("id");
    if (error) {
      result.skipped.push({
        action: "release_stale_batch_locks",
        reason: "update_failed",
      });
    } else {
      result.applied.push("release_stale_batch_locks");
      result.counts.releasedLocks = (data ?? []).length;
    }
  }

  result.attempted.push("promote_due_retry_wait");
  {
    const nowIso = new Date().toISOString();
    let q = client
      .from("pipeline_jobs")
      .update({ status: "queued" })
      .eq("status", "retry_wait")
      .lte("next_retry_at", nowIso);
    if (input?.batchId) q = q.eq("batch_id", input.batchId);
    const { data, error } = await q.select("id");
    if (error) {
      result.skipped.push({
        action: "promote_due_retry_wait",
        reason: "update_failed",
      });
    } else {
      result.applied.push("promote_due_retry_wait");
      result.counts.promotedRetries = (data ?? []).length;
    }
  }

  if (op.allowAuditInsert) {
    await tryInsertWriteAudit(client, {
      action: "pipeline_operation_settings_updated",
      productId: null,
      actorRole: "admin",
      metadata: {
        via: "safe_auto_recovery",
        applied: result.applied,
        counts: result.counts,
        forbiddenChecked: FORBIDDEN_RECOVERY_ACTIONS,
        allowlistChecked: listAllowedRecoveryActions(),
      },
    });
  }

  return result;
}
