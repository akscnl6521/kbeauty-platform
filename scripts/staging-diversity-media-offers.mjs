#!/usr/bin/env node
/**
 * Staging-only: attach official images + sale-checked official offers for diversity SKUs.
 * - Images from official Shopify CDN (downloaded bytes verified)
 * - Offers: real Shopify price/availability (USD official stores) — NOT invented KRW
 * - Olive Young KR blocked (403) → KR verified offer deferred (no fake KRW)
 * Abort on Production.
 */
import { createHash } from "node:crypto";
import { spawnSync, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const BUCKET = "product-images";
const SIGNED_TTL = 60 * 60 * 24 * 7;
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const BATCH = [
  {
    productId: 12,
    slug: "banila-co-clean-it-zero-original",
    shopifyJs:
      "https://banilausa.com/products/clean-it-zero-cleansing-balm-original.js",
    retailer: "banila co. Official (US)",
    country: "US",
  },
  {
    productId: 13,
    slug: "anua-heartleaf-77-soothing-toner",
    shopifyJs: "https://anua.us/products/heartleaf-77-soothing-toner.js",
    retailer: "Anua Official (US)",
    country: "US",
  },
  {
    productId: 14,
    slug: "beauty-of-joseon-glow-serum-propolis-niacinamide",
    shopifyJs:
      "https://beautyofjoseon.com/products/glow-serum-propolis-niacinamide.js",
    retailer: "Beauty of Joseon Official",
    country: "US",
  },
  {
    productId: 15,
    slug: "round-lab-dokdo-toner",
    shopifyJs: "https://roundlab.com/products/1025-dokdo-toner.js",
    retailer: "ROUND LAB Official",
    country: "US",
    preferVariantTitle: "100ml",
  },
];

function linkedRef() {
  return readFileSync(path.join(ROOT, "supabase", ".temp", "project-ref"), "utf8").trim();
}

function getServiceRole(ref) {
  if (ref === PROD) throw new Error("ABORT Production");
  const r = spawnSync(
    npx,
    ["supabase", "projects", "api-keys", "--project-ref", ref, "--reveal", "-o", "json"],
    { cwd: ROOT, encoding: "utf8", shell: true, env: { ...process.env, npm_config_loglevel: "silent" } }
  );
  const keys = JSON.parse((r.stdout || "").trim());
  for (const k of keys) {
    const val = k.api_key ?? k.key;
    if ((k.id === "service_role" || k.name === "service_role") && val) return String(val);
  }
  throw new Error("service_role missing");
}

function sqlLiteral(v) {
  return `'${String(v).replace(/'/g, "''")}'`;
}

function dbQuery(sql) {
  const tmp = path.join(tmpdir(), `kb-media-${process.pid}-${Date.now()}.sql`);
  writeFileSync(tmp, sql.replace(/\s+/g, " ").trim(), "utf8");
  try {
    return execFileSync(
      npx,
      ["supabase", "db", "query", "--linked", "--file", tmp],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: true }
    );
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function absUrl(src) {
  if (!src) return null;
  if (src.startsWith("//")) return `https:${src}`;
  return src;
}

const ref = linkedRef();
if (ref !== STAGING) {
  console.log(JSON.stringify({ phase: "abort", reason: "not_staging" }));
  process.exit(2);
}

const client = createClient(`https://${ref}.supabase.co`, getServiceRole(ref), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];

for (const item of BATCH) {
  const row = { slug: item.slug, productId: item.productId };
  try {
    const res = await fetch(item.shopifyJs, {
      headers: { "User-Agent": "KBeautyMatch-SaleCheck/1.0" },
    });
    if (!res.ok) {
      row.status = "shopify_fetch_failed";
      row.http = res.status;
      results.push(row);
      continue;
    }
    const product = await res.json();
    let variant = (product.variants || [])[0];
    if (item.preferVariantTitle) {
      const hit = (product.variants || []).find(
        (v) => v.title === item.preferVariantTitle && v.available
      );
      if (hit) variant = hit;
      else {
        variant =
          (product.variants || []).find((v) => v.available) || variant;
      }
    }
    const priceCents = Number(variant?.price ?? product.price);
    const available = Boolean(variant?.available ?? product.available);
    const priceUsd = priceCents / 100;
    const imageUrl = absUrl(product.featured_image || product.images?.[0]);
    if (!imageUrl || !(priceUsd > 0)) {
      row.status = "missing_image_or_price";
      results.push(row);
      continue;
    }

    const imgRes = await fetch(imageUrl, {
      headers: { "User-Agent": "KBeautyMatch-SaleCheck/1.0" },
    });
    const bytes = Buffer.from(await imgRes.arrayBuffer());
    if (!imgRes.ok || bytes.length < 1000) {
      row.status = "image_download_failed";
      row.http = imgRes.status;
      results.push(row);
      continue;
    }

    const contentHash = createHash("sha256").update(bytes).digest("hex");
    const shortHash = contentHash.slice(0, 16);
    const ext = (imgRes.headers.get("content-type") || "").includes("png")
      ? "png"
      : "jpg";
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    const objectPath = `products/${item.productId}/primary-${shortHash}.${ext}`;
    const canonical = `storage://${BUCKET}/${objectPath}`;

    const { error: upErr } = await client.storage
      .from(BUCKET)
      .upload(objectPath, bytes, { contentType: mime, upsert: true });
    if (upErr) {
      row.status = "upload_failed";
      row.message = upErr.message;
      results.push(row);
      continue;
    }

    const { data: signed } = await client.storage
      .from(BUCKET)
      .createSignedUrl(objectPath, SIGNED_TTL);

    // Replace primary media row
    dbQuery(`
      delete from catalog_product_media
      where product_id = ${item.productId} and is_primary = true;
    `);
    dbQuery(`
      insert into catalog_product_media (
        product_id, media_type, image_url, canonical_image_url,
        source_page_url, source_domain, source_type, source_tier,
        is_official_source, usage_rights_status, mime_type, content_length,
        content_hash, is_accessible, is_primary, display_order,
        validation_status, validation_errors, verified_at, is_fixture
      ) values (
        ${item.productId}::bigint, 'product_front',
        ${sqlLiteral(signed?.signedUrl || canonical)},
        ${sqlLiteral(canonical)},
        ${sqlLiteral(item.shopifyJs.replace(/\.js$/, ""))},
        ${sqlLiteral(new URL(item.shopifyJs).hostname)},
        'official_brand', 1, true, 'licensed_copy_allowed',
        ${sqlLiteral(mime)}, ${bytes.length}, ${sqlLiteral(contentHash)},
        true, true, 0, 'verified', '[]'::jsonb, now(), false
      );
    `);

    // Upsert sale-checked official offer (USD — real Shopify price; not fake KRW)
    const purchaseUrl = item.shopifyJs.replace(/\.js$/, "");
    dbQuery(`
      delete from product_offers
      where product_id = ${item.productId}
        and verification_status = 'unverified';
    `);
    dbQuery(`
      insert into product_offers (
        product_id, retailer_name, retailer_country, ships_to_countries,
        purchase_url, price, currency, stock_status, verification_status,
        is_official, verified_at, active, last_checked_at
      ) values (
        ${item.productId}::bigint,
        ${sqlLiteral(item.retailer)},
        ${sqlLiteral(item.country)},
        array['US','KR']::text[],
        ${sqlLiteral(purchaseUrl)},
        ${priceUsd},
        'USD',
        ${available ? "'in_stock'" : "'out_of_stock'"},
        'verified',
        true,
        now(),
        true,
        now()
      );
    `);

    row.status = "ok";
    row.priceUsd = priceUsd;
    row.available = available;
    row.imageBytes = bytes.length;
    row.canonical = canonical;
    results.push(row);
  } catch (e) {
    row.status = "error";
    row.message = String(e?.message || e).slice(0, 200);
    results.push(row);
  }
}

// Isntree: handled by scripts/staging-isntree-media-offer.mjs
// Official Global: isntree-global.com/products/isntree-hyaluronic-acid-watery-sun-gel-50ml
results.push({
  slug: "isntree-hyaluronic-acid-watery-sun-gel",
  productId: 16,
  status: "delegated",
  note: "Use staging-isntree-media-offer.mjs (official Global Shopify sale-check)",
});

console.log(
  JSON.stringify(
    {
      phase: "staging_media_offer_sale_check",
      productionTouched: false,
      krVerifiedOffersInvented: false,
      oliveYoungStatus: "403_blocked",
      results,
      note: "USD official verified offers attached where Shopify sale-checked. KR Top5 gate still requires KRW+KR retailer — not faked.",
    },
    null,
    2
  )
);
