import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminRole } from "@/lib/auth/roles";

/**
 * Safe audit trail via product_change_history.
 *
 * Schema limits:
 * - change_type ∈ name|ingredients|price|status|source|offer|other
 * - product_id nullable FK (candidate-only events use null)
 * - no candidate_id / queue_id columns → store ids in new_value JSON only
 * - never store email, UID, tokens, assigned_to, passwords
 */

export type AuditAction =
  | "discovery_candidate_created"
  | "discovery_candidate_updated"
  | "candidate_linked_to_product"
  | "candidate_imported_from_url"
  | "verification_queue_created"
  | "verification_review_started"
  | "verification_approved"
  | "verification_rejected"
  | "verification_needs_review"
  | "workflow_status_changed"
  // 내려졌던 제품을 다시 공개한 것. 사람이 내린 결정을 되돌리는 조작이라
  // 최초 검증(`verification_approved`)과 구분해서 남긴다.
  | "product_reactivated"
  // 브랜드 표기를 공식 표기로 통일한 것. 이름을 «바꾼» 게 아니라 같은 이름의
  // 표기 변형을 모은 것이므로, 근거(확인한 출처)를 metadata 에 남긴다.
  | "brand_name_normalized"
  | "pipeline_operation_settings_updated";

type AuditChangeType = "status" | "source" | "other";

function mapChangeType(action: AuditAction): AuditChangeType {
  switch (action) {
    case "candidate_linked_to_product":
    case "workflow_status_changed":
    case "verification_approved":
    case "verification_rejected":
    case "verification_needs_review":
    case "verification_review_started":
    case "product_reactivated":
      return "status";
    case "discovery_candidate_created":
    case "candidate_imported_from_url":
      return "source";
    default:
      return "other";
  }
}

export type WriteAuditInput = {
  action: AuditAction;
  productId?: number | null;
  sourceUrl?: string | null;
  /** Safe public fields only — no secrets / PII */
  metadata?: Record<string, unknown>;
  oldValue?: Record<string, unknown> | null;
  actorRole: AdminRole;
};

/**
 * Best-effort audit insert. Failures are swallowed by caller decision —
 * write modules should not fail the primary op solely on audit insert
 * unless explicitly required. This helper throws on DB error so callers
 * can choose.
 */
export async function insertWriteAudit(
  client: SupabaseClient,
  input: WriteAuditInput
): Promise<void> {
  const changeType = mapChangeType(input.action);
  const newValue = {
    action: input.action,
    actorRole: input.actorRole,
    ...(input.metadata ?? {}),
  };

  const { error } = await client.from("product_change_history").insert({
    product_id: input.productId ?? null,
    variant_id: null,
    change_type: changeType,
    old_value: input.oldValue ?? null,
    new_value: newValue,
    source_url: input.sourceUrl ?? null,
    // Do not store actor UID/email in approved_by
    approved_by: null,
    reviewed_at: null,
  });

  if (error) {
    throw error;
  }
}

/**
 * Soft audit: never throws domain errors to callers; returns false on failure.
 */
export async function tryInsertWriteAudit(
  client: SupabaseClient,
  input: WriteAuditInput
): Promise<boolean> {
  try {
    await insertWriteAudit(client, input);
    return true;
  } catch {
    return false;
  }
}
