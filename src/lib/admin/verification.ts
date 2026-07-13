import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  escapeIlike,
  getSearchParam,
  normalizeBoolFilter,
  normalizeText,
  parsePositiveInt,
} from "@/lib/admin/query";

export const VERIFICATION_ENTITY_TYPES = [
  "candidate",
  "product",
  "offer",
  "ingredient",
  "evidence",
  "variant",
  "brand",
] as const;

export type VerificationEntityType =
  (typeof VERIFICATION_ENTITY_TYPES)[number];

export const VERIFICATION_REVIEW_TYPES = [
  "sale",
  "ingredients",
  "evidence",
  "safety",
  "publish",
  "duplicate",
  "other",
] as const;

export type VerificationReviewType =
  (typeof VERIFICATION_REVIEW_TYPES)[number];

export const VERIFICATION_STATUSES = [
  "pending",
  "in_review",
  "approved",
  "rejected",
  "needs_review",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export type AdminVerificationSort =
  | "newest"
  | "oldest"
  | "priority_desc"
  | "priority_asc"
  | "status_asc"
  | "status_desc";

export type AdminVerificationListItem = {
  id: string;
  entityType: string;
  entityId: string;
  reviewType: string;
  status: string;
  priority: number;
  isAssigned: boolean;
  reason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type AdminVerificationListParams = {
  page?: number | string | null;
  pageSize?: number | string | null;
  search?: string | null;
  entityType?: string | null;
  reviewType?: string | null;
  status?: string | null;
  assigned?: string | null;
  sort?: string | null;
};

export type AdminVerificationFilters = {
  search: string;
  entityType: "" | VerificationEntityType;
  reviewType: "" | VerificationReviewType;
  status: "" | VerificationStatus;
  assigned: "" | "true" | "false";
  sort: AdminVerificationSort;
  entityTypes: VerificationEntityType[];
  reviewTypes: VerificationReviewType[];
  statuses: VerificationStatus[];
};

export type AdminVerificationListResult = {
  items: AdminVerificationListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filters: AdminVerificationFilters;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_SORT: AdminVerificationSort = "newest";

const ALLOWED_SORTS = new Set<AdminVerificationSort>([
  "newest",
  "oldest",
  "priority_desc",
  "priority_asc",
  "status_asc",
  "status_desc",
]);

const ENTITY_SET = new Set<string>(VERIFICATION_ENTITY_TYPES);
const REVIEW_SET = new Set<string>(VERIFICATION_REVIEW_TYPES);
const STATUS_SET = new Set<string>(VERIFICATION_STATUSES);

const QUEUE_SELECT = [
  "id",
  "entity_type",
  "entity_id",
  "review_type",
  "priority",
  "status",
  "assigned_to",
  "reason",
  "created_at",
  "reviewed_at",
].join(", ");

function normalizeEntityType(
  value: string | null | undefined
): "" | VerificationEntityType {
  if (value && ENTITY_SET.has(value)) return value as VerificationEntityType;
  return "";
}

function normalizeReviewType(
  value: string | null | undefined
): "" | VerificationReviewType {
  if (value && REVIEW_SET.has(value)) return value as VerificationReviewType;
  return "";
}

function normalizeStatus(
  value: string | null | undefined
): "" | VerificationStatus {
  if (value && STATUS_SET.has(value)) return value as VerificationStatus;
  return "";
}

function normalizeSort(value: string | null | undefined): AdminVerificationSort {
  if (value && ALLOWED_SORTS.has(value as AdminVerificationSort)) {
    return value as AdminVerificationSort;
  }
  return DEFAULT_SORT;
}

function applySort(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  sort: AdminVerificationSort
) {
  switch (sort) {
    case "oldest":
      return query.order("created_at", { ascending: true });
    case "priority_desc":
      return query
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });
    case "priority_asc":
      return query
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false });
    case "status_asc":
      return query
        .order("status", { ascending: true })
        .order("created_at", { ascending: false });
    case "status_desc":
      return query
        .order("status", { ascending: false })
        .order("created_at", { ascending: false });
    case "newest":
    default:
      return query.order("created_at", { ascending: false });
  }
}

export function parseAdminVerificationListParams(
  input: URLSearchParams | Record<string, string | string[] | undefined>
): AdminVerificationListParams {
  return {
    page: getSearchParam(input, "page"),
    pageSize: getSearchParam(input, "pageSize"),
    search: getSearchParam(input, "search"),
    entityType: getSearchParam(input, "entityType"),
    reviewType: getSearchParam(input, "reviewType"),
    status: getSearchParam(input, "status"),
    assigned: getSearchParam(input, "assigned"),
    sort: getSearchParam(input, "sort"),
  };
}

/**
 * Read-only verification_queue list. SELECT only.
 * Never returns assigned_to raw value.
 */
export async function getAdminVerificationQueue(
  rawParams: AdminVerificationListParams = {}
): Promise<AdminVerificationListResult> {
  const page = parsePositiveInt(rawParams.page, DEFAULT_PAGE);
  const pageSize = parsePositiveInt(
    rawParams.pageSize,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE
  );
  const search = normalizeText(rawParams.search);
  const entityType = normalizeEntityType(rawParams.entityType);
  const reviewType = normalizeReviewType(rawParams.reviewType);
  const status = normalizeStatus(rawParams.status);
  const assigned = normalizeBoolFilter(rawParams.assigned);
  const sort = normalizeSort(rawParams.sort);

  const filters: AdminVerificationFilters = {
    search,
    entityType,
    reviewType,
    status,
    assigned,
    sort,
    entityTypes: [...VERIFICATION_ENTITY_TYPES],
    reviewTypes: [...VERIFICATION_REVIEW_TYPES],
    statuses: [...VERIFICATION_STATUSES],
  };

  let client: SupabaseClient;
  try {
    client = createSupabaseAdminClient();
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError(
      "Unable to load admin verification queue."
    );
  }

  try {
    let query = client
      .from("verification_queue")
      .select(QUEUE_SELECT, { count: "exact" });

    if (entityType) query = query.eq("entity_type", entityType);
    if (reviewType) query = query.eq("review_type", reviewType);
    if (status) query = query.eq("status", status);

    if (assigned === "true") {
      query = query.not("assigned_to", "is", null);
    } else if (assigned === "false") {
      query = query.is("assigned_to", null);
    }

    if (search) {
      const escaped = escapeIlike(search);
      const pattern = `%${escaped}%`;
      query = query.or(
        [
          `entity_id.ilike.${pattern}`,
          `reason.ilike.${pattern}`,
          `reviewer_notes.ilike.${pattern}`,
        ].join(",")
      );
    }

    query = applySort(query, sort);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query.range(from, to);

    if (error) {
      throw new AdminConfigurationError(
        "Unable to load admin verification queue."
      );
    }

    const total = typeof count === "number" ? count : 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    const items: AdminVerificationListItem[] = (
      (data ?? []) as unknown as Array<{
        id: string;
        entity_type: string;
        entity_id: string;
        review_type: string;
        priority: number;
        status: string;
        assigned_to: string | null;
        reason: string | null;
        created_at: string;
        reviewed_at: string | null;
      }>
    ).map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      reviewType: row.review_type,
      status: row.status,
      priority: row.priority,
      isAssigned: row.assigned_to != null && String(row.assigned_to).length > 0,
      reason: row.reason,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
    }));

    return {
      items,
      page,
      pageSize,
      total,
      totalPages,
      filters,
    };
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError(
      "Unable to load admin verification queue."
    );
  }
}
