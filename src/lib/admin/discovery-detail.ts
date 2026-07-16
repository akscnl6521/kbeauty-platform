import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  isSafeHttpsUrl,
  type DiscoveryWorkflowStatus,
} from "@/lib/admin/discovery";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const OPEN_QUEUE_STATUSES = new Set(["pending", "in_review", "needs_review"]);

const CANDIDATE_SELECT = [
  "id",
  "discovered_name",
  "discovered_brand",
  "discovered_url",
  "discovered_country",
  "source_type",
  "search_query",
  "discovered_at",
  "sale_check_status",
  "ingredient_check_status",
  "evidence_check_status",
  "safety_check_status",
  "duplicate_check_status",
  "workflow_status",
  "linked_product_id",
  "assigned_to",
  "notes",
  "created_at",
  "updated_at",
].join(", ");

export type AdminDiscoveryQueueItem = {
  id: string;
  reviewType: string;
  status: string;
  priority: number;
  isAssigned: boolean;
  reason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type AdminDiscoveryLinkedProduct = {
  id: number;
  name: string;
  brand: string;
  slug: string | null;
  category: string | null;
  active: boolean | null;
  verifiedAt: string | null;
};

export type AdminDiscoveryStatusSummary = {
  workflowStatus: string;
  duplicatePassed: boolean;
  linkedToProduct: boolean;
  hasOpenQueue: boolean;
  saleChecked: boolean;
  ingredientsChecked: boolean;
  evidenceChecked: boolean;
  safetyChecked: boolean;
  verified: boolean;
  published: boolean;
  canProceedToNextStage: boolean;
  nextStage: string | null;
  nextStageHint: string;
};

export type AdminDiscoveryDetail = {
  id: string;
  candidateName: string;
  brandName: string | null;
  sourceUrl: string | null;
  sourceUrlSafeHttps: boolean;
  sourceType: string | null;
  country: string | null;
  searchQuery: string | null;
  discoveredAt: string;
  saleCheckStatus: string;
  ingredientCheckStatus: string;
  evidenceCheckStatus: string;
  safetyCheckStatus: string;
  duplicateStatus: string;
  workflowStatus: string;
  linkedProductId: number | null;
  isLinked: boolean;
  isAssigned: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminDiscoveryDetailPayload = {
  candidate: AdminDiscoveryDetail;
  linkedProduct: AdminDiscoveryLinkedProduct | null;
  queue: AdminDiscoveryQueueItem[];
  statusSummary: AdminDiscoveryStatusSummary;
};

/**
 * Parse discovery candidate UUID. Invalid → null.
 */
export function parseAdminDiscoveryId(
  raw: string | null | undefined
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!UUID_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

function computeStatusSummary(input: {
  workflowStatus: string;
  duplicateStatus: string;
  saleCheckStatus: string;
  ingredientCheckStatus: string;
  evidenceCheckStatus: string;
  safetyCheckStatus: string;
  linkedProductId: number | null;
  openQueueCount: number;
}): AdminDiscoveryStatusSummary {
  const workflowStatus = input.workflowStatus;
  const duplicatePassed = input.duplicateStatus === "pass";
  const linkedToProduct = input.linkedProductId != null;
  const hasOpenQueue = input.openQueueCount > 0;

  const saleChecked =
    workflowStatus === "sale_checked" ||
    [
      "ingredients_checked",
      "evidence_checked",
      "safety_checked",
      "verified",
      "published",
    ].includes(workflowStatus) ||
    input.saleCheckStatus === "pass";

  const ingredientsChecked =
    workflowStatus === "ingredients_checked" ||
    [
      "evidence_checked",
      "safety_checked",
      "verified",
      "published",
    ].includes(workflowStatus) ||
    input.ingredientCheckStatus === "pass";

  const evidenceChecked =
    workflowStatus === "evidence_checked" ||
    ["safety_checked", "verified", "published"].includes(workflowStatus) ||
    input.evidenceCheckStatus === "pass";

  const safetyChecked =
    workflowStatus === "safety_checked" ||
    ["verified", "published"].includes(workflowStatus) ||
    input.safetyCheckStatus === "pass";

  const verified =
    workflowStatus === "verified" || workflowStatus === "published";
  const published = workflowStatus === "published";

  let canProceedToNextStage = false;
  let nextStage: string | null = null;
  let nextStageHint = "현재 단계에서 자동 진행 참고값이 없습니다.";

  if (workflowStatus === "rejected") {
    canProceedToNextStage = false;
    nextStage = null;
    nextStageHint = "rejected — 자동 진행 불가. 재검토 정책에 따릅니다.";
  } else if (workflowStatus === "needs_review") {
    canProceedToNextStage = false;
    nextStage = null;
    nextStageHint = "needs_review — 자동 진행 불가. 검토 후 재개합니다.";
  } else if (workflowStatus === "published") {
    canProceedToNextStage = false;
    nextStage = null;
    nextStageHint = "published — 파이프라인 완료 (참고값, 버튼 없음).";
  } else if (workflowStatus === "discovered") {
    nextStage = "sale_checked";
    canProceedToNextStage = duplicatePassed;
    nextStageHint = canProceedToNextStage
      ? "duplicate pass — sale check 준비 (읽기 전용 참고)."
      : "sale check 전 duplicate_check_status=pass 필요.";
  } else if (workflowStatus === "sale_checked") {
    nextStage = "ingredients_checked";
    canProceedToNextStage = input.saleCheckStatus === "pass";
    nextStageHint = canProceedToNextStage
      ? "ingredient check 준비 (읽기 전용 참고)."
      : "sale_check_status=pass 후 성분 검토로 진행.";
  } else if (workflowStatus === "ingredients_checked") {
    nextStage = "evidence_checked";
    canProceedToNextStage = input.ingredientCheckStatus === "pass";
    nextStageHint = canProceedToNextStage
      ? "evidence check 준비 (읽기 전용 참고)."
      : "ingredient_check_status=pass 후 근거 검토로 진행.";
  } else if (workflowStatus === "evidence_checked") {
    nextStage = "safety_checked";
    canProceedToNextStage = input.evidenceCheckStatus === "pass";
    nextStageHint = canProceedToNextStage
      ? "safety check 준비 (읽기 전용 참고)."
      : "evidence_check_status=pass 후 안전성 검토로 진행.";
  } else if (workflowStatus === "safety_checked") {
    nextStage = "verified";
    canProceedToNextStage = input.safetyCheckStatus === "pass";
    nextStageHint = canProceedToNextStage
      ? "verified 게이트 준비 (읽기 전용 참고)."
      : "safety_check_status=pass 후 verified 검토로 진행.";
  } else if (workflowStatus === "verified") {
    nextStage = "published";
    canProceedToNextStage = linkedToProduct;
    nextStageHint = canProceedToNextStage
      ? "publish 검토 준비 (읽기 전용 참고 · 버튼 없음)."
      : "publish 전 linked product 연결이 필요합니다.";
  }

  return {
    workflowStatus,
    duplicatePassed,
    linkedToProduct,
    hasOpenQueue,
    saleChecked,
    ingredientsChecked,
    evidenceChecked,
    safetyChecked,
    verified,
    published,
    canProceedToNextStage,
    nextStage,
    nextStageHint,
  };
}

/**
 * Read-only discovery candidate detail. SELECT only.
 * Does not return assigned_to raw values.
 * data_sources / product_change_history have no direct candidate FK — not joined.
 */
export async function getAdminDiscoveryDetail(
  candidateId: string
): Promise<AdminDiscoveryDetailPayload | null> {
  const id = parseAdminDiscoveryId(candidateId);
  if (!id) return null;

  let client: SupabaseClient;
  try {
    client = createSupabaseAdminClient();
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError("Unable to load admin discovery detail.");
  }

  try {
    const { data: candidateRow, error: candidateError } = await client
      .from("product_discovery_candidates")
      .select(CANDIDATE_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (candidateError) {
      throw new AdminConfigurationError(
        "Unable to load admin discovery detail."
      );
    }
    if (!candidateRow) return null;

    const row = candidateRow as unknown as {
      id: string;
      discovered_name: string;
      discovered_brand: string | null;
      discovered_url: string | null;
      discovered_country: string | null;
      source_type: string | null;
      search_query: string | null;
      discovered_at: string;
      sale_check_status: string;
      ingredient_check_status: string;
      evidence_check_status: string;
      safety_check_status: string;
      duplicate_check_status: string;
      workflow_status: string;
      linked_product_id: number | string | null;
      assigned_to: string | null;
      notes: string | null;
      created_at: string;
      updated_at: string;
    };

    const linkedProductId =
      row.linked_product_id == null ? null : Number(row.linked_product_id);
    const safeLinkedId =
      linkedProductId != null && Number.isSafeInteger(linkedProductId)
        ? linkedProductId
        : null;

    const [queueRes, productRes] = await Promise.all([
      client
        .from("verification_queue")
        .select(
          "id, review_type, status, priority, assigned_to, reason, created_at, reviewed_at"
        )
        .eq("entity_type", "candidate")
        .eq("entity_id", id)
        .order("created_at", { ascending: false }),
      safeLinkedId != null
        ? client
            .from("products")
            .select("id, name, brand, slug, category, active, verified_at")
            .eq("id", safeLinkedId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (queueRes.error) {
      throw new AdminConfigurationError(
        "Unable to load admin discovery detail."
      );
    }
    if (productRes.error) {
      throw new AdminConfigurationError(
        "Unable to load admin discovery detail."
      );
    }

    const queue: AdminDiscoveryQueueItem[] = (
      (queueRes.data ?? []) as unknown as Array<{
        id: string;
        review_type: string;
        status: string;
        priority: number;
        assigned_to: string | null;
        reason: string | null;
        created_at: string;
        reviewed_at: string | null;
      }>
    ).map((item) => ({
      id: item.id,
      reviewType: item.review_type,
      status: item.status,
      priority: item.priority,
      isAssigned: Boolean(item.assigned_to && item.assigned_to.trim()),
      reason: item.reason,
      createdAt: item.created_at,
      reviewedAt: item.reviewed_at,
    }));

    let linkedProduct: AdminDiscoveryLinkedProduct | null = null;
    if (productRes.data) {
      const product = productRes.data as unknown as {
        id: number | string;
        name: string;
        brand: string;
        slug: string | null;
        category: string | null;
        active: boolean | null;
        verified_at: string | null;
      };
      linkedProduct = {
        id: Number(product.id),
        name: product.name,
        brand: product.brand,
        slug: product.slug,
        category: product.category,
        active: product.active,
        verifiedAt: product.verified_at,
      };
    }

    const openQueueCount = queue.filter((item) =>
      OPEN_QUEUE_STATUSES.has(item.status)
    ).length;

    const candidate: AdminDiscoveryDetail = {
      id: row.id,
      candidateName: row.discovered_name,
      brandName: row.discovered_brand,
      sourceUrl: row.discovered_url,
      sourceUrlSafeHttps: isSafeHttpsUrl(row.discovered_url),
      sourceType: row.source_type,
      country: row.discovered_country,
      searchQuery: row.search_query,
      discoveredAt: row.discovered_at,
      saleCheckStatus: row.sale_check_status,
      ingredientCheckStatus: row.ingredient_check_status,
      evidenceCheckStatus: row.evidence_check_status,
      safetyCheckStatus: row.safety_check_status,
      duplicateStatus: row.duplicate_check_status,
      workflowStatus: row.workflow_status,
      linkedProductId: safeLinkedId,
      isLinked: safeLinkedId != null,
      isAssigned: Boolean(row.assigned_to && row.assigned_to.trim()),
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    const statusSummary = computeStatusSummary({
      workflowStatus: row.workflow_status,
      duplicateStatus: row.duplicate_check_status,
      saleCheckStatus: row.sale_check_status,
      ingredientCheckStatus: row.ingredient_check_status,
      evidenceCheckStatus: row.evidence_check_status,
      safetyCheckStatus: row.safety_check_status,
      linkedProductId: safeLinkedId,
      openQueueCount,
    });

    return {
      candidate,
      linkedProduct,
      queue,
      statusSummary,
    };
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError("Unable to load admin discovery detail.");
  }
}

export type { DiscoveryWorkflowStatus };
