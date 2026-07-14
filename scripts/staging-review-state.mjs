#!/usr/bin/env node
/** Staging-only: one statement per query (CLI returns last result set only). */
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const root = process.cwd();
const linked = readFileSync(path.join(root, "supabase/.temp/project-ref"), "utf8").trim();
if (linked === PROD) {
  console.error("ABORT_PRODUCTION");
  process.exit(2);
}
if (linked !== STAGING) {
  console.error("ABORT_NOT_STAGING");
  process.exit(2);
}
console.log(JSON.stringify({ linked, phase: "ok_staging" }));

function db(sql) {
  const f = path.join(tmpdir(), `kb-q-${process.pid}-${Math.random().toString(16).slice(2)}.sql`);
  writeFileSync(f, sql, "utf8");
  try {
    const r = spawnSync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["supabase", "db", "query", "--linked", "--file", f, "-o", "json"],
      {
        cwd: root,
        encoding: "utf8",
        shell: true,
        env: { ...process.env, npm_config_loglevel: "silent" },
      }
    );
    const out = r.stdout || "";
    const start = out.indexOf("{");
    if (start < 0) return { status: r.status ?? 1, rows: [], raw: out };
    try {
      return { status: r.status ?? 0, ...JSON.parse(out.slice(start)) };
    } catch {
      return { status: r.status ?? 1, rows: [], raw: out.slice(-500) };
    }
  } finally {
    try {
      unlinkSync(f);
    } catch {
      /* ignore */
    }
  }
}

const products = db(`
SELECT id, brand, name, name_ko,
  (name_ko ~ '[\\uAC00-\\uD7A3]') AS name_ko_has_hangul,
  active, (verified_at IS NOT NULL) AS verified,
  encode(convert_to(coalesce(name_ko,''), 'UTF8'), 'hex') AS name_ko_hex
FROM products WHERE id IN (4,6,10) ORDER BY id;
`);
console.log("PRODUCTS_4_6_10", JSON.stringify(products.rows, null, 2));

const probes = db(`
SELECT id, name, name_ko, active, (verified_at IS NOT NULL) AS verified
FROM products
WHERE name ILIKE '%HTTP API%' OR name ILIKE '%Alias Probe%' OR name ILIKE '%Alias SELECT%'
   OR coalesce(name_ko,'') ILIKE '%검증용%' OR coalesce(name_ko,'') ILIKE '%권한 검증%'
ORDER BY id;
`);
console.log("PROBES", JSON.stringify(probes.rows, null, 2));

const offers = db(`
SELECT product_id, verification_status, stock_status, active, price::text AS price,
  left(purchase_url,60) AS url
FROM product_offers WHERE product_id IN (4,6,10) ORDER BY product_id;
`);
console.log("OFFERS_4_6_10", JSON.stringify(offers.rows, null, 2));

const offerCount = db(`
SELECT count(*)::int AS kr_verified_instock
FROM product_offers
WHERE retailer_country='KR' AND verification_status='verified'
  AND stock_status='in_stock' AND active IS TRUE;
`);
console.log("OFFER_COUNT", JSON.stringify(offerCount.rows, null, 2));
