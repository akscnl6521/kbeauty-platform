/**
 * Pure read-only Staging confirmation for verified-batch apply.
 * SELECT only — no inserts/updates/deletes.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateStagingWriteGate,
  STAGING_SUPABASE_REF,
  PRODUCTION_SUPABASE_REF,
} from "./load-env-staging.mjs";

const require = createRequire(import.meta.url);
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as NodeModule;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEW_SLUGS = [
  "cosrx-full-fit-propolis-synergy-toner-280ml",
  "cosrx-full-fit-propolis-light-ampoule-30ml",
  "cosrx-ultra-light-invisible-sunserum-50ml",
  "cosrx-full-fit-propolis-light-cream-65g",
];
const MERGE_IDS = [4, 7, 10];
const CASE_TAG = "[verified-batch:2026-07-18]";

function hostOf(url: string | null | undefined): string | null {
  try {
    return url ? new URL(url).hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

function isKr(url: string | null | undefined): boolean {
  const h = hostOf(url);
  return Boolean(h && (h === "cosrx.co.kr" || h === "www.cosrx.co.kr"));
}

async function main() {
  const { allow, gate, meta } = evaluateStagingWriteGate(ROOT);
  if (
    !allow ||
    meta.ref !== STAGING_SUPABASE_REF ||
    meta.isProduction ||
    meta.ref === PRODUCTION_SUPABASE_REF
  ) {
    console.log(
      JSON.stringify({ ok: false, gate, ref: meta.ref, reason: "not_staging" })
    );
    process.exit(3);
  }

  const { createSupabaseAdminClient } = await import(
    "../src/lib/supabase/admin"
  );
  const client = createSupabaseAdminClient();

  const { data: newProducts, error: npErr } = await client
    .from("products")
    .select("id, slug, brand, name, active, verified_at")
    .in("slug", NEW_SLUGS)
    .order("id", { ascending: true });
  if (npErr) throw new Error(npErr.message);

  const newIds = (newProducts ?? []).map((p) => Number(p.id));
  const allIds = [...newIds, ...MERGE_IDS];

  const { data: mergeProducts, error: mpErr } = await client
    .from("products")
    .select("id, slug, brand, name, active, verified_at")
    .in("id", MERGE_IDS)
    .order("id", { ascending: true });
  if (mpErr) throw new Error(mpErr.message);

  const { data: offers, error: oErr } = await client
    .from("product_offers")
    .select(
      "id, product_id, purchase_url, verification_status, verified_at, source, is_official"
    )
    .in("product_id", allIds);
  if (oErr) throw new Error(oErr.message);

  const { data: media, error: mErr } = await client
    .from("catalog_product_media")
    .select("id, product_id, is_primary")
    .in("product_id", allIds);
  if (mErr) throw new Error(mErr.message);

  const { data: ingredients, error: iErr } = await client
    .from("product_ingredients")
    .select("id, product_id")
    .in("product_id", allIds);
  if (iErr) throw new Error(iErr.message);

  // variants: SELECT may work even if INSERT denied
  const { data: variants, error: vErr } = await client
    .from("product_variants")
    .select("id, product_id, size_value, size_unit")
    .in("product_id", allIds);

  const { data: provenance, error: pErr } = await client
    .from("product_field_provenance")
    .select("id, product_id, field_name, verified_status, value_summary")
    .in("product_id", MERGE_IDS)
    .in("field_name", [
      "full_ingredients_kr_pending_review",
      "size_label_pending",
    ]);
  if (pErr) {
    // non-fatal
  }

  const offerRows = offers ?? [];
  const batchOffers = offerRows.filter((o) => o.source === CASE_TAG);
  const krCounts: Record<number, number> = {};
  const dupOfferPairs: string[] = [];
  for (const id of allIds) {
    const kr = offerRows.filter(
      (o) => Number(o.product_id) === id && isKr(String(o.purchase_url))
    );
    krCounts[id] = kr.length;
  }
  // duplicate product by slug among new
  const slugCounts = new Map<string, number>();
  for (const p of newProducts ?? []) {
    slugCounts.set(p.slug, (slugCounts.get(p.slug) || 0) + 1);
  }
  const dupProducts = [...slugCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([s]) => s);

  // same purchase_url twice on same product
  const urlKey = new Map<string, number>();
  for (const o of offerRows) {
    const k = `${o.product_id}|${String(o.purchase_url || "").trim()}`;
    urlKey.set(k, (urlKey.get(k) || 0) + 1);
  }
  for (const [k, n] of urlKey) {
    if (n > 1) dupOfferPairs.push(k);
  }

  const mergeVerifiedOk = (mergeProducts ?? []).every(
    (p) => Boolean(p.verified_at) && p.active === true
  );
  const newNeedsReview = (newProducts ?? []).filter(
    (p) => p.active === false && p.verified_at == null
  );

  const report = {
    ok: true,
    read_only: true,
    staging_ref: meta.ref,
    gate,
    db_write_confirmed: newIds.length === 4,
    new_products: (newProducts ?? []).map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      active: p.active,
      verified_at: p.verified_at,
      needs_review: p.active === false && p.verified_at == null,
    })),
    new_product_ids: newIds,
    new_product_count: newIds.length,
    merge_products: (mergeProducts ?? []).map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      active: p.active,
      verified_at: p.verified_at,
      kr_offer_count: krCounts[Number(p.id)] ?? 0,
      kr_inci_provenance: (provenance ?? []).filter(
        (x) =>
          Number(x.product_id) === Number(p.id) &&
          x.field_name === "full_ingredients_kr_pending_review"
      ).length,
      size_provenance: (provenance ?? []).filter(
        (x) =>
          Number(x.product_id) === Number(p.id) &&
          x.field_name === "size_label_pending"
      ).length,
    })),
    variant_count_for_targets: vErr ? null : (variants ?? []).length,
    variant_select_error: vErr?.message ?? null,
    offer_counts: {
      batch_tagged_total: batchOffers.length,
      on_new_products: offerRows.filter((o) =>
        newIds.includes(Number(o.product_id))
      ).length,
      on_merge_ids: offerRows.filter((o) =>
        MERGE_IDS.includes(Number(o.product_id))
      ).length,
      kr_by_product: krCounts,
      id10_kr_offers: krCounts[10] ?? 0,
    },
    media_counts: {
      on_new: (media ?? []).filter((m) =>
        newIds.includes(Number(m.product_id))
      ).length,
      on_merge: (media ?? []).filter((m) =>
        MERGE_IDS.includes(Number(m.product_id))
      ).length,
      total_targets: (media ?? []).length,
    },
    ingredient_counts: {
      on_new: (ingredients ?? []).filter((r) =>
        newIds.includes(Number(r.product_id))
      ).length,
      on_merge: (ingredients ?? []).filter((r) =>
        MERGE_IDS.includes(Number(r.product_id))
      ).length,
      total_targets: (ingredients ?? []).length,
    },
    needs_review_new_count: newNeedsReview.length,
    existing_verified_preserved: mergeVerifiedOk,
    duplicate_products: dupProducts,
    duplicate_offers_same_url: dupOfferPairs,
    rollback_needed: false,
    rollback_reason:
      newIds.length === 4 && mergeVerifiedOk && dupProducts.length === 0
        ? "not_needed_partial_success_variants_only_gap"
        : "review_manually",
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, message: String(e) }));
  process.exit(1);
});
