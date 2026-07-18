/**
 * Read-only Staging duplicate investigation for verified-kbeauty-batch.
 * Never writes. Never prints secrets.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateStagingWriteGate,
  STAGING_SUPABASE_REF,
} from "./load-env-staging.mjs";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as NodeModule;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(
  ROOT,
  "reports/verified-batch-duplicate-investigation.json"
);

const DUPES = [
  {
    batchName: "Low pH Good Morning Gel Cleanser",
    batchSlug: "cosrx-low-ph-good-morning-gel-cleanser-150ml",
    batchSize: "150ml",
    batchSourceUrl: "http://www.cosrx.co.kr/shop/shopdetail.html?branduid=222",
    existingId: 4,
    seedSlug: "cosrx-low-ph-good-morning-gel-cleanser",
    seedSourceUrl: "https://www.cosrx.com/products/low-ph-good-morning-gel-cleanser",
  },
  {
    batchName: "The Niacinamide 15 Serum",
    batchSlug: "cosrx-the-niacinamide-15-serum-20ml",
    batchSize: "20ml",
    batchSourceUrl:
      "https://www.cosrx.co.kr/shop/shopdetail.html?branduid=1177564",
    existingId: 7,
    seedSlug: "cosrx-the-niacinamide-15-serum",
    seedSourceUrl: "https://www.cosrx.com/products/the-niacinamide-15-serum",
  },
  {
    batchName: "Advanced Snail 92 All In One Cream",
    batchSlug: "cosrx-advanced-snail-92-all-in-one-cream-100g",
    batchSize: "100g",
    batchSourceUrl: "http://www.cosrx.co.kr/shop/shopdetail.html?branduid=202",
    existingId: 10,
    seedSlug: "cosrx-advanced-snail-92-all-in-one-cream",
    seedSourceUrl:
      "https://www.cosrx.com/products/advanced-snail-92-all-in-one-cream",
  },
];

async function main() {
  const { allow, gate, meta } = evaluateStagingWriteGate(ROOT);
  if (!allow || meta.ref !== STAGING_SUPABASE_REF) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          phase: "skipped",
          gate,
          reason: "staging_gate_not_allow",
          write: "NOT_RUN",
        },
        null,
        2
      )
    );
    process.exit(2);
  }

  const { createSupabaseAdminClient } = await import(
    "../src/lib/supabase/admin"
  );
  const client = createSupabaseAdminClient();
  const ids = DUPES.map((d) => d.existingId);

  const { data: products, error: pErr } = await client
    .from("products")
    .select(
      "id, brand, name, slug, category, verified_at, active, full_ingredients, key_ingredients, created_at"
    )
    .in("id", ids);

  if (pErr) {
    console.log(
      JSON.stringify({
        ok: false,
        phase: "products_query_error",
        message: pErr.message,
        write: "NOT_RUN",
      })
    );
    process.exit(1);
  }

  const items = [];
  for (const dup of DUPES) {
    const p = (products ?? []).find((row) => Number(row.id) === dup.existingId);

    const [variantsRes, offersRes, ingredientsRes, mediaRes] =
      await Promise.all([
        client
          .from("product_variants")
          .select(
            "id, size_value, size_unit, variant_name, formula_version, verification_status, active"
          )
          .eq("product_id", dup.existingId),
        client
          .from("product_offers")
          .select(
            "id, retailer_name, purchase_url, price, currency, stock_status, verification_status, is_official, active, verified_at"
          )
          .eq("product_id", dup.existingId),
        client
          .from("product_ingredients")
          .select("id, source_url, source_type, verification_status, ingredient_order")
          .eq("product_id", dup.existingId)
          .order("ingredient_order", { ascending: true })
          .limit(5),
        client
          .from("catalog_product_media")
          .select("id, image_url, is_primary, validation_status")
          .eq("product_id", dup.existingId)
          .limit(5),
      ]);

    // Also count ingredients
    const { count: ingredientCount } = await client
      .from("product_ingredients")
      .select("id", { count: "exact", head: true })
      .eq("product_id", dup.existingId);

    const variants = variantsRes.error ? [] : (variantsRes.data ?? []);
    const offers = offersRes.error ? [] : (offersRes.data ?? []);
    const ingredientSample = ingredientsRes.error
      ? []
      : (ingredientsRes.data ?? []);
    const media = mediaRes.error ? [] : (mediaRes.data ?? []);

    // Capacity from seed CSV / verify snapshot (products table has no size column).
    const seedSize = dup.batchSize;
    const sameSize = true; // seed CSV size matches batch size for all 3
    const slugDiffers = String(p?.slug ?? "") !== dup.batchSlug;
    const sourceDiffers = true; // seed global vs batch KR mall
    const existingSourceUrls = [
      ...new Set(
        ingredientSample
          .map((r) => String(r.source_url ?? ""))
          .filter(Boolean)
      ),
    ];
    const hasKrOffer = offers.some(
      (o) =>
        String(o.purchase_url ?? "").includes("cosrx.co.kr") ||
        String(o.retailer_name ?? "").toLowerCase().includes("kr")
    );
    const hasGlobalOffer = offers.some((o) =>
      String(o.purchase_url ?? "").includes("cosrx.com")
    );
    const fullInciPresent = Boolean(
      String(p?.full_ingredients ?? "").trim().length > 0
    );

    const judgment = {
      same_product_line: true,
      same_capacity: sameSize,
      seed_overlap: true,
      renewal_suspected: false,
      separate_variant_needed: false,
      reason:
        "동일 COSRX 제품 라인 + 동일 용량. slug만 size suffix 차이. 소스는 cosrx.com(seed) vs cosrx.co.kr(batch). 신규 product row 금지 → 기존 ID에 KR offer/media/KR INCI 보강 검토.",
      recommended_action: "MERGE_INTO_EXISTING",
      fields_addable: [] as string[],
    };

    if (!offers.length || !hasKrOffer) {
      judgment.fields_addable.push("product_offers (KR official mall, unverified)");
    }
    if (!media.length) {
      judgment.fields_addable.push("catalog_product_media / image");
    } else {
      judgment.fields_addable.push(
        "optional: KR-mall primary media refresh (manual review)"
      );
    }
    const hasKrInci = existingSourceUrls.some((u) => u.includes("cosrx.co.kr"));
    if (!hasKrInci) {
      judgment.fields_addable.push(
        "KR INCI / source_url review vs EN seed (do not auto-replace)"
      );
    }
    if (!variants.length) {
      judgment.fields_addable.push(
        `product_variants size=${seedSize} (explicit variant row currently missing)`
      );
    }
    if (p?.verified_at) {
      judgment.fields_addable.push(
        "KEEP verified_at — never auto-Verified / do not clear"
      );
    }

    items.push({
      batch: {
        name: dup.batchName,
        slug: dup.batchSlug,
        size: dup.batchSize,
        source_url: dup.batchSourceUrl,
        preview_status: "brand_name_duplicate",
        canRegister: false,
      },
      existing: {
        id: dup.existingId,
        brand: p?.brand ?? null,
        name: p?.name ?? null,
        slug: p?.slug ?? null,
        seed_size: seedSize,
        category: p?.category ?? null,
        full_ingredients_present: fullInciPresent,
        full_ingredients_length: String(p?.full_ingredients ?? "").length,
        key_ingredients_present: Boolean(p?.key_ingredients),
        verified_at_present: Boolean(p?.verified_at),
        active: p?.active ?? null,
        review_status: p?.verified_at
          ? "verified_at_set (seed)"
          : "needs_review_or_unverified",
        variant_count: variants.length,
        variants: variants.map((v) => ({
          id: v.id,
          size_value: v.size_value,
          size_unit: v.size_unit,
          variant_name: v.variant_name,
          formula_version: v.formula_version,
          verification_status: v.verification_status,
          active: v.active,
        })),
        offer_count: offers.length,
        offers: offers.map((o) => ({
          id: o.id,
          retailer_name: o.retailer_name,
          purchase_url_host: (() => {
            try {
              return new URL(String(o.purchase_url)).hostname;
            } catch {
              return null;
            }
          })(),
          price: o.price,
          currency: o.currency,
          stock_status: o.stock_status,
          verification_status: o.verification_status,
          is_official: o.is_official,
          active: o.active,
          verified_at_present: Boolean(o.verified_at),
        })),
        ingredient_count: ingredientCount ?? 0,
        ingredient_source_hosts: existingSourceUrls.map((u) => {
          try {
            return new URL(u).hostname;
          } catch {
            return "invalid";
          }
        }),
        media_count: media.length,
        media_primary_present: media.some((m) => m.is_primary),
      },
      comparison: {
        brand_name_match: true,
        slug_differs: slugDiffers,
        existing_slug: p?.slug ?? null,
        batch_slug: dup.batchSlug,
        size_same: sameSize,
        source_channel_differs: sourceDiffers,
        seed_source: dup.seedSourceUrl,
        batch_source: dup.batchSourceUrl,
        has_kr_offer: hasKrOffer,
        has_global_offer: hasGlobalOffer,
      },
      judgment,
      query_errors: {
        variants: variantsRes.error?.message ?? null,
        offers: offersRes.error?.message ?? null,
        ingredients: ingredientsRes.error?.message ?? null,
        media: mediaRes.error?.message ?? null,
      },
    });
  }

  const report = {
    ok: true,
    phase: "duplicate_investigation",
    staging_ref: meta.ref,
    gate,
    write: "NOT_RUN",
    import_commit: "NOT_RUN",
    auto_verified: false,
    errors_cause:
      "errors=3 == blocked=3 == brand_name_duplicate only. No other error types (missing_required / image / ingredients).",
    duplicate_product_names: DUPES.map((d) => d.batchName),
    summary: {
      duplicates: 3,
      merge_candidates: items.filter(
        (i) => i.judgment.recommended_action === "MERGE_INTO_EXISTING"
      ).length,
      new_product_allowed: 0,
      separate_variant_needed: 0,
      review_needed: items.length,
      ready_new_products_from_batch: 4,
    },
    items,
    recommended_import_plan: [
      "Commit NOT this cycle for the 3 duplicates as new products.",
      "Import only the 4 ready rows as new needs_review products (if approved).",
      "For IDs 4/7/10: merge path — add missing KR official offer (unverified), optionally attach KR media, review KR INCI vs EN seed INCI manually. Do not create second product. Do not auto-Verified.",
      "Slug difference (-150ml/-20ml/-100g) is naming convention only; capacity already matches seed size.",
      "Snail name casing In/in is not a different SKU.",
    ],
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      ok: false,
      phase: "error",
      message: err instanceof Error ? err.message : String(err),
      write: "NOT_RUN",
    })
  );
  process.exit(1);
});
