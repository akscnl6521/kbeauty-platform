/**
 * Post-apply verification for verified-batch Staging import (read-mostly).
 * Also records size_label_pending provenance for new products 17-20.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { evaluateStagingWriteGate, STAGING_SUPABASE_REF } from "./load-env-staging.mjs";

const require = createRequire(import.meta.url);
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as NodeModule;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEW_IDS = [17, 18, 19, 20];
const MERGE_IDS = [4, 7, 10];
const SIZES: Record<number, string> = {
  17: "280ml",
  18: "30ml",
  19: "50ml",
  20: "65g",
  4: "150ml",
  7: "20ml",
  10: "100g",
};

function sha(t: string) {
  return crypto.createHash("sha256").update(t).digest("hex");
}

async function main() {
  const { allow, meta } = evaluateStagingWriteGate(ROOT);
  if (!allow || meta.ref !== STAGING_SUPABASE_REF) {
    console.log(JSON.stringify({ ok: false, reason: "gate" }));
    process.exit(2);
  }
  const { createSupabaseAdminClient } = await import("../src/lib/supabase/admin");
  const client = createSupabaseAdminClient();

  for (const id of [...NEW_IDS, ...MERGE_IDS]) {
    const sizeLabel = SIZES[id];
    const sizeHash = sha(`size_label_pending|${sizeLabel}`);
    await client.from("product_field_provenance").upsert(
      {
        entity_type: "product",
        entity_id: String(id),
        product_id: id,
        field_name: "size_label_pending",
        value_summary: sizeLabel,
        value_hash: sizeHash,
        source_domain: "www.cosrx.co.kr",
        extraction_method: "verified_kbeauty_batch_size",
        confidence: 0.9,
        raw_hash: sha(sizeLabel),
        verified_status: "needs_review",
      },
      {
        onConflict: "entity_type,entity_id,field_name,value_hash",
        ignoreDuplicates: true,
      }
    );
  }

  const { data: products } = await client
    .from("products")
    .select("id, slug, active, verified_at")
    .in("id", [...NEW_IDS, ...MERGE_IDS]);

  const { data: offers } = await client
    .from("product_offers")
    .select("id, product_id, purchase_url, verification_status, verified_at, source")
    .in("product_id", [...NEW_IDS, ...MERGE_IDS]);

  const { data: media } = await client
    .from("catalog_product_media")
    .select("id, product_id, is_primary")
    .in("product_id", [...NEW_IDS, ...MERGE_IDS]);

  const { count: productsTotal } = await client
    .from("products")
    .select("id", { count: "exact", head: true });
  const { count: offersTotal } = await client
    .from("product_offers")
    .select("id", { count: "exact", head: true });
  const { count: mediaTotal } = await client
    .from("catalog_product_media")
    .select("id", { count: "exact", head: true });
  const { count: ingredientsTotal } = await client
    .from("product_ingredients")
    .select("id", { count: "exact", head: true });

  const offerRows = offers ?? [];
  const krByProduct: Record<number, number> = {};
  for (const id of [...NEW_IDS, ...MERGE_IDS]) {
    krByProduct[id] = offerRows.filter(
      (o) =>
        Number(o.product_id) === id &&
        String(o.purchase_url || "").includes("cosrx.co.kr")
    ).length;
  }

  const report = {
    ok: true,
    staging_ref: meta.ref,
    totals: {
      products: productsTotal,
      offers: offersTotal,
      media: mediaTotal,
      ingredients: ingredientsTotal,
      variants: 0,
    },
    new_products: (products ?? []).filter((p) => NEW_IDS.includes(Number(p.id))),
    merge_products: (products ?? []).filter((p) =>
      MERGE_IDS.includes(Number(p.id))
    ),
    kr_offer_counts: krByProduct,
    id10_kr_offers: krByProduct[10],
    new_all_needs_review: (products ?? [])
      .filter((p) => NEW_IDS.includes(Number(p.id)))
      .every((p) => p.active === false && p.verified_at == null),
    merge_verified_preserved: (products ?? [])
      .filter((p) => MERGE_IDS.includes(Number(p.id)))
      .every((p) => Boolean(p.verified_at) && p.active === true),
    media_for_new: (media ?? []).filter((m) =>
      NEW_IDS.includes(Number(m.product_id))
    ).length,
    media_for_merge: (media ?? []).filter((m) =>
      MERGE_IDS.includes(Number(m.product_id))
    ).length,
    sample_offers: offerRows.map((o) => ({
      product_id: o.product_id,
      host: (() => {
        try {
          return new URL(String(o.purchase_url)).hostname;
        } catch {
          return null;
        }
      })(),
      verification_status: o.verification_status,
      verified_at_present: Boolean(o.verified_at),
      source: o.source,
    })),
  };

  fs.writeFileSync(
    path.join(ROOT, "reports/verified-batch-staging-verify.json"),
    JSON.stringify(report, null, 2) + "\n"
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, message: String(e) }));
  process.exit(1);
});
