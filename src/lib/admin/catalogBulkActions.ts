/**
 * Staging-only bulk actions for catalog_staging_products.
 */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertStagingCatalogWriteAllowed } from "@/lib/admin/stagingWriteGate";
import { AdminConfigurationError } from "@/lib/auth/errors";

export type BulkAction =
  | "approve"
  | "hold"
  | "reject"
  | "merge_duplicates"
  | "set_category";

export type BulkFilter = {
  sprintTag?: string;
  matchClass?: string;
  productStatus?: string;
  missing?: "inci" | "image" | "pdp" | "source_conflict";
  brand?: string;
  domain?: string;
  ids?: string[];
};

export type BulkPreviewResult = {
  expectedCount: number;
  action: BulkAction;
  filter: BulkFilter;
};

function applyFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filter: BulkFilter
) {
  const sprint = filter.sprintTag || "full-beauty-20260714";
  query = query.eq("sprint_tag", sprint);
  if (filter.ids?.length) query = query.in("id", filter.ids);
  if (filter.matchClass) query = query.eq("match_class", filter.matchClass);
  if (filter.productStatus) query = query.eq("product_status", filter.productStatus);
  if (filter.brand?.trim()) {
    query = query.ilike("brand_canonical", `%${filter.brand.trim()}%`);
  }
  if (filter.domain?.trim()) query = query.eq("beauty_domain", filter.domain.trim());
  if (filter.missing === "inci") query = query.eq("ingredients_status", "not_found");
  if (filter.missing === "image") query = query.is("primary_image_url", null);
  if (filter.missing === "pdp") {
    query = query.or(
      "official_product_url.is.null,match_class.eq.match_failed,match_class.eq.rejected_candidate"
    );
  }
  if (filter.missing === "source_conflict") {
    query = query.contains("enrichment_reasons", ["renewal_or_name_mismatch_suspect"]);
  }
  return query;
}

export async function previewBulkAction(
  action: BulkAction,
  filter: BulkFilter
): Promise<BulkPreviewResult> {
  const gate = assertStagingCatalogWriteAllowed();
  if (!gate.ok) throw new AdminConfigurationError(gate.message);
  const client = createSupabaseAdminClient();
  let query = client
    .from("catalog_staging_products")
    .select("id", { count: "exact", head: true });
  query = applyFilters(query, filter);
  const { count, error } = await query;
  if (error) throw new AdminConfigurationError(error.message);
  return { expectedCount: count ?? 0, action, filter };
}

export async function commitBulkAction(input: {
  action: BulkAction;
  filter: BulkFilter;
  dryRun?: boolean;
  categoryCanonical?: string;
  actor?: string;
}): Promise<{ appliedCount: number; expectedCount: number; dryRun: boolean }> {
  const gate = assertStagingCatalogWriteAllowed();
  if (!gate.ok) throw new AdminConfigurationError(gate.message);

  const preview = await previewBulkAction(input.action, input.filter);
  if (input.dryRun !== false) {
    const client = createSupabaseAdminClient();
    await client.from("catalog_bulk_audit").insert({
      action: input.action,
      filter_snapshot: input.filter,
      expected_count: preview.expectedCount,
      applied_count: 0,
      dry_run: true,
      actor: input.actor ?? null,
      notes: "preview_only",
    });
    return {
      appliedCount: 0,
      expectedCount: preview.expectedCount,
      dryRun: true,
    };
  }

  const client = createSupabaseAdminClient();
  let patch: Record<string, unknown> = {};
  switch (input.action) {
    case "approve":
      patch = {
        product_status: "approved",
        recommendable: false, // still not public verified auto-promote
        reviewed_at: new Date().toISOString(),
      };
      break;
    case "hold":
      patch = { product_status: "needs_review" };
      break;
    case "reject":
      patch = { product_status: "rejected", recommendable: false };
      break;
    case "merge_duplicates":
      patch = { product_status: "duplicate_candidate", recommendable: false };
      break;
    case "set_category":
      if (!input.categoryCanonical?.trim()) {
        throw new AdminConfigurationError("categoryCanonical required");
      }
      patch = {
        category_canonical: input.categoryCanonical.trim(),
        category_raw: input.categoryCanonical.trim(),
      };
      break;
    default:
      throw new AdminConfigurationError("Unknown action");
  }

  // Fetch ids then update (supabase filter update)
  let selectQ = client.from("catalog_staging_products").select("id");
  selectQ = applyFilters(selectQ, input.filter);
  const { data: idsRows, error: selErr } = await selectQ.limit(5000);
  if (selErr) throw new AdminConfigurationError(selErr.message);
  const ids = (idsRows ?? []).map((r) => String((r as { id: string }).id));
  if (ids.length === 0) {
    await client.from("catalog_bulk_audit").insert({
      action: input.action,
      filter_snapshot: input.filter,
      expected_count: 0,
      applied_count: 0,
      dry_run: false,
      actor: input.actor ?? null,
    });
    return { appliedCount: 0, expectedCount: 0, dryRun: false };
  }

  const { error: updErr } = await client
    .from("catalog_staging_products")
    .update(patch)
    .in("id", ids);
  if (updErr) throw new AdminConfigurationError(updErr.message);

  await client.from("catalog_bulk_audit").insert({
    action: input.action,
    filter_snapshot: input.filter,
    expected_count: preview.expectedCount,
    applied_count: ids.length,
    dry_run: false,
    actor: input.actor ?? null,
  });

  return {
    appliedCount: ids.length,
    expectedCount: preview.expectedCount,
    dryRun: false,
  };
}
