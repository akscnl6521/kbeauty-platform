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

export type AdminIngredientListItem = {
  id: number;
  nameEn: string;
  nameKo: string | null;
  slug: string;
  inciName: string | null;
  /** ingredients 테이블에 active 컬럼 없음 → 항상 null */
  active: boolean | null;
  /** ingredients 테이블에 verified_at 컬럼 없음 → 항상 null */
  verifiedAt: string | null;
  aliasCount: number;
  evidenceCount: number;
  cautionCount: number;
  linkedProductCount: number;
  /** 관련 evidence의 evidence_level 중 하나(없으면 null). ingredient 자체 검증 아님 */
  evidenceLevel: string | null;
};

export type AdminIngredientSort =
  | "id_desc"
  | "id_asc"
  | "name_en_asc"
  | "name_en_desc"
  | "name_ko_asc"
  | "verified_desc";

export type AdminIngredientListParams = {
  page?: number | string | null;
  pageSize?: number | string | null;
  search?: string | null;
  active?: string | null;
  verified?: string | null;
  hasAlias?: string | null;
  hasEvidence?: string | null;
  hasCaution?: string | null;
  linkedToProduct?: string | null;
  sort?: string | null;
};

export type AdminIngredientFilters = {
  search: string;
  active: "" | "true" | "false";
  verified: "" | "true" | "false";
  hasAlias: "" | "true" | "false";
  hasEvidence: "" | "true" | "false";
  hasCaution: "" | "true" | "false";
  linkedToProduct: "" | "true" | "false";
  sort: AdminIngredientSort;
  schemaNotes: {
    hasActiveColumn: false;
    hasVerifiedAtColumn: false;
    hasInciNameColumn: false;
  };
};

export type AdminIngredientListResult = {
  items: AdminIngredientListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filters: AdminIngredientFilters;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_SORT: AdminIngredientSort = "id_desc";

const ALLOWED_SORTS = new Set<AdminIngredientSort>([
  "id_desc",
  "id_asc",
  "name_en_asc",
  "name_en_desc",
  "name_ko_asc",
  "verified_desc",
]);

const INGREDIENT_SELECT = "id, slug, name_en, name_ko, created_at";

function normalizeSort(value: string | null | undefined): AdminIngredientSort {
  if (value && ALLOWED_SORTS.has(value as AdminIngredientSort)) {
    return value as AdminIngredientSort;
  }
  return DEFAULT_SORT;
}

function toIdSet(rows: unknown[] | null, key = "ingredient_id"): Set<number> {
  const set = new Set<number>();
  for (const row of rows ?? []) {
    const record = row as Record<string, unknown>;
    const id = Number(record[key]);
    if (Number.isSafeInteger(id) && id > 0) set.add(id);
  }
  return set;
}

function emptyListResult(
  page: number,
  pageSize: number,
  filters: Omit<AdminIngredientFilters, "schemaNotes"> & {
    schemaNotes?: AdminIngredientFilters["schemaNotes"];
  }
): AdminIngredientListResult {
  return {
    items: [],
    page,
    pageSize,
    total: 0,
    totalPages: 0,
    filters: {
      ...filters,
      schemaNotes: {
        hasActiveColumn: false,
        hasVerifiedAtColumn: false,
        hasInciNameColumn: false,
      },
    },
  };
}

async function loadRelationMaps(client: SupabaseClient): Promise<{
  aliasIds: Set<number>;
  evidenceIds: Set<number>;
  cautionIds: Set<number>;
  linkedIds: Set<number>;
}> {
  const [aliases, evidence, cautions, linked] = await Promise.all([
    client.from("ingredient_aliases").select("ingredient_id"),
    client.from("ingredient_evidence").select("ingredient_id"),
    client.from("ingredient_cautions").select("ingredient_id"),
    client.from("product_ingredients").select("ingredient_id"),
  ]);

  if (aliases.error || evidence.error || cautions.error || linked.error) {
    throw new AdminConfigurationError("Unable to load admin ingredients.");
  }

  return {
    aliasIds: toIdSet(aliases.data),
    evidenceIds: toIdSet(evidence.data),
    cautionIds: toIdSet(cautions.data),
    linkedIds: toIdSet(linked.data),
  };
}

async function findAliasMatchIds(
  client: SupabaseClient,
  search: string
): Promise<number[]> {
  const pattern = `"%${escapeIlike(search)}%"`;
  const { data, error } = await client
    .from("ingredient_aliases")
    .select("ingredient_id")
    .or(`alias.ilike.${pattern},normalized_alias.ilike.${pattern}`);

  if (error) {
    throw new AdminConfigurationError("Unable to load admin ingredients.");
  }

  return [...toIdSet(data)];
}

async function loadPageCounts(
  client: SupabaseClient,
  ingredientIds: number[]
): Promise<{
  aliasCount: Map<number, number>;
  evidenceCount: Map<number, number>;
  cautionCount: Map<number, number>;
  linkedProductCount: Map<number, number>;
  inciName: Map<number, string>;
  evidenceLevel: Map<number, string>;
}> {
  const aliasCount = new Map<number, number>();
  const evidenceCount = new Map<number, number>();
  const cautionCount = new Map<number, number>();
  const linkedProductCount = new Map<number, number>();
  const linkedProducts = new Map<number, Set<number>>();
  const inciName = new Map<number, string>();
  const evidenceLevel = new Map<number, string>();

  for (const id of ingredientIds) {
    aliasCount.set(id, 0);
    evidenceCount.set(id, 0);
    cautionCount.set(id, 0);
    linkedProductCount.set(id, 0);
    linkedProducts.set(id, new Set());
  }

  if (ingredientIds.length === 0) {
    return {
      aliasCount,
      evidenceCount,
      cautionCount,
      linkedProductCount,
      inciName,
      evidenceLevel,
    };
  }

  const [aliases, evidence, cautions, linked] = await Promise.all([
    client
      .from("ingredient_aliases")
      .select("ingredient_id, alias, alias_type")
      .in("ingredient_id", ingredientIds),
    client
      .from("ingredient_evidence")
      .select("ingredient_id, evidence_level")
      .in("ingredient_id", ingredientIds),
    client
      .from("ingredient_cautions")
      .select("ingredient_id")
      .in("ingredient_id", ingredientIds),
    client
      .from("product_ingredients")
      .select("ingredient_id, product_id")
      .in("ingredient_id", ingredientIds),
  ]);

  if (aliases.error || evidence.error || cautions.error || linked.error) {
    throw new AdminConfigurationError("Unable to load admin ingredients.");
  }

  for (const row of aliases.data ?? []) {
    const record = row as unknown as {
      ingredient_id: number | string;
      alias: string;
      alias_type: string;
    };
    const id = Number(record.ingredient_id);
    if (!Number.isSafeInteger(id)) continue;
    aliasCount.set(id, (aliasCount.get(id) ?? 0) + 1);
    if (record.alias_type === "inci" && record.alias && !inciName.has(id)) {
      inciName.set(id, record.alias);
    }
  }

  for (const row of evidence.data ?? []) {
    const record = row as unknown as {
      ingredient_id: number | string;
      evidence_level: string;
    };
    const id = Number(record.ingredient_id);
    if (!Number.isSafeInteger(id)) continue;
    evidenceCount.set(id, (evidenceCount.get(id) ?? 0) + 1);
    if (record.evidence_level && !evidenceLevel.has(id)) {
      evidenceLevel.set(id, record.evidence_level);
    }
  }

  for (const row of cautions.data ?? []) {
    const record = row as unknown as { ingredient_id: number | string };
    const id = Number(record.ingredient_id);
    if (!Number.isSafeInteger(id)) continue;
    cautionCount.set(id, (cautionCount.get(id) ?? 0) + 1);
  }

  for (const row of linked.data ?? []) {
    const record = row as unknown as {
      ingredient_id: number | string;
      product_id: number | string;
    };
    const id = Number(record.ingredient_id);
    const productId = Number(record.product_id);
    if (!Number.isSafeInteger(id) || !Number.isSafeInteger(productId)) continue;
    const set = linkedProducts.get(id) ?? new Set<number>();
    set.add(productId);
    linkedProducts.set(id, set);
  }

  for (const [id, set] of linkedProducts) {
    linkedProductCount.set(id, set.size);
  }

  return {
    aliasCount,
    evidenceCount,
    cautionCount,
    linkedProductCount,
    inciName,
    evidenceLevel,
  };
}

/**
 * Read-only admin ingredients list.
 * Note: public.ingredients has no active / verified_at / inci_name columns.
 */
export async function getAdminIngredients(
  rawParams: AdminIngredientListParams = {}
): Promise<AdminIngredientListResult> {
  let client: SupabaseClient;

  try {
    client = createSupabaseAdminClient();
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError("Unable to load admin ingredients.");
  }

  const page = parsePositiveInt(rawParams.page, DEFAULT_PAGE);
  const pageSize = parsePositiveInt(
    rawParams.pageSize,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE
  );
  const search = normalizeText(rawParams.search);
  const active = normalizeBoolFilter(rawParams.active);
  const verified = normalizeBoolFilter(rawParams.verified);
  const hasAlias = normalizeBoolFilter(rawParams.hasAlias);
  const hasEvidence = normalizeBoolFilter(rawParams.hasEvidence);
  const hasCaution = normalizeBoolFilter(rawParams.hasCaution);
  const linkedToProduct = normalizeBoolFilter(rawParams.linkedToProduct);
  const sort = normalizeSort(rawParams.sort);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const baseFilters = {
    search,
    active,
    verified,
    hasAlias,
    hasEvidence,
    hasCaution,
    linkedToProduct,
    sort,
  };

  try {
    // No active column: inactive rows do not exist.
    if (active === "false") {
      return emptyListResult(page, pageSize, baseFilters);
    }

    // No verified_at column: no verified ingredients.
    if (verified === "true") {
      return emptyListResult(page, pageSize, baseFilters);
    }

    const relations = await loadRelationMaps(client);

    if (hasAlias === "true" && relations.aliasIds.size === 0) {
      return emptyListResult(page, pageSize, baseFilters);
    }
    if (hasEvidence === "true" && relations.evidenceIds.size === 0) {
      return emptyListResult(page, pageSize, baseFilters);
    }
    if (hasCaution === "true" && relations.cautionIds.size === 0) {
      return emptyListResult(page, pageSize, baseFilters);
    }
    if (linkedToProduct === "true" && relations.linkedIds.size === 0) {
      return emptyListResult(page, pageSize, baseFilters);
    }

    let aliasMatchIds: number[] = [];
    if (search) {
      aliasMatchIds = await findAliasMatchIds(client, search);
    }

    let query = client
      .from("ingredients")
      .select(INGREDIENT_SELECT, { count: "exact" });

    if (search) {
      const pattern = `"%${escapeIlike(search)}%"`;
      if (aliasMatchIds.length > 0) {
        query = query.or(
          `name_en.ilike.${pattern},name_ko.ilike.${pattern},slug.ilike.${pattern},name_ja.ilike.${pattern},id.in.(${aliasMatchIds.join(",")})`
        );
      } else {
        query = query.or(
          `name_en.ilike.${pattern},name_ko.ilike.${pattern},slug.ilike.${pattern},name_ja.ilike.${pattern}`
        );
      }
    }

    const applyInclusion = (
      flag: "" | "true" | "false",
      ids: Set<number>
    ) => {
      if (flag === "true") {
        query = query.in("id", [...ids]);
      } else if (flag === "false" && ids.size > 0) {
        query = query.not("id", "in", `(${[...ids].join(",")})`);
      }
    };

    applyInclusion(hasAlias, relations.aliasIds);
    applyInclusion(hasEvidence, relations.evidenceIds);
    applyInclusion(hasCaution, relations.cautionIds);
    applyInclusion(linkedToProduct, relations.linkedIds);

    switch (sort) {
      case "id_asc":
        query = query.order("id", { ascending: true });
        break;
      case "name_en_asc":
        query = query.order("name_en", { ascending: true });
        break;
      case "name_en_desc":
        query = query.order("name_en", { ascending: false });
        break;
      case "name_ko_asc":
        query = query.order("name_ko", { ascending: true, nullsFirst: false });
        break;
      case "verified_desc":
        // No verified_at column — fall back to id desc.
        query = query.order("id", { ascending: false });
        break;
      case "id_desc":
      default:
        query = query.order("id", { ascending: false });
        break;
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new AdminConfigurationError("Unable to load admin ingredients.");
    }

    const rows = (data ?? []) as unknown as Array<{
      id: number | string;
      slug: string;
      name_en: string;
      name_ko: string | null;
      created_at: string | null;
    }>;

    const ingredientIds = rows
      .map((row) => Number(row.id))
      .filter((id) => Number.isSafeInteger(id) && id > 0);

    const counts = await loadPageCounts(client, ingredientIds);
    const total = count ?? 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    const items: AdminIngredientListItem[] = rows.map((row) => {
      const id = Number(row.id);
      return {
        id,
        nameEn: row.name_en,
        nameKo: row.name_ko,
        slug: row.slug,
        inciName: counts.inciName.get(id) ?? null,
        active: null,
        verifiedAt: null,
        aliasCount: counts.aliasCount.get(id) ?? 0,
        evidenceCount: counts.evidenceCount.get(id) ?? 0,
        cautionCount: counts.cautionCount.get(id) ?? 0,
        linkedProductCount: counts.linkedProductCount.get(id) ?? 0,
        evidenceLevel: counts.evidenceLevel.get(id) ?? null,
      };
    });

    return {
      items,
      page,
      pageSize,
      total,
      totalPages,
      filters: {
        ...baseFilters,
        schemaNotes: {
          hasActiveColumn: false,
          hasVerifiedAtColumn: false,
          hasInciNameColumn: false,
        },
      },
    };
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError("Unable to load admin ingredients.");
  }
}

export function parseAdminIngredientListParams(
  input: URLSearchParams | Record<string, string | string[] | undefined>
): AdminIngredientListParams {
  return {
    page: getSearchParam(input, "page"),
    pageSize: getSearchParam(input, "pageSize"),
    search: getSearchParam(input, "search"),
    active: getSearchParam(input, "active"),
    verified: getSearchParam(input, "verified"),
    hasAlias: getSearchParam(input, "hasAlias"),
    hasEvidence: getSearchParam(input, "hasEvidence"),
    hasCaution: getSearchParam(input, "hasCaution"),
    linkedToProduct: getSearchParam(input, "linkedToProduct"),
    sort: getSearchParam(input, "sort"),
  };
}
