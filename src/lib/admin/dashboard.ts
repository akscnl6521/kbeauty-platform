import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";

export type AdminDashboardData = {
  catalog: {
    products: number;
    ingredients: number;
    offers: number;
    brands: number;
    variants: number;
  };
  verification: {
    discovered: number;
    sale_checked: number;
    ingredients_checked: number;
    evidence_checked: number;
    safety_checked: number;
    verified: number;
    published: number;
    needs_review: number;
    rejected: number;
  };
  queue: {
    pending: number;
    in_review: number;
    approved: number;
    rejected: number;
    needs_review: number;
  };
  quality: {
    ingredientEvidence: number;
    ingredientCautions: number;
    verifiedProductIngredients: number;
    verifiedOffers: number;
  };
  system: {
    adminCount: number;
    activeAdminCount: number;
  };
};

const WORKFLOW_STATUSES = [
  "discovered",
  "sale_checked",
  "ingredients_checked",
  "evidence_checked",
  "safety_checked",
  "verified",
  "published",
  "needs_review",
  "rejected",
] as const;

const QUEUE_STATUSES = [
  "pending",
  "in_review",
  "approved",
  "rejected",
  "needs_review",
] as const;

type EqFilter = { column: string; value: string | boolean };

function emptyCounts<T extends string>(
  keys: readonly T[]
): Record<T, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<T, number>;
}

async function countExact(
  client: SupabaseClient,
  table: string,
  filter?: EqFilter
): Promise<number> {
  let query = client.from(table).select("*", { count: "exact", head: true });
  if (filter) {
    query = query.eq(filter.column, filter.value);
  }

  const { count, error } = await query;
  if (error) {
    throw new AdminConfigurationError("Unable to load admin dashboard.");
  }
  return count ?? 0;
}

async function countByValue<T extends string>(
  client: SupabaseClient,
  table: string,
  column: string,
  keys: readonly T[]
): Promise<Record<T, number>> {
  const counts = emptyCounts(keys);
  const { data, error } = await client.from(table).select(column);

  if (error) {
    throw new AdminConfigurationError("Unable to load admin dashboard.");
  }

  for (const row of data ?? []) {
    const record = row as unknown as Record<string, unknown>;
    const value = record[column];
    if (typeof value === "string" && value in counts) {
      counts[value as T] += 1;
    }
  }

  return counts;
}

/**
 * Read-only admin dashboard aggregates (service-role server client).
 * SELECT / count only — no writes. Does not return user ids or emails.
 */
export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  let client: SupabaseClient;

  try {
    client = createSupabaseAdminClient();
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError("Unable to load admin dashboard.");
  }

  try {
    const [
      products,
      ingredients,
      offers,
      brands,
      variants,
      verification,
      queue,
      ingredientEvidence,
      ingredientCautions,
      verifiedProductIngredients,
      verifiedOffers,
      adminCount,
      activeAdminCount,
    ] = await Promise.all([
      countExact(client, "products"),
      countExact(client, "ingredients"),
      countExact(client, "product_offers"),
      countExact(client, "brands"),
      countExact(client, "product_variants"),
      countByValue(
        client,
        "product_discovery_candidates",
        "workflow_status",
        WORKFLOW_STATUSES
      ),
      countByValue(client, "verification_queue", "status", QUEUE_STATUSES),
      countExact(client, "ingredient_evidence"),
      countExact(client, "ingredient_cautions"),
      countExact(client, "product_ingredients", {
        column: "verification_status",
        value: "approved",
      }),
      countExact(client, "product_offers", {
        column: "verification_status",
        value: "verified",
      }),
      countExact(client, "admin_users"),
      countExact(client, "admin_users", { column: "active", value: true }),
    ]);

    return {
      catalog: { products, ingredients, offers, brands, variants },
      verification,
      queue,
      quality: {
        ingredientEvidence,
        ingredientCautions,
        verifiedProductIngredients,
        verifiedOffers,
      },
      system: { adminCount, activeAdminCount },
    };
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    throw new AdminConfigurationError("Unable to load admin dashboard.");
  }
}
