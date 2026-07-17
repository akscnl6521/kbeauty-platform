#!/usr/bin/env node
/**
 * Staging-only: fill empty skin_concern on public products from key ingredients.
 * Cosmetic concern tags only — no medical claims. Abort on Production.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

const ROOT = process.cwd();
const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

/** Only products that currently have null/empty concern — curated from key ingredients. */
const FILLS = [
  {
    id: 4,
    slug: "cosrx-low-ph-good-morning-gel-cleanser",
    concerns: ["pores", "acne"],
    reason: "Betaine Salicylate (BHA family) cleanser",
  },
  {
    id: 6,
    slug: "cosrx-hydrium-watery-toner",
    concerns: ["dryness"],
    reason: "Sodium Hyaluronate / Panthenol / Glycerin",
  },
  {
    id: 8,
    slug: "cosrx-advanced-the-vitamin-c-23-serum",
    concerns: ["pigmentation"],
    reason: "Ascorbic Acid (Vitamin C)",
  },
  {
    id: 9,
    slug: "cosrx-the-6-peptide-skin-booster-serum",
    concerns: ["antiaging", "wrinkle"],
    reason: "Peptides + Adenosine",
  },
];

function linkedRef() {
  return readFileSync(path.join(ROOT, "supabase", ".temp", "project-ref"), "utf8").trim();
}

function dbQuery(sql) {
  if (linkedRef() === PROD) throw new Error("ABORT Production");
  const tmp = path.join(tmpdir(), `kb-concern-${process.pid}-${Date.now()}.sql`);
  writeFileSync(tmp, sql.replace(/\s+/g, " ").trim(), "utf8");
  try {
    return execFileSync(
      npx,
      ["supabase", "db", "query", "--linked", "--file", tmp, "-o", "json"],
      { cwd: ROOT, encoding: "utf8", shell: true, stdio: ["ignore", "pipe", "pipe"] }
    );
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

const ref = linkedRef();
if (ref !== STAGING) {
  console.log(JSON.stringify({ phase: "abort", reason: "not_staging", ref }));
  process.exit(2);
}

const results = [];
for (const item of FILLS) {
  const arr = `ARRAY[${item.concerns.map((c) => `'${c}'`).join(",")}]::text[]`;
  // Only update if currently null or empty array
  const out = dbQuery(`
    update products
    set skin_concern = ${arr}
    where id = ${item.id}
      and active = true
      and verified_at is not null
      and slug = '${item.slug}'
      and (
        skin_concern is null
        or cardinality(skin_concern) = 0
      )
    returning id, slug, skin_concern;
  `);
  results.push({
    id: item.id,
    slug: item.slug,
    concerns: item.concerns,
    reason: item.reason,
    db: out.slice(0, 800),
  });
}

const verify = dbQuery(`
  select id, slug,
    case
      when skin_concern is null then 'null'
      when cardinality(skin_concern) = 0 then 'empty'
      else 'filled'
    end as concern_state,
    skin_concern
  from products
  where active = true and verified_at is not null
  order by id;
`);

console.log(
  JSON.stringify(
    {
      phase: "staging_fill_skin_concern",
      productionTouched: false,
      updated: results.length,
      results,
      verify,
    },
    null,
    2
  )
);
