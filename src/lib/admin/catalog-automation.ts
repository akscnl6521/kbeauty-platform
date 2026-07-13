import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";

export type AdminCatalogSourceRow = {
  id: string;
  name: string;
  sourceType: string;
  sourceTier: number;
  authorizationStatus: string;
  automationAllowed: boolean;
  robotsStatus: string;
  termsStatus: string;
  retailerType: string | null;
  countryCode: string | null;
  isActive: boolean;
  baseUrl: string | null;
};

export async function listCatalogSources(): Promise<AdminCatalogSourceRow[]> {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("catalog_sources")
    .select(
      "id, name, source_type, source_tier, authorization_status, automation_allowed, robots_status, terms_status, retailer_type, country_code, is_active, base_url"
    )
    .order("name");
  if (error) {
    throw new AdminConfigurationError("Unable to load catalog sources.");
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    sourceType: String(row.source_type),
    sourceTier: Number(row.source_tier),
    authorizationStatus: String(row.authorization_status),
    automationAllowed: Boolean(row.automation_allowed),
    robotsStatus: String(row.robots_status),
    termsStatus: String(row.terms_status),
    retailerType: row.retailer_type == null ? null : String(row.retailer_type),
    countryCode: row.country_code == null ? null : String(row.country_code),
    isActive: Boolean(row.is_active),
    baseUrl: row.base_url == null ? null : String(row.base_url),
  }));
}

export async function listCatalogJobs(limit = 50) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("catalog_crawl_jobs")
    .select(
      "id, source_id, job_type, status, discovered_count, fetched_count, parsed_count, staged_count, needs_review_count, approved_count, rejected_count, error_count, dry_run, created_at, started_at, finished_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new AdminConfigurationError("Unable to load catalog jobs.");
  }
  return data ?? [];
}

export async function listStagingProducts(limit = 100) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("catalog_staging_products")
    .select(
      "id, brand_raw, brand_canonical, product_name_raw, product_name_ko, category_canonical, size_value, size_unit, product_status, ingredients_status, official_product_url, primary_image_url, duplicate_group_key, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new AdminConfigurationError("Unable to load staging products.");
  }
  return data ?? [];
}

export async function listStagingIngredients(limit = 200) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("catalog_staging_ingredients")
    .select(
      "id, staging_product_id, display_order, ingredient_raw, inci_name, canonical_key, normalization_status, confidence, source_url, source_verified"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new AdminConfigurationError("Unable to load staging ingredients.");
  }
  return data ?? [];
}

export async function listStagingOffers(limit = 100) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("catalog_staging_offers")
    .select(
      "id, staging_product_id, retailer_name_raw, seller_name, country_code, currency, price, in_stock, purchase_url, is_official_store, is_authorized_retailer, offer_status, last_checked_at, validation_errors"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new AdminConfigurationError("Unable to load staging offers.");
  }
  return data ?? [];
}

export async function listReviewQueue(limit = 100) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("catalog_staging_products")
    .select(
      "id, brand_canonical, product_name_raw, category_canonical, product_status, ingredients_status, official_product_url, validation_errors, duplicate_group_key, created_at"
    )
    .in("product_status", ["needs_review", "source_verified", "data_complete", "duplicate_candidate"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new AdminConfigurationError("Unable to load review queue.");
  }
  return data ?? [];
}
