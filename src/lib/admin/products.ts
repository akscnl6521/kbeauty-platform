import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  escapeIlike,
  normalizeBoolFilter,
  normalizeText,
  parsePositiveInt,
} from "@/lib/admin/query";

export type AdminProductListItem = {
  id: number;
  name: string;
  slug: string | null;
  brand: string;
  category: string | null;
  active: boolean | null;
  verifiedAt: string | null;
  dataConfidence: string | null;
  keyIngredientsCount: number;
  fullIngredientsCount: number;
  offerCount: number;
  verifiedOfferCount: number;
};

export type AdminProductSort =
  | "id_desc"
  | "id_asc"
  | "name_asc"
  | "name_desc"
  | "verified_desc";

export type AdminProductListParams = {
  page?: number | string | null;
  pageSize?: number | string | null;
  search?: string | null;
  brand?: string | null;
  category?: string | null;
  active?: string | null;
  verified?: string | null;
  sort?: string | null;
};

export type AdminProductListResult = {
  items: AdminProductListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filters: {
    search: string;
    brand: string;
    category: string;
    active: "" | "true" | "false";
    verified: "" | "true" | "false";
    sort: AdminProductSort;
    brands: string[];
    categories: string[];
  };
};

type ProductRow = {
  id: number | string;
  name: string;
  slug: string | null;
  brand: string;
  category: string | null;
  active: boolean | null;
  verified_at: string | null;
  data_confidence: string | null;
  key_ingredients: string[] | null;
  full_ingredients: string[] | null;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_SORT: AdminProductSort = "id_desc";

const ALLOWED_SORTS = new Set<AdminProductSort>([
  "id_desc",
  "id_asc",
  "name_asc",
  "name_desc",
  "verified_desc",
]);

const PRODUCT_SELECT =
  "id, name, slug, brand, category, active, verified_at, data_confidence, key_ingredients, full_ingredients";

function normalizeSort(value: string | null | undefined): AdminProductSort {
  if (value && ALLOWED_SORTS.has(value as AdminProductSort)) {
    return value as AdminProductSort;
  }
  return DEFAULT_SORT;
}

function arrayLength(value: string[] | null | undefined): number {
  return Array.isArray(value) ? value.length : 0;
}

async function loadFilterOptions(client: SupabaseClient): Promise<{
  brands: string[];
  categories: string[];
}> {
  const { data, error } = await client.from("products").select("brand, category");

  if (error) {
    throw new AdminConfigurationError("Unable to load admin products.");
  }

  const brands = new Set<string>();
  const categories = new Set<string>();

  for (const row of data ?? []) {
    const record = row as unknown as { brand?: unknown; category?: unknown };
    if (typeof record.brand === "string" && record.brand.trim()) {
      brands.add(record.brand);
    }
    if (typeof record.category === "string" && record.category.trim()) {
      categories.add(record.category);
    }
  }

  return {
    brands: [...brands].sort((a, b) => a.localeCompare(b)),
    categories: [...categories].sort((a, b) => a.localeCompare(b)),
  };
}

async function loadOfferCounts(
  client: SupabaseClient,
  productIds: number[]
): Promise<Map<number, { offerCount: number; verifiedOfferCount: number }>> {
  const map = new Map<
    number,
    { offerCount: number; verifiedOfferCount: number }
  >();

  for (const id of productIds) {
    map.set(id, { offerCount: 0, verifiedOfferCount: 0 });
  }

  if (productIds.length === 0) return map;

  const { data, error } = await client
    .from("product_offers")
    .select("product_id, verification_status")
    .in("product_id", productIds);

  if (error) {
    throw new AdminConfigurationError("Unable to load admin products.");
  }

  for (const row of data ?? []) {
    const record = row as unknown as {
      product_id?: unknown;
      verification_status?: unknown;
    };
    const productId = Number(record.product_id);
    if (!Number.isFinite(productId)) continue;

    const entry = map.get(productId) ?? {
      offerCount: 0,
      verifiedOfferCount: 0,
    };
    entry.offerCount += 1;
    if (record.verification_status === "verified") {
      entry.verifiedOfferCount += 1;
    }
    map.set(productId, entry);
  }

  return map;
}

/**
 * Read-only admin product list (service-role). SELECT / count only.
 */
export async function getAdminProducts(
  rawParams: AdminProductListParams = {}
): Promise<AdminProductListResult> {
  let client: SupabaseClient;

  try {
    client = createSupabaseAdminClient();
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError("Unable to load admin products.");
  }

  const page = parsePositiveInt(rawParams.page, DEFAULT_PAGE);
  const pageSize = parsePositiveInt(
    rawParams.pageSize,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE
  );
  const search = normalizeText(rawParams.search);
  const brand = normalizeText(rawParams.brand);
  const category = normalizeText(rawParams.category);
  const active = normalizeBoolFilter(rawParams.active);
  const verified = normalizeBoolFilter(rawParams.verified);
  const sort = normalizeSort(rawParams.sort);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const filterOptionsPromise = loadFilterOptions(client);

    let query = client
      .from("products")
      .select(PRODUCT_SELECT, { count: "exact" });

    if (search) {
      const pattern = `"%${escapeIlike(search)}%"`;
      query = query.or(
        `name.ilike.${pattern},brand.ilike.${pattern},slug.ilike.${pattern}`
      );
    }

    if (brand) {
      query = query.eq("brand", brand);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (active === "true") {
      query = query.eq("active", true);
    } else if (active === "false") {
      query = query.eq("active", false);
    }

    if (verified === "true") {
      query = query.not("verified_at", "is", null);
    } else if (verified === "false") {
      query = query.is("verified_at", null);
    }

    switch (sort) {
      case "id_asc":
        query = query.order("id", { ascending: true });
        break;
      case "name_asc":
        query = query.order("name", { ascending: true });
        break;
      case "name_desc":
        query = query.order("name", { ascending: false });
        break;
      case "verified_desc":
        query = query.order("verified_at", {
          ascending: false,
          nullsFirst: false,
        });
        break;
      case "id_desc":
      default:
        query = query.order("id", { ascending: false });
        break;
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new AdminConfigurationError("Unable to load admin products.");
    }

    const rows = (data ?? []) as unknown as ProductRow[];
    const productIds = rows.map((row) => Number(row.id)).filter(Number.isFinite);
    const [offerCounts, filterOptions] = await Promise.all([
      loadOfferCounts(client, productIds),
      filterOptionsPromise,
    ]);

    const total = count ?? 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    const items: AdminProductListItem[] = rows.map((row) => {
      const id = Number(row.id);
      const offers = offerCounts.get(id) ?? {
        offerCount: 0,
        verifiedOfferCount: 0,
      };

      return {
        id,
        name: row.name,
        slug: row.slug,
        brand: row.brand,
        category: row.category,
        active: row.active,
        verifiedAt: row.verified_at,
        dataConfidence: row.data_confidence,
        keyIngredientsCount: arrayLength(row.key_ingredients),
        fullIngredientsCount: arrayLength(row.full_ingredients),
        offerCount: offers.offerCount,
        verifiedOfferCount: offers.verifiedOfferCount,
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
        brand,
        category,
        active,
        verified,
        sort,
        brands: filterOptions.brands,
        categories: filterOptions.categories,
      },
    };
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError("Unable to load admin products.");
  }
}

/** Parse URLSearchParams / Next searchParams into list params. */
export function parseAdminProductListParams(
  input: URLSearchParams | Record<string, string | string[] | undefined>
): AdminProductListParams {
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
    brand: get("brand"),
    category: get("category"),
    active: get("active"),
    verified: get("verified"),
    sort: get("sort"),
  };
}
