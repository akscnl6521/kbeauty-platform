#!/usr/bin/env node
/**
 * Staging-only: verify public recommendation products have resolvable primary images.
 * Uses linked supabase db query + service role signed URLs. Never Production.
 */
import { spawnSync } from "node:child_process";
import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const BUCKET = "product-images";
const MIN_BYTES = 1000;
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function dbQuery(sql) {
  const oneLine = sql.replace(/\s+/g, " ").trim();
  const tmp = path.join(tmpdir(), `kb-img-verify-${process.pid}-${Date.now()}.sql`);
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

const ref = linkedRef();
if (ref !== STAGING) {
  console.log(JSON.stringify({ phase: "abort", reason: "not_staging_linked" }));
  process.exit(2);
}

const serviceRole = getServiceRole(ref);
const client = createClient(`https://${ref}.supabase.co`, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const products = parseRows(
  dbQuery(`
    select p.id, p.slug, p.name
    from products p
    where p.active = true and p.verified_at is not null
    order by p.id;
  `)
);

const mediaRows = parseRows(
  dbQuery(`
    select m.product_id, m.content_length, m.canonical_image_url, m.validation_status, m.is_primary
    from catalog_product_media m
    join products p on p.id = m.product_id
    where p.active = true and p.verified_at is not null
      and m.is_primary = true and m.is_fixture = false
      and m.validation_status = 'verified';
  `)
);

const mediaByProduct = new Map(mediaRows.map((r) => [Number(r.product_id), r]));
const results = [];

for (const p of products) {
  const pid = Number(p.id);
  const media = mediaByProduct.get(pid);
  const item = {
    product_id: pid,
    slug: p.slug,
    name: p.name,
    has_verified_primary: Boolean(media),
    content_length: media?.content_length ?? null,
    signed_http: null,
    fetch_bytes: null,
    ok: false,
    issue: null,
  };

  if (!media) {
    item.issue = "missing_verified_primary_media";
    results.push(item);
    continue;
  }

  if (Number(media.content_length) < MIN_BYTES) {
    item.issue = "content_length_too_small";
    results.push(item);
    continue;
  }

  const canonical = String(media.canonical_image_url ?? "");
  const m = canonical.match(/^storage:\/\/product-images\/(.+)$/);
  if (!m) {
    item.issue = "invalid_canonical";
    results.push(item);
    continue;
  }

  const { data: signed, error: signErr } = await client.storage
    .from(BUCKET)
    .createSignedUrl(m[1], 3600);

  if (signErr || !signed?.signedUrl) {
    item.issue = "sign_failed";
    results.push(item);
    continue;
  }

  try {
    const res = await fetch(signed.signedUrl);
    item.signed_http = res.status;
    const buf = Buffer.from(await res.arrayBuffer());
    item.fetch_bytes = buf.length;
    item.ok =
      res.status >= 200 &&
      res.status < 400 &&
      buf.length >= MIN_BYTES;
    if (!item.ok) item.issue = "fetch_failed_or_too_small";
  } catch {
    item.issue = "fetch_error";
  }

  results.push(item);
}

const okCount = results.filter((r) => r.ok).length;
const summary = {
  phase: "staging_public_product_images",
  public_products: products.length,
  ok: okCount,
  failed: results.length - okCount,
  all_ok: okCount === products.length && products.length > 0,
  results,
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.all_ok ? 0 : 1);
