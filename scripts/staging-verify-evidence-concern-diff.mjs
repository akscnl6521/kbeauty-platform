#!/usr/bin/env node
/**
 * Staging-only: verify concern→evidence PMIDs differ for pigmentation/antiaging/pores/uv/acne.
 * Uses linked supabase db query. Never Production.
 */
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
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

function q(sql) {
  const f = path.join(tmpdir(), `kb-ev-diff-${process.pid}.sql`);
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

const byConcern = q(`
SELECT c.code,
       array_agg(e.pmid ORDER BY e.pmid) AS pmids,
       array_agg(i.slug ORDER BY e.pmid) AS slugs
FROM ingredient_evidence e
JOIN skin_concerns c ON c.id = e.concern_id
JOIN ingredients i ON i.id = e.ingredient_id
WHERE e.review_status = 'approved'
  AND c.code IN ('pigmentation','antiaging','pores','uv','acne')
GROUP BY c.code
ORDER BY c.code;
`);

const products = q(`
SELECT slug, key_ingredients, skin_concern
FROM products
WHERE active IS TRUE AND verified_at IS NOT NULL
  AND (
    slug ILIKE '%niacinamide%'
    OR slug ILIKE '%retinol%'
    OR slug ILIKE '%clarifying%'
    OR slug ILIKE '%snail%'
    OR slug ILIKE '%mucin%'
  )
ORDER BY slug;
`);

const rows = byConcern.rows || [];
if (rows.length < 5) {
  console.error("FAIL missing concerns", rows);
  process.exit(1);
}

const pmidSets = rows.map((r) => (r.pmids || []).join(","));
if (new Set(pmidSets).size !== pmidSets.length) {
  console.error("FAIL pmid sets not unique across concerns", pmidSets);
  process.exit(1);
}

const acne = rows.find((r) => r.code === "acne");
if (!acne || !(acne.slugs || []).includes("salicylic-acid")) {
  console.error("FAIL acne missing salicylic reinforcement");
  process.exit(1);
}
if (!(acne.slugs || []).includes("niacinamide")) {
  console.error("FAIL acne missing niacinamide");
  process.exit(1);
}

console.log(
  JSON.stringify({
    phase: "staging_evidence_concern_diff_ok",
    linked,
    concerns: rows,
    productSamples: products.rows,
  })
);
