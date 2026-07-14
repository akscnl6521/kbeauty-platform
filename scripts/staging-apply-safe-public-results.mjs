#!/usr/bin/env node
/**
 * Staging-only: apply safe public-results SQL + verify.
 * Refuses Production. Does not rewrite healthy Hangul name_ko on 4/6/10.
 */
import { readFileSync, writeFileSync, unlinkSync, copyFileSync } from "node:fs";
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

function db(sql, label) {
  const f = path.join(tmpdir(), `kb-${label}-${process.pid}.sql`);
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
    let parsed = null;
    if (start >= 0) {
      try {
        parsed = JSON.parse(out.slice(start));
      } catch {
        parsed = null;
      }
    }
    if ((r.status ?? 1) !== 0) {
      console.error(label, (r.stderr || out).slice(-800));
      process.exit(r.status ?? 1);
    }
    return parsed;
  } finally {
    try {
      unlinkSync(f);
    } catch {
      /* ignore */
    }
  }
}

// Snapshot before
const before4610 = db(
  `SELECT id, name_ko, active, (verified_at IS NOT NULL) AS verified,
    encode(convert_to(coalesce(name_ko,''),'UTF8'),'hex') AS hex
   FROM products WHERE id IN (4,6,10) ORDER BY id;`,
  "before4610"
);
console.log("BEFORE_4_6_10", JSON.stringify(before4610?.rows ?? [], null, 2));

const sqlFile = path.join(root, "scripts/staging-safe-public-results.sql");
const sqlRaw = readFileSync(sqlFile);
if (!/[\uAC00-\uD7A3]/.test(sqlRaw.toString("utf8"))) {
  console.error("ABORT_SQL_NO_HANGUL");
  process.exit(3);
}
// Apply via copied temp UTF-8 file (CLI --file)
const applyPath = path.join(tmpdir(), `kb-apply-${process.pid}.sql`);
copyFileSync(sqlFile, applyPath);
try {
  const r = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["supabase", "db", "query", "--linked", "--file", applyPath],
    {
      cwd: root,
      encoding: "utf8",
      shell: true,
      env: { ...process.env, npm_config_loglevel: "silent" },
    }
  );
  console.log("APPLY_STATUS", r.status);
  console.log((r.stdout || "").slice(-400));
  if ((r.status ?? 1) !== 0) {
    console.error((r.stderr || "").slice(-800));
    process.exit(r.status ?? 1);
  }
} finally {
  try {
    unlinkSync(applyPath);
  } catch {
    /* ignore */
  }
}

const after4610 = db(
  `SELECT id, name_ko, active, (verified_at IS NOT NULL) AS verified,
    encode(convert_to(coalesce(name_ko,''),'UTF8'),'hex') AS hex
   FROM products WHERE id IN (4,6,10) ORDER BY id;`,
  "after4610"
);
console.log("AFTER_4_6_10", JSON.stringify(after4610?.rows ?? [], null, 2));

// Integrity: hex must match for 4/6/10
const beforeMap = new Map((before4610?.rows ?? []).map((r) => [r.id, r.hex]));
for (const row of after4610?.rows ?? []) {
  if (beforeMap.get(row.id) !== row.hex) {
    console.error("INTEGRITY_FAIL name_ko changed for id", row.id);
    process.exit(4);
  }
  if (row.active !== true || row.verified !== true) {
    console.error("INTEGRITY_FAIL active/verified damaged for id", row.id);
    process.exit(4);
  }
}
console.log(JSON.stringify({ phase: "integrity_4_6_10_ok" }));

const others = db(
  `SELECT id, name_ko_has_hangul, active, verified FROM (
     SELECT id, (name_ko ~ '[\\uAC00-\\uD7A3]') AS name_ko_has_hangul,
            active, (verified_at IS NOT NULL) AS verified
     FROM products WHERE id IN (5,7,8,9,11)
   ) t ORDER BY id;`,
  "others"
);
console.log("OTHERS", JSON.stringify(others?.rows ?? [], null, 2));

const probes = db(
  `SELECT id, active, (verified_at IS NOT NULL) AS verified
   FROM products
   WHERE name ILIKE '%HTTP API%' OR name ILIKE '%Alias Probe%' OR name ILIKE '%Alias SELECT%'
      OR coalesce(name_ko,'') ILIKE '%검증용%'
   ORDER BY id;`,
  "probes"
);
console.log("PROBES", JSON.stringify(probes?.rows ?? [], null, 2));

const offers = db(
  `SELECT product_id, verification_status, stock_status, active
   FROM product_offers
   WHERE product_id BETWEEN 4 AND 11 AND retailer_country='KR'
     AND verification_status='verified' AND stock_status='in_stock' AND active IS TRUE
   ORDER BY product_id;`,
  "offers"
);
console.log("KR_OFFERS", JSON.stringify(offers?.rows ?? [], null, 2));

const publicCount = db(
  `SELECT count(*)::int AS public_verified_active
   FROM products WHERE active IS TRUE AND verified_at IS NOT NULL;`,
  "pub"
);
console.log("PUBLIC", JSON.stringify(publicCount?.rows ?? [], null, 2));
console.log(JSON.stringify({ phase: "done", linked }));
