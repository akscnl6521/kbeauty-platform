#!/usr/bin/env node
/**
 * Staging-only: replace corrupt Snail 96 primary image (product_id=1).
 * Source: official COSRX Korea CDN. No Production changes.
 */
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const PRODUCT_ID = 1;
const OFFICIAL_PRODUCT_PAGE =
  "https://www.cosrx.com/products/advanced-snail-96-mucin-power-essence";
const OFFICIAL_IMAGE_URL =
  "https://www.cosrx.com/cdn/shop/files/james_800x1067_1_1_4e9750cc-2cd6-4817-ace5-be2305a85806_1200x1200.jpg?v=1763111577";
const BUCKET = "product-images";
const SIGNED_TTL = 60 * 60 * 24 * 7;
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function dbQuery(sql) {
  const oneLine = sql.replace(/\s+/g, " ").trim();
  const tmp = path.join(tmpdir(), `kb-snail96-${process.pid}-${Date.now()}.sql`);
  writeFileSync(tmp, oneLine, "utf8");
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

function parseRows(out) {
  try {
    const json = JSON.parse(out);
    return Array.isArray(json.rows) ? json.rows : [];
  } catch {
    return [];
  }
}

function linkedRef() {
  return readFileSync(
    path.join(ROOT, "supabase", ".temp", "project-ref"),
    "utf8"
  ).trim();
}

function getServiceRole(ref) {
  if (ref === PROD) throw new Error("ABORT Production");
  const r = spawnSync(
    npx,
    ["supabase", "projects", "api-keys", "--project-ref", ref, "--reveal", "-o", "json"],
    {
      cwd: ROOT,
      encoding: "utf8",
      shell: true,
      env: { ...process.env, npm_config_loglevel: "silent" },
    }
  );
  const keys = JSON.parse((r.stdout || "").trim());
  for (const k of keys) {
    const val = k.api_key ?? k.key;
    if ((k.id === "service_role" || k.name === "service_role") && val) {
      return String(val);
    }
  }
  throw new Error("service_role missing");
}

const ref = linkedRef();
if (ref !== STAGING) {
  console.log(JSON.stringify({ phase: "abort", reason: "not_staging_linked" }));
  process.exit(2);
}

const serviceRole = getServiceRole(ref);
const supabaseUrl = `https://${ref}.supabase.co`;
const client = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const before = parseRows(
  dbQuery(`
    select id, product_id, content_length, canonical_image_url, mime_type
    from catalog_product_media
    where product_id = ${PRODUCT_ID} and is_primary = true
    limit 1;
  `)
);
const beforeLen = before?.[0]?.content_length ?? null;

const res = await fetch(OFFICIAL_IMAGE_URL, {
  headers: { "User-Agent": "KBeautyMatch-StagingMediaFix/1.0" },
});
if (!res.ok) {
  console.log(
    JSON.stringify({ phase: "abort", reason: "official_fetch_failed", status: res.status })
  );
  process.exit(1);
}

const bytes = Buffer.from(await res.arrayBuffer());
if (bytes.length < 1000) {
  console.log(
    JSON.stringify({ phase: "abort", reason: "official_image_too_small", bytes: bytes.length })
  );
  process.exit(1);
}

const contentHash = createHash("sha256").update(bytes).digest("hex");
const shortHash = contentHash.slice(0, 16);
const objectPath = `products/${PRODUCT_ID}/primary-${shortHash}.jpg`;
const canonical = `storage://${BUCKET}/${objectPath}`;

const { error: uploadErr } = await client.storage
  .from(BUCKET)
  .upload(objectPath, bytes, { contentType: "image/jpeg", upsert: true });

if (uploadErr) {
  console.log(
    JSON.stringify({ phase: "abort", reason: "upload_failed", message: uploadErr.message })
  );
  process.exit(1);
}

const { data: signed, error: signErr } = await client.storage
  .from(BUCKET)
  .createSignedUrl(objectPath, SIGNED_TTL);

if (signErr || !signed?.signedUrl) {
  console.log(
    JSON.stringify({ phase: "abort", reason: "sign_failed", message: signErr?.message })
  );
  process.exit(1);
}

const updateOut = dbQuery(`
  update catalog_product_media
  set
    image_url = ${sqlLiteral(signed.signedUrl)},
    canonical_image_url = ${sqlLiteral(canonical)},
    mime_type = 'image/jpeg',
    content_length = ${bytes.length},
    content_hash = ${sqlLiteral(contentHash)},
    is_accessible = true,
    validation_status = 'verified',
    source_page_url = ${sqlLiteral(OFFICIAL_PRODUCT_PAGE)},
    source_domain = 'www.cosrx.com',
    source_type = 'official_brand',
    is_official_source = true,
    usage_rights_status = 'licensed_copy_allowed',
    updated_at = now()
  where product_id = ${PRODUCT_ID} and is_primary = true
  returning id, product_id, content_length, canonical_image_url;
`);

const updated = parseRows(updateOut);
if (!updated?.[0]) {
  console.log(JSON.stringify({ phase: "abort", reason: "db_update_failed", updateOut: updateOut.slice(0, 300) }));
  process.exit(1);
}

let httpStatus = 0;
try {
  const head = await fetch(signed.signedUrl, { method: "GET" });
  httpStatus = head.status;
} catch {
  httpStatus = -1;
}

console.log(
  JSON.stringify({
    phase: "staging_snail96_image_fixed",
    product_id: PRODUCT_ID,
    before_content_length: beforeLen,
    after_content_length: updated[0].content_length,
    canonical: updated[0].canonical_image_url,
    http_status: httpStatus,
    production_touched: false,
  })
);
process.exit(httpStatus >= 200 && httpStatus < 400 ? 0 : 1);
