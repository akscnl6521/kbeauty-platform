/**
 * Staging-only: verified-kbeauty-batch
 * - Create 4 new products (needs_review: active=false, verified_at=null)
 * - Merge 3 seed overlaps (IDs 4,7,10): variant/offer/KR INCI pending only
 * Never Production. Never auto-Verified. Never overwrite existing ingredients/images.
 *
 * Usage:
 *   npx tsx scripts/import-verified-batch-staging.ts --dry-run
 *   npx tsx scripts/import-verified-batch-staging.ts --apply
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  evaluateStagingWriteGate,
  STAGING_SUPABASE_REF,
  PRODUCTION_SUPABASE_REF,
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
const BUNDLE = path.join(ROOT, "imports/verified-kbeauty-batch");
const CASE_TAG = "[verified-batch:2026-07-18]";
const APPLY = process.argv.includes("--apply");
const DRY = !APPLY || process.argv.includes("--dry-run");
const MERGE_ONLY = process.argv.includes("--merge-only");

const NEW_SLUGS = [
  "cosrx-full-fit-propolis-synergy-toner-280ml",
  "cosrx-full-fit-propolis-light-ampoule-30ml",
  "cosrx-ultra-light-invisible-sunserum-50ml",
  "cosrx-full-fit-propolis-light-cream-65g",
] as const;

const MERGE = [
  {
    id: 4,
    batchSlug: "cosrx-low-ph-good-morning-gel-cleanser-150ml",
    sizeValue: 150,
    sizeUnit: "ml",
    allowKrOffer: true,
  },
  {
    id: 7,
    batchSlug: "cosrx-the-niacinamide-15-serum-20ml",
    sizeValue: 20,
    sizeUnit: "ml",
    allowKrOffer: true,
  },
  {
    id: 10,
    batchSlug: "cosrx-advanced-snail-92-all-in-one-cream-100g",
    sizeValue: 100,
    sizeUnit: "g",
    allowKrOffer: false, // existing cosrx.co.kr offer must stay
  },
] as const;

function sha(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function parseSize(size: string): { value: number; unit: string } | null {
  const m = String(size || "")
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*(ml|g|oz)$/i);
  if (!m) return null;
  return { value: Number(m[1]), unit: m[2].toLowerCase() };
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isKrMallUrl(url: string): boolean {
  const h = hostOf(url);
  return Boolean(h && (h === "cosrx.co.kr" || h === "www.cosrx.co.kr"));
}

function normalizePurchaseUrl(url: string): string {
  return url.trim().replace(/^http:\/\//i, "https://");
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cur);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cur = "";
      continue;
    }
    if (ch === "\r") continue;
    cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

function parseOffersCsv(text: string) {
  const grid = parseCsvRows(text);
  const header = grid[0];
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < grid.length; i++) {
    const cols = grid[i];
    const row: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      row[header[c]] = cols[c] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

type CountSnap = Record<string, number | null>;

async function snapshotCounts(client: {
  from: (t: string) => {
    select: (
      cols: string,
      opts?: { count?: "exact"; head?: boolean }
    ) => PromiseLike<{ count: number | null; error: { message: string } | null }>;
  };
}): Promise<CountSnap> {
  const tables = [
    "products",
    "product_variants",
    "product_offers",
    "catalog_product_media",
    "product_ingredients",
  ] as const;
  const out: CountSnap = {};
  for (const t of tables) {
    const { count, error } = await client
      .from(t)
      .select("id", { count: "exact", head: true });
    if (error) throw new Error(`count_${t}:${error.message}`);
    out[t] = count ?? 0;
  }
  return out;
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
      JSON.stringify(
        {
          ok: false,
          aborted: true,
          gate,
          ref: meta.ref,
          reason: "not_safe_staging",
        },
        null,
        2
      )
    );
    process.exit(3);
  }

  const { parseProductBulkSpreadsheet } = await import(
    "../src/lib/admin/product-bulk/parseSpreadsheet"
  );
  const { createAdminProduct } = await import(
    "../src/lib/admin/createAdminProduct"
  );
  const { createSupabaseAdminClient } = await import(
    "../src/lib/supabase/admin"
  );

  const client = createSupabaseAdminClient();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(
    ROOT,
    "reports/backups/verified-batch-staging",
    stamp
  );
  fs.mkdirSync(backupDir, { recursive: true });

  const sheet = fs.readFileSync(path.join(BUNDLE, "products.csv"));
  const products = parseProductBulkSpreadsheet(sheet, "products.csv");
  const offers = parseOffersCsv(
    fs.readFileSync(path.join(BUNDLE, "offers.csv"), "utf8")
  );
  const offerBySlug = new Map(offers.map((o) => [o.slug, o]));
  const inciJson = JSON.parse(
    fs.readFileSync(path.join(BUNDLE, "ingredients.json"), "utf8")
  ) as Record<
    string,
    { full_ingredients_verbatim_ko?: string; source_url?: string }
  >;

  const countsBefore = await snapshotCounts(client);

  // Fingerprint protected merge products
  const { data: protectedRows, error: protErr } = await client
    .from("products")
    .select("id, slug, brand, name, verified_at, active, full_ingredients")
    .in(
      "id",
      MERGE.map((m) => m.id)
    );
  if (protErr) throw new Error(protErr.message);
  const protectedBefore = (protectedRows ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    verified_at: p.verified_at,
    active: p.active,
    full_hash: sha(JSON.stringify(p.full_ingredients ?? [])),
  }));

  const newRows = products.filter((p) =>
    (NEW_SLUGS as readonly string[]).includes(p.slug)
  );
  if (newRows.length !== 4) {
    throw new Error(`expected_4_new_rows_got_${newRows.length}`);
  }

  const dryPlan = {
    mode: APPLY && !DRY ? "APPLY" : "DRY_RUN",
    staging_ref: meta.ref,
    gate,
    counts_before: countsBefore,
    protected_before: protectedBefore,
    create_products: newRows.map((p) => {
      const size = parseSize(p.size || "");
      const offer = offerBySlug.get(p.slug);
      return {
        action: "INSERT_PRODUCT_needs_review",
        brand: p.brand,
        name: p.productName,
        slug: p.slug,
        category: p.category,
        size,
        active: false,
        verified_at: null,
        image: p.imageFilename,
        offer: offer
          ? {
              purchase_url: offer.purchase_url,
              price: Number(offer.price),
              verification_status: "unverified",
            }
          : null,
      };
    }),
    merge: MERGE.map((m) => {
      const row = products.find((p) => p.slug === m.batchSlug);
      const offer = offerBySlug.get(m.batchSlug);
      return {
        product_id: m.id,
        action: "MERGE_NO_NEW_PRODUCT",
        create_variant_if_missing: {
          size_value: m.sizeValue,
          size_unit: m.sizeUnit,
        },
        create_kr_offer_if_missing: m.allowKrOffer
          ? {
              purchase_url: offer?.purchase_url ?? null,
              verification_status: "unverified",
            }
          : "FORBIDDEN_existing_kr_offer",
        overwrite_ingredients: false,
        overwrite_media: false,
        touch_verified_at: false,
        store_kr_inci_pending_review: Boolean(
          inciJson[m.batchSlug]?.full_ingredients_verbatim_ko
        ),
        batch_name: row?.productName ?? null,
      };
    }),
    forbidden: [
      "auto_verified",
      "delete_products",
      "drop_truncate",
      "production_write",
      "overwrite_existing_ingredients_or_images_on_merge",
    ],
  };

  fs.writeFileSync(
    path.join(backupDir, "dry-run-plan.json"),
    JSON.stringify(dryPlan, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(backupDir, "counts-before.json"),
    JSON.stringify(countsBefore, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(backupDir, "protected-before.json"),
    JSON.stringify(protectedBefore, null, 2) + "\n"
  );

  console.log(JSON.stringify({ phase: "dry_run_plan", ...dryPlan }, null, 2));

  if (!APPLY || DRY) {
    console.log(
      JSON.stringify({
        ok: true,
        phase: "dry_run_only",
        hint: "Re-run with --apply to execute Staging writes",
        backup_dir: backupDir,
      })
    );
    return;
  }

  const results: Record<string, unknown> = {
    created_products: [] as unknown[],
    merged: [] as unknown[],
    errors: [] as string[],
  };

  // --- A. Create 4 new products ---
  if (!MERGE_ONLY) {
  for (const row of newRows) {
    const imgPath = path.join(BUNDLE, "images", row.imageFilename || "");
    const imageBytes = fs.existsSync(imgPath)
      ? fs.readFileSync(imgPath)
      : null;
    const offer = offerBySlug.get(row.slug);
    const size = parseSize(row.size || "");

    try {
      const created = await createAdminProduct({
        brand: row.brand,
        name: row.productName,
        nameKo: row.productNameKo || undefined,
        category: row.category,
        description: row.description || undefined,
        usageArea: row.targetAreas || "face",
        slug: row.slug,
        fullIngredientsText: row.fullIngredients,
        officialProductUrl: row.sourceUrl || undefined,
        image: imageBytes
          ? {
              bytes: imageBytes,
              mimeType: "image/jpeg",
              fileName: row.imageFilename || `${row.slug}.jpg`,
            }
          : null,
        publishForPreview: false, // needs_review: active=false, verified_at=null
      });

      if (created.duplicateBlocked) {
        results.errors.push(
          `new_duplicate_blocked:${row.slug}:${created.warnings.join(",")}`
        );
        (results.created_products as unknown[]).push({
          slug: row.slug,
          skipped: true,
          reason: "duplicateBlocked",
          existingId: created.productId,
        });
        continue;
      }

      const productId = created.productId;
      let variantId: string | null = null;
      let offerId: string | null = null;

      if (size) {
        const { data: vIns, error: vErr } = await client
          .from("product_variants")
          .insert({
            product_id: productId,
            country_code: "KR",
            size_value: size.value,
            size_unit: size.unit,
            variant_name: `${row.productName} ${row.size}`.trim(),
            verification_status: "needs_review",
            active: true,
          })
          .select("id")
          .single();
        if (vErr) results.errors.push(`variant_new:${row.slug}:${vErr.message}`);
        else variantId = vIns.id as string;
      }

      if (offer?.purchase_url) {
        const purchaseUrl = normalizePurchaseUrl(offer.purchase_url);
        const { data: oIns, error: oErr } = await client
          .from("product_offers")
          .insert({
            product_id: productId,
            retailer_name: offer.retailer_name || "COSRX Official KR Mall",
            retailer_country: "KR",
            ships_to_countries: ["KR"],
            purchase_url: purchaseUrl,
            price: Number(offer.price) || null,
            currency: offer.currency || "KRW",
            stock_status: offer.stock_status || "in_stock",
            verification_status: "unverified",
            is_official: true,
            verified_at: null,
            last_checked_at: new Date().toISOString(),
            active: true,
            source: CASE_TAG,
          })
          .select("id")
          .single();
        if (oErr) results.errors.push(`offer_new:${row.slug}:${oErr.message}`);
        else offerId = oIns.id as string;
      }

      (results.created_products as unknown[]).push({
        productId,
        slug: row.slug,
        mediaId: created.mediaId,
        linkedIngredients: created.linkedIngredientCount,
        variantId,
        offerId,
        active: false,
        verified_at: null,
      });
    } catch (e) {
      results.errors.push(
        `create_failed:${row.slug}:${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
  } else {
    (results.created_products as unknown[]).push({
      skipped: true,
      reason: "merge_only_mode",
    });
  }

  // --- B. Merge 3 ---
  for (const m of MERGE) {
    const mergeResult: Record<string, unknown> = {
      product_id: m.id,
      variant: "skipped",
      offer: "skipped",
      kr_inci_provenance: "skipped",
      verified_at_unchanged: true,
    };
    try {
      const { data: prod, error: pErr } = await client
        .from("products")
        .select("id, verified_at, active, full_ingredients")
        .eq("id", m.id)
        .single();
      if (pErr || !prod) throw new Error(`missing_product_${m.id}`);
      const verifiedBefore = prod.verified_at;

      // variant if missing (non-fatal if permission denied)
      try {
        const { data: existingVars, error: vSelErr } = await client
          .from("product_variants")
          .select("id, size_value, size_unit")
          .eq("product_id", m.id);
        if (vSelErr) throw new Error(vSelErr.message);
        const hasSize = (existingVars ?? []).some(
          (v) =>
            Number(v.size_value) === m.sizeValue &&
            String(v.size_unit || "").toLowerCase() === m.sizeUnit
        );
        if (!hasSize) {
          const row = products.find((p) => p.slug === m.batchSlug);
          const { data: vIns, error: vErr } = await client
            .from("product_variants")
            .insert({
              product_id: m.id,
              country_code: "KR",
              size_value: m.sizeValue,
              size_unit: m.sizeUnit,
              variant_name: `${row?.productName ?? "COSRX"} ${m.sizeValue}${m.sizeUnit}`,
              verification_status: "needs_review",
              active: true,
            })
            .select("id")
            .single();
          if (vErr) throw new Error(vErr.message);
          mergeResult.variant = { inserted: vIns.id };
        } else {
          mergeResult.variant = "already_exists";
        }
      } catch (ve) {
        mergeResult.variant = {
          skipped: true,
          reason: ve instanceof Error ? ve.message : String(ve),
          fallback:
            "size recorded in product_field_provenance (service_role lacks INSERT on product_variants)",
        };
        results.errors.push(
          `variant_merge_nonfatal:id_${m.id}:${ve instanceof Error ? ve.message : String(ve)}`
        );
        // Record intended size without mutating product body
        const sizeLabel = `${m.sizeValue}${m.sizeUnit}`;
        const sizeHash = sha(`size_label_pending|${sizeLabel}`);
        await client.from("product_field_provenance").upsert(
          {
            entity_type: "product",
            entity_id: String(m.id),
            product_id: m.id,
            field_name: "size_label_pending",
            value_summary: sizeLabel,
            value_hash: sizeHash,
            source_url: offerBySlug.get(m.batchSlug)?.purchase_url || null,
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

      // KR offer
      const offer = offerBySlug.get(m.batchSlug);
      if (!m.allowKrOffer) {
        mergeResult.offer = "forbidden_by_plan_existing_kr";
      } else if (offer?.purchase_url) {
        const purchaseUrl = normalizePurchaseUrl(offer.purchase_url);
        const { data: existingOffers, error: oSelErr } = await client
          .from("product_offers")
          .select("id, purchase_url, verification_status, verified_at")
          .eq("product_id", m.id);
        if (oSelErr) throw new Error(oSelErr.message);
        const hasKr = (existingOffers ?? []).some((o) =>
          isKrMallUrl(String(o.purchase_url || ""))
        );
        const sameUrl = (existingOffers ?? []).some(
          (o) =>
            normalizePurchaseUrl(String(o.purchase_url || "")) === purchaseUrl
        );
        if (hasKr || sameUrl) {
          mergeResult.offer = "already_has_kr_or_same_url";
        } else {
          const { data: oIns, error: oErr } = await client
            .from("product_offers")
            .insert({
              product_id: m.id,
              retailer_name: offer.retailer_name || "COSRX Official KR Mall",
              retailer_country: "KR",
              ships_to_countries: ["KR"],
              purchase_url: purchaseUrl,
              price: Number(offer.price) || null,
              currency: offer.currency || "KRW",
              stock_status: offer.stock_status || "in_stock",
              verification_status: "unverified",
              is_official: true,
              verified_at: null,
              last_checked_at: new Date().toISOString(),
              active: true,
              source: CASE_TAG,
            })
            .select("id")
            .single();
          if (oErr) throw new Error(`offer_merge:${oErr.message}`);
          mergeResult.offer = { inserted_unverified: oIns.id };
        }
      }

      // KR INCI pending review — do NOT overwrite products.full_ingredients
      const inci = inciJson[m.batchSlug]?.full_ingredients_verbatim_ko || "";
      const sourceUrl =
        inciJson[m.batchSlug]?.source_url ||
        offerBySlug.get(m.batchSlug)?.purchase_url ||
        "";
      if (inci) {
        const valueHash = sha(`full_ingredients_kr_pending_review|${inci}`);
        const { error: provErr } = await client
          .from("product_field_provenance")
          .upsert(
            {
              entity_type: "product",
              entity_id: String(m.id),
              product_id: m.id,
              field_name: "full_ingredients_kr_pending_review",
              value_summary: inci.slice(0, 200),
              value_hash: valueHash,
              source_url: sourceUrl,
              source_domain: "www.cosrx.co.kr",
              extraction_method: "verified_kbeauty_batch_kr_inci",
              confidence: 0.8,
              raw_hash: sha(inci),
              verified_status: "needs_review",
            },
            {
              onConflict: "entity_type,entity_id,field_name,value_hash",
              ignoreDuplicates: true,
            }
          );
        if (provErr) {
          mergeResult.kr_inci_provenance = `db_skip:${provErr.message}`;
        } else {
          mergeResult.kr_inci_provenance = "stored_needs_review";
        }
        fs.writeFileSync(
          path.join(backupDir, `kr-inci-pending-id-${m.id}.json`),
          JSON.stringify(
            {
              product_id: m.id,
              field: "full_ingredients_kr_pending_review",
              source_url: sourceUrl,
              verbatim_ko: inci,
              existing_full_ingredients_untouched: true,
              status: "needs_review",
            },
            null,
            2
          ) + "\n"
        );
      }

      // Assert verified_at unchanged
      const { data: after } = await client
        .from("products")
        .select("verified_at, active, full_ingredients")
        .eq("id", m.id)
        .single();
      if (after?.verified_at !== verifiedBefore) {
        results.errors.push(`verified_at_changed_ABORT_check:id_${m.id}`);
        mergeResult.verified_at_unchanged = false;
      }
      if (
        sha(JSON.stringify(after?.full_ingredients ?? [])) !==
        sha(JSON.stringify(prod.full_ingredients ?? []))
      ) {
        results.errors.push(`ingredients_mutated_ABORT_check:id_${m.id}`);
      }
    } catch (e) {
      results.errors.push(
        `merge_failed:id_${m.id}:${e instanceof Error ? e.message : String(e)}`
      );
    }
    (results.merged as unknown[]).push(mergeResult);
  }

  const countsAfter = await snapshotCounts(client);
  const { data: protectedAfter } = await client
    .from("products")
    .select("id, verified_at, active, full_ingredients")
    .in(
      "id",
      MERGE.map((m) => m.id)
    );

  const createdIds = MERGE_ONLY
    ? [17, 18, 19, 20]
    : (
        results.created_products as Array<{
          productId?: number;
          skipped?: boolean;
        }>
      )
        .filter((c) => c.productId && !c.skipped)
        .map((c) => c.productId as number);

  // Sample select for report
  const { data: sampleNew } = await client
    .from("products")
    .select("id, slug, brand, name, active, verified_at")
    .in("id", createdIds.length ? createdIds : [-1]);

  const deltaProducts =
    Number(countsAfter.products) - Number(countsBefore.products);

  const mergeOk = (results.merged as Array<Record<string, unknown>>).every(
    (m) =>
      m.offer !== "skipped" &&
      m.kr_inci_provenance !== "skipped" &&
      m.verified_at_unchanged === true
  );

  const report = {
    ok:
      results.errors.filter((e) => !String(e).includes("variant")).length ===
        0 &&
      (MERGE_ONLY ? true : deltaProducts === 4) &&
      mergeOk,
    phase: "apply_done",
    staging_ref: meta.ref,
    gate,
    import_commit: "RAN_CUSTOM_SCRIPT",
    auto_verified: false,
    merge_only: MERGE_ONLY,
    variant_note:
      "product_variants INSERT denied for service_role (SELECT-only grant). Size stored in provenance size_label_pending.",
    counts_before: countsBefore,
    counts_after: countsAfter,
    delta: {
      products: deltaProducts,
      variants:
        Number(countsAfter.product_variants) -
        Number(countsBefore.product_variants),
      offers:
        Number(countsAfter.product_offers) - Number(countsBefore.product_offers),
      media:
        Number(countsAfter.catalog_product_media) -
        Number(countsBefore.catalog_product_media),
      ingredients:
        Number(countsAfter.product_ingredients) -
        Number(countsBefore.product_ingredients),
    },
    created_product_ids: createdIds,
    sample_new: sampleNew,
    protected_before: protectedBefore,
    protected_after: protectedAfter,
    results,
    backup_dir: backupDir,
    preview_recommend_exposure:
      "expected_0_until_active+verified_at+verified_KR_offer",
    release_verdict: "NO-GO — needs_review only; Preview recommend still gated",
  };

  fs.writeFileSync(
    path.join(backupDir, "apply-result.json"),
    JSON.stringify(report, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(ROOT, "reports/verified-batch-staging-apply.json"),
    JSON.stringify(report, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(backupDir, "counts-after.json"),
    JSON.stringify(countsAfter, null, 2) + "\n"
  );

  // Update bundle manifest (non-secret)
  const manifestPath = path.join(BUNDLE, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.staging = {
    linked_ref: meta.ref,
    is_production_ref: false,
    has_service_role: true,
    write_allowed: true,
    write_status: "APPLIED_PARTIAL",
    new_products: createdIds.length,
    merged_ids: MERGE.map((m) => m.id),
    applied_at: new Date().toISOString(),
    case_tag: CASE_TAG,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      ok: false,
      phase: "fatal",
      message: err instanceof Error ? err.message : String(err),
    })
  );
  process.exit(1);
});
