import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  escapeIlike,
  isSafeHttpsUrl,
  normalizeBoolFilter,
  normalizeText,
  parsePositiveInt,
} from "@/lib/admin/query";

export { isSafeHttpsUrl };

export const DISCOVERY_WORKFLOW_STATUSES = [
  "discovered",
  "sale_checked",
  "ingredients_checked",
  "evidence_checked",
  "safety_checked",
  "verified",
  "published",
  "rejected",
  "needs_review",
] as const;

export type DiscoveryWorkflowStatus =
  (typeof DISCOVERY_WORKFLOW_STATUSES)[number];

export const DISCOVERY_SOURCE_TYPES = [
  "official_brand_page",
  "official_label",
  "official_retailer",
  "medical_paper",
  "clinical_guideline",
  "admin_entry",
  "search_result",
  "affiliate_feed",
  "brand_csv",
  "other",
] as const;

export type DiscoverySourceType = (typeof DISCOVERY_SOURCE_TYPES)[number];

export type AdminDiscoverySort =
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "status_asc"
  | "status_desc";

export type AdminDiscoveryListItem = {
  id: string;
  candidateName: string;
  brandName: string | null;
  sourceUrl: string | null;
  sourceUrlSafeHttps: boolean;
  sourceType: string | null;
  country: string | null;
  workflowStatus: string;
  linkedProductId: number | null;
  isLinked: boolean;
  duplicateStatus: string;
  isAssigned: boolean;
  createdAt: string;
  updatedAt: string;
  queueCount: number;
  openQueueCount: number;
};

export type AdminDiscoveryListParams = {
  page?: number | string | null;
  pageSize?: number | string | null;
  search?: string | null;
  workflowStatus?: string | null;
  country?: string | null;
  sourceType?: string | null;
  linked?: string | null;
  assigned?: string | null;
  sort?: string | null;
};

export type AdminDiscoveryFilters = {
  search: string;
  workflowStatus: "" | DiscoveryWorkflowStatus;
  country: string;
  sourceType: "" | DiscoverySourceType;
  linked: "" | "true" | "false";
  assigned: "" | "true" | "false";
  sort: AdminDiscoverySort;
  countries: string[];
  sourceTypes: string[];
  workflowStatuses: DiscoveryWorkflowStatus[];
};

export type AdminDiscoveryListResult = {
  items: AdminDiscoveryListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filters: AdminDiscoveryFilters;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_SORT: AdminDiscoverySort = "newest";

const ALLOWED_SORTS = new Set<AdminDiscoverySort>([
  "newest",
  "oldest",
  "name_asc",
  "name_desc",
  "status_asc",
  "status_desc",
]);

const WORKFLOW_SET = new Set<string>(DISCOVERY_WORKFLOW_STATUSES);
const SOURCE_TYPE_SET = new Set<string>(DISCOVERY_SOURCE_TYPES);

const OPEN_QUEUE_STATUSES = new Set(["pending", "in_review", "needs_review"]);

const CANDIDATE_SELECT = [
  "id",
  "discovered_name",
  "discovered_brand",
  "discovered_url",
  "discovered_country",
  "source_type",
  "workflow_status",
  "linked_product_id",
  "duplicate_check_status",
  "assigned_to",
  "created_at",
  "updated_at",
].join(", ");

function normalizeSort(value: string | null | undefined): AdminDiscoverySort {
  if (value && ALLOWED_SORTS.has(value as AdminDiscoverySort)) {
    return value as AdminDiscoverySort;
  }
  return DEFAULT_SORT;
}

function normalizeWorkflowStatus(
  value: string | null | undefined
): "" | DiscoveryWorkflowStatus {
  const trimmed = normalizeText(value);
  if (WORKFLOW_SET.has(trimmed)) {
    return trimmed as DiscoveryWorkflowStatus;
  }
  return "";
}

function normalizeSourceType(
  value: string | null | undefined
): "" | DiscoverySourceType {
  const trimmed = normalizeText(value);
  if (SOURCE_TYPE_SET.has(trimmed)) {
    return trimmed as DiscoverySourceType;
  }
  return "";
}

async function loadFilterOptions(client: SupabaseClient): Promise<{
  countries: string[];
  sourceTypes: string[];
}> {
  const { data, error } = await client
    .from("product_discovery_candidates")
    .select("discovered_country, source_type");

  if (error) {
    throw new AdminConfigurationError("Unable to load admin discovery.");
  }

  const countries = new Set<string>();
  const sourceTypes = new Set<string>();

  for (const row of data ?? []) {
    const record = row as unknown as {
      discovered_country?: unknown;
      source_type?: unknown;
    };
    if (
      typeof record.discovered_country === "string" &&
      record.discovered_country.trim()
    ) {
      countries.add(record.discovered_country);
    }
    if (typeof record.source_type === "string" && record.source_type.trim()) {
      sourceTypes.add(record.source_type);
    }
  }

  return {
    countries: [...countries].sort((a, b) => a.localeCompare(b)),
    sourceTypes: [...sourceTypes].sort((a, b) => a.localeCompare(b)),
  };
}

async function loadQueueCounts(
  client: SupabaseClient,
  candidateIds: string[]
): Promise<Map<string, { queueCount: number; openQueueCount: number }>> {
  const map = new Map<
    string,
    { queueCount: number; openQueueCount: number }
  >();

  for (const id of candidateIds) {
    map.set(id, { queueCount: 0, openQueueCount: 0 });
  }

  if (candidateIds.length === 0) return map;

  const { data, error } = await client
    .from("verification_queue")
    .select("entity_id, status")
    .eq("entity_type", "candidate")
    .in("entity_id", candidateIds);

  if (error) {
    throw new AdminConfigurationError("Unable to load admin discovery.");
  }

  for (const row of data ?? []) {
    const record = row as unknown as {
      entity_id?: unknown;
      status?: unknown;
    };
    if (typeof record.entity_id !== "string") continue;
    const entry = map.get(record.entity_id) ?? {
      queueCount: 0,
      openQueueCount: 0,
    };
    entry.queueCount += 1;
    if (typeof record.status === "string" && OPEN_QUEUE_STATUSES.has(record.status)) {
      entry.openQueueCount += 1;
    }
    map.set(record.entity_id, entry);
  }

  return map;
}

/**
 * Read-only discovery candidate list (service-role). SELECT / count only.
 * Does not return assigned_to raw values (may contain PII).
 */
export async function getAdminDiscoveryCandidates(
  rawParams: AdminDiscoveryListParams = {}
): Promise<AdminDiscoveryListResult> {
  let client: SupabaseClient;

  try {
    client = createSupabaseAdminClient();
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError("Unable to load admin discovery.");
  }

  const page = parsePositiveInt(rawParams.page, DEFAULT_PAGE);
  const pageSize = parsePositiveInt(
    rawParams.pageSize,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE
  );
  const search = normalizeText(rawParams.search);
  const workflowStatus = normalizeWorkflowStatus(rawParams.workflowStatus);
  const country = normalizeText(rawParams.country);
  const sourceType = normalizeSourceType(rawParams.sourceType);
  const linked = normalizeBoolFilter(rawParams.linked);
  const assigned = normalizeBoolFilter(rawParams.assigned);
  const sort = normalizeSort(rawParams.sort);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const filterOptionsPromise = loadFilterOptions(client);

    let query = client
      .from("product_discovery_candidates")
      .select(CANDIDATE_SELECT, { count: "exact" });

    if (search) {
      const pattern = `"%${escapeIlike(search)}%"`;
      query = query.or(
        `discovered_name.ilike.${pattern},discovered_brand.ilike.${pattern},discovered_url.ilike.${pattern}`
      );
    }

    if (workflowStatus) {
      query = query.eq("workflow_status", workflowStatus);
    }

    if (country) {
      query = query.eq("discovered_country", country);
    }

    if (sourceType) {
      query = query.eq("source_type", sourceType);
    }

    if (linked === "true") {
      query = query.not("linked_product_id", "is", null);
    } else if (linked === "false") {
      query = query.is("linked_product_id", null);
    }

    if (assigned === "true") {
      query = query.not("assigned_to", "is", null);
    } else if (assigned === "false") {
      query = query.is("assigned_to", null);
    }

    switch (sort) {
      case "oldest":
        query = query.order("created_at", { ascending: true });
        break;
      case "name_asc":
        query = query.order("discovered_name", { ascending: true });
        break;
      case "name_desc":
        query = query.order("discovered_name", { ascending: false });
        break;
      case "status_asc":
        query = query.order("workflow_status", { ascending: true });
        break;
      case "status_desc":
        query = query.order("workflow_status", { ascending: false });
        break;
      case "newest":
      default:
        query = query.order("created_at", { ascending: false });
        break;
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new AdminConfigurationError("Unable to load admin discovery.");
    }

    const rows = (data ?? []) as unknown as Array<{
      id: string;
      discovered_name: string;
      discovered_brand: string | null;
      discovered_url: string | null;
      discovered_country: string | null;
      source_type: string | null;
      workflow_status: string;
      linked_product_id: number | string | null;
      duplicate_check_status: string;
      assigned_to: string | null;
      created_at: string;
      updated_at: string;
    }>;

    const candidateIds = rows.map((row) => row.id);
    const [queueCounts, filterOptions] = await Promise.all([
      loadQueueCounts(client, candidateIds),
      filterOptionsPromise,
    ]);

    const total = count ?? 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    const items: AdminDiscoveryListItem[] = rows.map((row) => {
      const linkedProductId =
        row.linked_product_id == null
          ? null
          : Number(row.linked_product_id);
      const queues = queueCounts.get(row.id) ?? {
        queueCount: 0,
        openQueueCount: 0,
      };

      return {
        id: row.id,
        candidateName: row.discovered_name,
        brandName: row.discovered_brand,
        sourceUrl: row.discovered_url,
        sourceUrlSafeHttps: isSafeHttpsUrl(row.discovered_url),
        sourceType: row.source_type,
        country: row.discovered_country,
        workflowStatus: row.workflow_status,
        linkedProductId:
          linkedProductId != null && Number.isSafeInteger(linkedProductId)
            ? linkedProductId
            : null,
        isLinked: linkedProductId != null && Number.isSafeInteger(linkedProductId),
        duplicateStatus: row.duplicate_check_status,
        isAssigned: Boolean(row.assigned_to && row.assigned_to.trim()),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        queueCount: queues.queueCount,
        openQueueCount: queues.openQueueCount,
      };
    });

    return {
      items,
      page,
      pageSize,
      total,
      totalPages,
      filters: {
        search,
        workflowStatus,
        country,
        sourceType,
        linked,
        assigned,
        sort,
        countries: filterOptions.countries,
        sourceTypes:
          filterOptions.sourceTypes.length > 0
            ? filterOptions.sourceTypes
            : [...DISCOVERY_SOURCE_TYPES],
        workflowStatuses: [...DISCOVERY_WORKFLOW_STATUSES],
      },
    };
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError("Unable to load admin discovery.");
  }
}

export function parseAdminDiscoveryListParams(
  input: URLSearchParams | Record<string, string | string[] | undefined>
): AdminDiscoveryListParams {
  const get = (key: string): string | null => {
    if (input instanceof URLSearchParams) {
      return input.get(key);
    }
    const value = input[key];
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  };

  return {
    page: get("page"),
    pageSize: get("pageSize"),
    search: get("search"),
    workflowStatus: get("workflowStatus"),
    country: get("country"),
    sourceType: get("sourceType"),
    linked: get("linked"),
    assigned: get("assigned"),
    sort: get("sort"),
  };
}
