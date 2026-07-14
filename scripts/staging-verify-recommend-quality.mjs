#!/usr/bin/env node
/**
 * Staging-only: public products must not be probe/test; 8 concern PMID sets unique.
 * Never Production.
 */
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const root = process.cwd();
const linked = readFileSync(
  path.join(root, "supabase/.temp/project-ref"),
  "utf8"
).trim();
if (linked === PROD) {
  console.error("ABORT_PRODUCTION");
  process.exit(2);
}
if (linked !== STAGING) {
  console.error("ABORT_NOT_STAGING");
  process.exit(2);
}

function q(sql) {
  const f = path.join(tmpdir(), `kb-qr-${process.pid}.sql`);
  writeFileSync(f, sql, "utf8");
  try {
    const r = spawnSync(
      "npx.cmd",
      ["supabase", "db", "query", "--linked", "--file", f, "-o", "json"],
      {
        cwd: root,
        encoding: "utf8",
        shell: true,
        env: { ...process.env, npm_config_loglevel: "silent" },
      }
    );
    const out = r.stdout || "";
    const i = out.indexOf("{");
    if ((r.status ?? 1) !== 0) {
      console.error((r.stderr || out).slice(-800));
      process.exit(r.status ?? 1);
    }
    return i >= 0 ? JSON.parse(out.slice(i)) : {};
  } finally {
    try {
      unlinkSync(f);
    } catch {}
  }
}

const probeLeak = q(`
SELECT id, slug, name, name_ko, active, verified_at
FROM products
WHERE active IS TRUE
  AND verified_at IS NOT NULL
  AND (
    coalesce(name,'') ~* '(HTTP\\s*API|Alias\\s*Probe|probe|fixture|test[\\s_-]*only|검증용|테스트\\s*제품)'
    OR coalesce(name_ko,'') ~* '(HTTP\\s*API|Alias\\s*Probe|probe|fixture|검증용|테스트\\s*제품)'
    OR coalesce(slug,'') ~* '(http-api|alias-probe|probe-|test-only|fixture)'
  )
ORDER BY id
LIMIT 20;
`);

if ((probeLeak.rows || []).length > 0) {
  console.error(
    "FAIL public active+verified probe/test products exposed",
    JSON.stringify(probeLeak.rows)
  );
  process.exit(1);
}

const concerns = q(`
SELECT c.code,
       array_agg(e.pmid ORDER BY e.pmid) AS pmids
FROM ingredient_evidence e
JOIN skin_concerns c ON c.id = e.concern_id
WHERE e.review_status = 'approved'
  AND c.code IN (
    'redness','dryness','sensitivity','acne',
    'pigmentation','antiaging','pores','uv'
  )
GROUP BY c.code
ORDER BY c.code;
`);

const rows = concerns.rows || [];
if (rows.length < 8) {
  console.error("FAIL expected 8 concerns with approved evidence", rows);
  process.exit(1);
}

const pmidKeys = rows.map((r) => (r.pmids || []).join(","));
if (new Set(pmidKeys).size !== pmidKeys.length) {
  console.error("FAIL identical PMID sets across concerns", pmidKeys);
  process.exit(1);
}

const krOffers = q(`
SELECT count(*)::int AS n
FROM product_offers o
JOIN products p ON p.id = o.product_id
WHERE p.active IS TRUE
  AND p.verified_at IS NOT NULL
  AND o.verification_status = 'verified'
  AND o.verified_at IS NOT NULL
  AND o.retailer_country = 'KR'
  AND o.stock_status = 'in_stock';
`);

const offerN = krOffers.rows?.[0]?.n ?? 0;
if (offerN < 1) {
  console.error("FAIL no KR verified in_stock offers on active products");
  process.exit(1);
}

console.log(
  JSON.stringify({
    phase: "staging_recommend_quality_ok",
    linked,
    concernCount: rows.length,
    pmidSetsUnique: true,
    publicProbeLeaks: 0,
    krVerifiedOffers: offerN,
  })
);
