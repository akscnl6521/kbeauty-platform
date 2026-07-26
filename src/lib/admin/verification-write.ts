import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminSession } from "@/lib/auth/admin";
import {
  assertAdminPermission,
  canPublishCandidate,
} from "@/lib/auth/admin-permissions";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { tryInsertWriteAudit } from "@/lib/admin/audit-log";
import {
  VERIFICATION_ENTITY_TYPES,
  VERIFICATION_REVIEW_TYPES,
  type VerificationEntityType,
  type VerificationReviewType,
} from "@/lib/admin/verification";
import {
  validateWorkflowTransition,
  type CheckStatus,
  type ReviewType,
  type WorkflowStatus,
} from "@/lib/admin/workflow";
import {
  conflict,
  internalWriteError,
  invalidInput,
  notFound,
} from "@/lib/admin/write-errors";
import { normalizeOptionalText, stripControlAndHtml } from "@/lib/admin/sanitize";
import { parsePositiveBigIntId, parseUuid } from "@/lib/admin/query";

const REASON_MAX = 1000;
const NOTES_MAX = 4000;
const OPEN_STATUSES = new Set(["pending", "in_review"]);

const ENTITY_SET = new Set<string>(VERIFICATION_ENTITY_TYPES);
const REVIEW_SET = new Set<string>(VERIFICATION_REVIEW_TYPES);

export type CreateVerificationQueueInput = {
  entityType?: unknown;
  entityId?: unknown;
  reviewType?: unknown;
  priority?: unknown;
  reason?: unknown;
};

export type ReviewVerificationInput = {
  action?: unknown;
  reviewerNotes?: unknown;
};

async function assertEntityExists(
  client: SupabaseClient,
  entityType: VerificationEntityType,
  entityId: string
): Promise<void> {
  if (entityType === "candidate") {
    const id = parseUuid(entityId);
    if (!id) throw invalidInput("entity_id가 올바르지 않습니다.");
    const { data, error } = await client
      .from("product_discovery_candidates")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw internalWriteError();
    if (!data) throw notFound("대상 후보를 찾을 수 없습니다.");
    return;
  }

  if (entityType === "product") {
    const id = parsePositiveBigIntId(entityId);
    if (id == null) throw invalidInput("entity_id가 올바르지 않습니다.");
    const { data, error } = await client
      .from("products")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw internalWriteError();
    if (!data) throw notFound("대상 제품을 찾을 수 없습니다.");
    return;
  }

  if (entityType === "ingredient") {
    const id = parsePositiveBigIntId(entityId);
    if (id == null) throw invalidInput("entity_id가 올바르지 않습니다.");
    const { data, error } = await client
      .from("ingredients")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (error) throw internalWriteError();
    if (!data) throw notFound("대상 성분을 찾을 수 없습니다.");
    return;
  }

  // offer/variant/brand/evidence — uuid tables
  const id = parseUuid(entityId);
  if (!id) throw invalidInput("entity_id가 올바르지 않습니다.");

  const tableByType: Record<string, string> = {
    offer: "product_offers",
    variant: "product_variants",
    brand: "brands",
    evidence: "ingredient_evidence",
  };
  const table = tableByType[entityType];
  if (!table) throw invalidInput("지원하지 않는 entity_type입니다.");

  const { data, error } = await client
    .from(table)
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw internalWriteError();
  if (!data) throw notFound("대상 엔티티를 찾을 수 없습니다.");
}

export async function createVerificationQueueItem(
  session: AdminSession,
  raw: CreateVerificationQueueInput
): Promise<{
  id: string;
  entityType: string;
  entityId: string;
  reviewType: string;
  status: string;
  priority: number;
  reason: string | null;
  createdAt: string;
}> {
  assertAdminPermission(session, "verification.create");

  if (typeof raw.entityType !== "string" || !ENTITY_SET.has(raw.entityType)) {
    throw invalidInput("entity_type이 올바르지 않습니다.");
  }
  if (typeof raw.reviewType !== "string" || !REVIEW_SET.has(raw.reviewType)) {
    throw invalidInput("review_type이 올바르지 않습니다.");
  }

  const entityType = raw.entityType as VerificationEntityType;
  const reviewType = raw.reviewType as VerificationReviewType;

  if (typeof raw.entityId !== "string" || !raw.entityId.trim()) {
    throw invalidInput("entity_id는 필수입니다.");
  }
  const entityId = stripControlAndHtml(raw.entityId);
  if (!entityId) throw invalidInput("entity_id는 필수입니다.");

  let priority = 100;
  if (raw.priority !== undefined && raw.priority !== null && raw.priority !== "") {
    const n =
      typeof raw.priority === "number"
        ? raw.priority
        : Number.parseInt(String(raw.priority), 10);
    if (!Number.isInteger(n) || n < 1 || n > 1000) {
      throw invalidInput("priority는 1–1000 정수여야 합니다.");
    }
    priority = n;
  }

  const reason = normalizeOptionalText(raw.reason, REASON_MAX);

  let client: SupabaseClient;
  try {
    client = createSupabaseAdminClient();
  } catch {
    throw new AdminConfigurationError();
  }

  await assertEntityExists(client, entityType, entityId);

  const { data: openRows, error: openError } = await client
    .from("verification_queue")
    .select("id, status")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("review_type", reviewType)
    .in("status", ["pending", "in_review"])
    .limit(1);

  if (openError) throw internalWriteError();
  const open = (openRows ?? [])[0] as { id: string; status: string } | undefined;
  if (open) {
    throw conflict(
      "QUEUE_ALREADY_OPEN",
      "동일한 대상에 열린 검증 큐가 이미 있습니다.",
      { existingId: open.id, status: open.status }
    );
  }

  const { data, error } = await client
    .from("verification_queue")
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      review_type: reviewType,
      priority,
      status: "pending",
      reason,
      reviewer_notes: null,
      reviewed_at: null,
      assigned_to: null,
    })
    .select(
      "id, entity_type, entity_id, review_type, status, priority, reason, created_at"
    )
    .single();

  if (error || !data) throw internalWriteError();

  const row = data as {
    id: string;
    entity_type: string;
    entity_id: string;
    review_type: string;
    status: string;
    priority: number;
    reason: string | null;
    created_at: string;
  };

  let productId: number | null = null;
  if (entityType === "candidate") {
    const { data: cand } = await client
      .from("product_discovery_candidates")
      .select("linked_product_id")
      .eq("id", entityId)
      .maybeSingle();
    if (cand) {
      const linked = (cand as { linked_product_id: number | null })
        .linked_product_id;
      productId = linked == null ? null : Number(linked);
    }
  } else if (entityType === "product") {
    productId = parsePositiveBigIntId(entityId);
  }

  await tryInsertWriteAudit(client, {
    action: "verification_queue_created",
    productId,
    actorRole: session.role,
    metadata: {
      queueId: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      reviewType: row.review_type,
      status: row.status,
    },
  });

  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    reviewType: row.review_type,
    status: row.status,
    priority: row.priority,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export async function applyVerificationReview(
  session: AdminSession,
  queueIdRaw: string,
  raw: ReviewVerificationInput
): Promise<{
  id: string;
  status: string;
  reviewType: string;
  entityType: string;
  entityId: string;
  reviewedAt: string | null;
  candidateWorkflowStatus: string | null;
}> {
  assertAdminPermission(session, "verification.review");

  const queueId = parseUuid(queueIdRaw);
  if (!queueId) throw invalidInput("검증 큐 ID가 올바르지 않습니다.");

  const action =
    typeof raw.action === "string" ? raw.action.trim() : "";
  if (
    !["start_review", "approve", "reject", "needs_review"].includes(action)
  ) {
    throw invalidInput("허용되지 않은 action입니다.");
  }

  const notes = normalizeOptionalText(raw.reviewerNotes, NOTES_MAX);
  if (
    (action === "reject" || action === "needs_review") &&
    (!notes || notes.length < 2)
  ) {
    throw invalidInput("반려/추가 검토에는 reviewer notes가 필요합니다.");
  }

  let client: SupabaseClient;
  try {
    client = createSupabaseAdminClient();
  } catch {
    throw new AdminConfigurationError();
  }

  const { data: queueRow, error: queueError } = await client
    .from("verification_queue")
    .select(
      "id, entity_type, entity_id, review_type, status, priority, reason, reviewer_notes, reviewed_at"
    )
    .eq("id", queueId)
    .maybeSingle();

  if (queueError) throw internalWriteError();
  if (!queueRow) throw notFound("검증 큐 항목을 찾을 수 없습니다.");

  const queue = queueRow as {
    id: string;
    entity_type: string;
    entity_id: string;
    review_type: string;
    status: string;
    priority: number;
    reason: string | null;
    reviewer_notes: string | null;
    reviewed_at: string | null;
  };

  if (queue.status === "approved" || queue.status === "rejected") {
    throw conflict(
      "CONFLICT",
      "이미 종료된 검증 큐는 변경할 수 없습니다."
    );
  }

  if (action === "start_review") {
    if (queue.status !== "pending") {
      throw conflict(
        "INVALID_WORKFLOW_TRANSITION",
        "검토 시작은 pending 상태에서만 가능합니다."
      );
    }

    const { data: updated, error } = await client
      .from("verification_queue")
      .update({
        status: "in_review",
        reviewer_notes: notes ?? queue.reviewer_notes,
      })
      .eq("id", queueId)
      .eq("status", "pending")
      .select("id, status, review_type, entity_type, entity_id, reviewed_at")
      .maybeSingle();

    if (error) throw internalWriteError();
    if (!updated) {
      throw conflict("CONFLICT", "상태가 변경되어 검토를 시작할 수 없습니다.");
    }

    const row = updated as {
      id: string;
      status: string;
      review_type: string;
      entity_type: string;
      entity_id: string;
      reviewed_at: string | null;
    };

    await tryInsertWriteAudit(client, {
      action: "verification_review_started",
      actorRole: session.role,
      metadata: {
        queueId: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        reviewType: row.review_type,
      },
    });

    return {
      id: row.id,
      status: row.status,
      reviewType: row.review_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      reviewedAt: row.reviewed_at,
      candidateWorkflowStatus: null,
    };
  }

  if (queue.status !== "in_review") {
    throw conflict(
      "INVALID_WORKFLOW_TRANSITION",
      "승인/반려/추가 검토는 in_review 상태에서만 가능합니다."
    );
  }

  const decision =
    action === "approve"
      ? "approve"
      : action === "reject"
        ? "reject"
        : "needs_review";

  const nextStatus =
    decision === "approve"
      ? "approved"
      : decision === "reject"
        ? "rejected"
        : "needs_review";

  const now = new Date().toISOString();
  let candidateWorkflowStatus: string | null = null;

  // Candidate workflow apply (only entity_type=candidate)
  if (queue.entity_type === "candidate") {
    const candidateId = parseUuid(queue.entity_id);
    if (!candidateId) throw invalidInput("후보 entity_id가 올바르지 않습니다.");

    const { data: cand, error: candError } = await client
      .from("product_discovery_candidates")
      .select(
        "id, workflow_status, sale_check_status, ingredient_check_status, evidence_check_status, safety_check_status, duplicate_check_status, linked_product_id, discovered_url"
      )
      .eq("id", candidateId)
      .maybeSingle();

    if (candError) throw internalWriteError();
    if (!cand) throw notFound("연결된 후보를 찾을 수 없습니다.");

    const c = cand as {
      id: string;
      workflow_status: string;
      sale_check_status: string;
      ingredient_check_status: string;
      evidence_check_status: string;
      safety_check_status: string;
      duplicate_check_status: string;
      linked_product_id: number | string | null;
      discovered_url: string | null;
    };

    const apply = validateWorkflowTransition({
      reviewType: queue.review_type as ReviewType,
      decision,
      actorCanPublish: canPublishCandidate(session.role),
      candidate: {
        workflowStatus: c.workflow_status as WorkflowStatus,
        saleCheckStatus: c.sale_check_status as CheckStatus,
        ingredientCheckStatus: c.ingredient_check_status as CheckStatus,
        evidenceCheckStatus: c.evidence_check_status as CheckStatus,
        safetyCheckStatus: c.safety_check_status as CheckStatus,
        duplicateCheckStatus: c.duplicate_check_status as CheckStatus,
        linkedProductId:
          c.linked_product_id == null ? null : Number(c.linked_product_id),
      },
    });

    const { data: queueUpdated, error: qErr } = await client
      .from("verification_queue")
      .update({
        status: nextStatus,
        reviewer_notes: notes,
        reviewed_at: now,
      })
      .eq("id", queueId)
      .eq("status", "in_review")
      .select("id, status, review_type, entity_type, entity_id, reviewed_at")
      .maybeSingle();

    if (qErr) throw internalWriteError();
    if (!queueUpdated) {
      throw conflict("CONFLICT", "큐 상태가 변경되어 처리할 수 없습니다.");
    }

    const { data: candUpdated, error: cErr } = await client
      .from("product_discovery_candidates")
      .update({
        workflow_status: apply.workflowStatus,
        sale_check_status: apply.saleCheckStatus,
        ingredient_check_status: apply.ingredientCheckStatus,
        evidence_check_status: apply.evidenceCheckStatus,
        safety_check_status: apply.safetyCheckStatus,
        duplicate_check_status: apply.duplicateCheckStatus,
        updated_at: now,
      })
      .eq("id", candidateId)
      .select("workflow_status, linked_product_id")
      .maybeSingle();

    if (cErr || !candUpdated) {
      // compensate queue back to in_review
      await client
        .from("verification_queue")
        .update({
          status: "in_review",
          reviewer_notes: queue.reviewer_notes,
          reviewed_at: null,
        })
        .eq("id", queueId);
      throw internalWriteError();
    }

    candidateWorkflowStatus = (candUpdated as { workflow_status: string })
      .workflow_status;

    const linked = (candUpdated as { linked_product_id: number | null })
      .linked_product_id;

    const auditAction =
      decision === "approve"
        ? "verification_approved"
        : decision === "reject"
          ? "verification_rejected"
          : "verification_needs_review";

    await tryInsertWriteAudit(client, {
      action: auditAction,
      productId: linked == null ? null : Number(linked),
      sourceUrl: c.discovered_url,
      actorRole: session.role,
      oldValue: { workflowStatus: c.workflow_status },
      metadata: {
        queueId,
        candidateId,
        reviewType: queue.review_type,
        decision,
        workflowStatus: candidateWorkflowStatus,
      },
    });

    if (c.workflow_status !== candidateWorkflowStatus) {
      await tryInsertWriteAudit(client, {
        action: "workflow_status_changed",
        productId: linked == null ? null : Number(linked),
        actorRole: session.role,
        oldValue: { workflowStatus: c.workflow_status },
        metadata: {
          candidateId,
          workflowStatus: candidateWorkflowStatus,
          viaQueueId: queueId,
        },
      });
    }

    const row = queueUpdated as {
      id: string;
      status: string;
      review_type: string;
      entity_type: string;
      entity_id: string;
      reviewed_at: string | null;
    };

    return {
      id: row.id,
      status: row.status,
      reviewType: row.review_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      reviewedAt: row.reviewed_at,
      candidateWorkflowStatus,
    };
  }

  // Non-candidate entities: queue status only
  const { data: queueUpdated, error: qErr } = await client
    .from("verification_queue")
    .update({
      status: nextStatus,
      reviewer_notes: notes,
      reviewed_at: now,
    })
    .eq("id", queueId)
    .eq("status", "in_review")
    .select("id, status, review_type, entity_type, entity_id, reviewed_at")
    .maybeSingle();

  if (qErr) throw internalWriteError();
  if (!queueUpdated) {
    throw conflict("CONFLICT", "큐 상태가 변경되어 처리할 수 없습니다.");
  }

  const row = queueUpdated as {
    id: string;
    status: string;
    review_type: string;
    entity_type: string;
    entity_id: string;
    reviewed_at: string | null;
  };

  const auditAction =
    decision === "approve"
      ? "verification_approved"
      : decision === "reject"
        ? "verification_rejected"
        : "verification_needs_review";

  await tryInsertWriteAudit(client, {
    action: auditAction,
    productId:
      queue.entity_type === "product"
        ? parsePositiveBigIntId(queue.entity_id)
        : null,
    actorRole: session.role,
    metadata: {
      queueId: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      reviewType: row.review_type,
      decision,
    },
  });

  return {
    id: row.id,
    status: row.status,
    reviewType: row.review_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    reviewedAt: row.reviewed_at,
    candidateWorkflowStatus: null,
  };
}

export { OPEN_STATUSES };
