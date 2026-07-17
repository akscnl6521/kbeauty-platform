#!/usr/bin/env node
/**
 * Staging-only: Isntree Watery Sun Gel (product id 16)
 * Official Global Shopify sale-check → image + verified USD offer.
 * No invented KRW. Abort on Production.
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

const ITEM = {
  productId: 16,
  slug: "isntree-hyaluronic-acid-watery-sun-gel",
  shopifyJs:
    "https://isntree-global.com/products/isntree-hyaluronic-acid-watery-sun-gel-50ml.js",
  retailer: "Isntree Official Global",
  country: "US",
};

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
  const tmp = path.join(tmpdir(), `kb-isntree-${process.pid}-${Date.now()}.sql`);
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
  console.log(JSON.stringify({ phase: "abort", reason: "not_staging", ref }));
  process.exit(2);
}

const client = createClient(`https://${ref}.supabase.co`, getServiceRole(ref), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const out = {
  phase: "isntree_media_offer",
  productId: ITEM.productId,
  slug: ITEM.slug,
  productionTouched: false,
  krVerifiedOffersInvented: false,
};

try {
  const res = await fetch(ITEM.shopifyJs, {
    headers: { "User-Agent": "KBeautyMatch-SaleCheck/1.0" },
  });
  if (!res.ok) {
    out.status = "shopify_fetch_failed";
    out.http = res.status;
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }
  const product = await res.json();
  const variant = (product.variants || []).find((v) => v.available) || (product.variants || [])[0];
  const priceCents = Number(variant?.price ?? product.price);
  const available = Boolean(variant?.available ?? product.available);
  const priceUsd = priceCents / 100;
  const imageUrl = absUrl(product.featured_image || product.images?.[0]);

  out.saleCheck = {
    title: product.title,
    priceUsd,
    available,
    purchaseUrl: ITEM.shopifyJs.replace(/\.js$/, ""),
    imageUrl,
  };

  if (!imageUrl || !(priceUsd > 0)) {
    out.status = "missing_image_or_price";
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }

  const imgRes = await fetch(imageUrl, {
    headers: { "User-Agent": "KBeautyMatch-SaleCheck/1.0" },
  });
  const bytes = Buffer.from(await imgRes.arrayBuffer());
  if (!imgRes.ok || bytes.length < 1000) {
    out.status = "image_download_failed";
    out.http = imgRes.status;
    out.imageBytes = bytes.length;
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }

  const contentHash = createHash("sha256").update(bytes).digest("hex");
  const shortHash = contentHash.slice(0, 16);
  const contentType = imgRes.headers.get("content-type") || "";
  const ext = contentType.includes("png") || imageUrl.includes(".png") ? "png" : "jpg";
  const mime = ext === "png" ? "image/png" : "image/jpeg";
  const objectPath = `products/${ITEM.productId}/primary-${shortHash}.${ext}`;
  const canonical = `storage://${BUCKET}/${objectPath}`;

  const { error: upErr } = await client.storage
    .from(BUCKET)
    .upload(objectPath, bytes, { contentType: mime, upsert: true });
  if (upErr) {
    out.status = "upload_failed";
    out.message = upErr.message;
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }

  const { data: signed } = await client.storage
    .from(BUCKET)
    .createSignedUrl(objectPath, SIGNED_TTL);

  const purchaseUrl = ITEM.shopifyJs.replace(/\.js$/, "");
  dbQuery(`
    delete from catalog_product_media
    where product_id = ${ITEM.productId} and is_primary = true;
  `);
  dbQuery(`
    insert into catalog_product_media (
      product_id, media_type, image_url, canonical_image_url,
      source_page_url, source_domain, source_type, source_tier,
      is_official_source, usage_rights_status, mime_type, content_length,
      content_hash, is_accessible, is_primary, display_order,
      validation_status, validation_errors, verified_at, is_fixture
    ) values (
      ${ITEM.productId}::bigint, 'product_front',
      ${sqlLiteral(signed?.signedUrl || canonical)},
      ${sqlLiteral(canonical)},
      ${sqlLiteral(purchaseUrl)},
      'isntree-global.com',
      'official_brand', 1, true, 'licensed_copy_allowed',
      ${sqlLiteral(mime)}, ${bytes.length}, ${sqlLiteral(contentHash)},
      true, true, 0, 'verified', '[]'::jsonb, now(), false
    );
  `);

  dbQuery(`
    delete from product_offers
    where product_id = ${ITEM.productId}
      and verification_status = 'unverified';
  `);
  dbQuery(`
    insert into product_offers (
      product_id, retailer_name, retailer_country, ships_to_countries,
      purchase_url, price, currency, stock_status, verification_status,
      is_official, verified_at, active, last_checked_at
    ) values (
      ${ITEM.productId}::bigint,
      ${sqlLiteral(ITEM.retailer)},
      ${sqlLiteral(ITEM.country)},
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

  // Old isntree.com PDP 404 → keep Staging hero URL on the live official Global PDP.
  dbQuery(`
    update catalog_staging_products
    set official_product_url = ${sqlLiteral(purchaseUrl)},
        updated_at = now()
    where approved_product_id = ${ITEM.productId}
       or external_product_id = ${sqlLiteral(ITEM.slug)};
  `);

  out.status = "ok";
  out.imageBytes = bytes.length;
  out.canonical = canonical;
  out.mime = mime;
  out.stockStatus = available ? "in_stock" : "out_of_stock";
} catch (e) {
  out.status = "error";
  out.message = String(e?.message || e).slice(0, 300);
  console.log(JSON.stringify(out, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(out, null, 2));
