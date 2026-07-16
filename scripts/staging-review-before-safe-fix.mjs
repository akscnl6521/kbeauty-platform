#!/usr/bin/env node
/** Staging-only: review encoding + read current 4/6/10 / probes / offers. No writes. */
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const root = process.cwd();
const linked = readFileSync(path.join(root, "supabase/.temp/project-ref"), "utf8").trim();
console.log(JSON.stringify({ linked }));
if (linked === PROD) {
  console.error("ABORT_PRODUCTION");
  process.exit(2);
}
if (linked !== STAGING) {
  console.error("ABORT_NOT_STAGING");
  process.exit(2);
}

const sqlPath = path.join(root, "scripts/staging-safe-public-results.sql");
const raw = readFileSync(sqlPath);
const text = raw.toString("utf8");
console.log(
  JSON.stringify({
    sql_bytes: raw.length,
    hasHangul: /[\uAC00-\uD7A3]/.test(text),
    bom: raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf,
    nameKoSamples: [...text.matchAll(/\((\d+), '([^']+)'\)/g)]
      .slice(0, 4)
      .map((m) => ({ id: m[1], ko: m[2] })),
  })
);

const review = `
SELECT id, brand, left(name,50) AS name, name_ko,
  (name_ko ~ '[\\uAC00-\\uD7A3]') AS name_ko_has_hangul,
  active, (verified_at IS NOT NULL) AS verified
FROM products WHERE id IN (4,6,10) ORDER BY id;

SELECT id, left(name,60) AS name, left(coalesce(name_ko,''),40) AS name_ko, active,
  (verified_at IS NOT NULL) AS verified
FROM products
WHERE name ILIKE '%HTTP API%' OR name ILIKE '%Alias Probe%' OR name ILIKE '%Alias SELECT%'
   OR coalesce(name_ko,'') ILIKE '%검증용%' OR coalesce(name_ko,'') ILIKE '%권한 검증%';

SELECT product_id, verification_status, stock_status, active,
  (price IS NOT NULL AND price > 0) AS has_price,
  left(purchase_url,48) AS url
FROM product_offers
WHERE product_id IN (4,6,10)
ORDER BY product_id;
`;

function db(sql) {
  const f = path.join(tmpdir(), `kb-ro-${process.pid}.sql`);
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
    return { status: r.status ?? 1, out: r.stdout || "", err: r.stderr || "" };
  } finally {
    try {
      unlinkSync(f);
    } catch {
      /* ignore */
    }
  }
}

const ro = db(review);
console.log("READONLY");
console.log(ro.out.slice(-3000));
if (ro.status) {
  console.error(ro.err.slice(-500));
  process.exit(ro.status);
}
