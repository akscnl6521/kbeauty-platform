/**
 * Upsert applyReady label-sheet entries missing from Staging heroes.
 * Uses only curated sheet data (official URLs + INCI). Staging linked only.
 * npm run catalog:labels:upsert-heroes
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  loadOfficialInciLabelSheet,
  resolveEntryTokens,
} from "@/lib/catalog/labels";

const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(root, "data", "catalog", "labels", `upsert-${stamp}`);

function assertStaging() {
  const linked = readFileSync(
    path.join(root, "supabase/.temp/project-ref"),
    "utf8"
  ).trim();
  if (linked === PROD) throw new Error("ABORT_PRODUCTION");
  if (linked !== STAGING) throw new Error(`ABORT_NOT_STAGING:${linked}`);
  return linked;
}

function sqlEscape(s: string) {
  return s.replace(/'/g, "''");
}

function q(label: string, sql: string) {
  mkdirSync(path.join(outDir, "sql"), { recursive: true });
  const f = path.join(outDir, "sql", `${label}.sql`);
  writeFileSync(f, sql, "utf8");
  const r = spawnSync(
    "npx.cmd",
    ["supabase", "db", "query", "--linked", "--file", f, "-o", "json"],
    {
      cwd: root,
      encoding: "utf8",
      shell: true,
      env: { ...process.env, npm_config_loglevel: "silent" },
      timeout: 180000,
    }
  );
  const out = r.stdout || "";
  if ((r.status ?? 1) !== 0) {
    throw new Error(`${label}: ${(r.stderr || out).slice(-1000)}`);
  }
  const i = out.indexOf("{");
  return i >= 0 ? JSON.parse(out.slice(i)) : {};
}

function guessCategory(id: string, name: string): {
  category: string;
  domain: string;
} {
  const s = `${id} ${name}`.toLowerCase();
  if (/cleanser|gel cleanser|foam/.test(s))
    return { category: "foam_cleanser", domain: "skincare" };
  if (/toner/.test(s)) return { category: "toner", domain: "skincare" };
  if (/serum|booster/.test(s)) return { category: "serum", domain: "skincare" };
  if (/cream|moisturizer/.test(s)) return { category: "cream", domain: "skincare" };
  if (/sunscreen|spf/.test(s)) return { category: "sunscreen", domain: "skincare" };
  if (/essence/.test(s)) return { category: "essence", domain: "skincare" };
  return { category: "skincare", domain: "skincare" };
}

async function main() {
  const linked = assertStaging();
  mkdirSync(outDir, { recursive: true });
  const sheet = loadOfficialInciLabelSheet();
  const sprint = sheet._meta.sprintTagDefault;

  const existing = q(
    "01-existing",
    `
SELECT external_product_id
FROM catalog_staging_products
WHERE sprint_tag='${sqlEscape(sprint)}'
  AND product_status <> 'rejected';
`
  );
  const have = new Set(
    ((existing.rows ?? []) as { external_product_id: string }[]).map(
      (r) => r.external_product_id
    )
  );

  const missing = sheet.entries.filter(
    (e) =>
      e.applyReady &&
      resolveEntryTokens(e).length >= 3 &&
      !have.has(e.externalProductId) &&
      !/probe/i.test(e.externalProductId)
  );

  console.error(`[1] missing heroes to upsert=${missing.length}`);
  if (missing.length === 0) {
    const manifest = {
      phase: "label_sheet_upsert_heroes",
      stamp,
      linked,
      upserted: 0,
      productionTouched: false,
    };
    writeFileSync(
      path.join(root, "data/catalog/labels/latest-upsert-manifest.json"),
      JSON.stringify(manifest, null, 2)
    );
    console.log(JSON.stringify(manifest));
    return;
  }

  const values = missing
    .map((e) => {
      const name = e.productNameEn ?? e.externalProductId;
      const { category, domain } = guessCategory(e.externalProductId, name);
      const attrs = sqlEscape(
        JSON.stringify({
          provenance: "curated_label_sheet",
          sheetVersion: sheet._meta.sheetVersion,
          curatedLabelSource: {
            sourceType: e.sourceType,
            sourceUrl: e.sourceUrl,
            labelCheckedAt: e.labelCheckedAt,
          },
        })
      );
      return `(
  '${sqlEscape(e.externalProductId)}',
  '${sqlEscape(e.brandCanonical)}',
  '${sqlEscape(e.brandCanonical)}',
  '${sqlEscape(name)}',
  '${sqlEscape(name)}',
  '${sqlEscape(category)}',
  '${sqlEscape(category)}',
  '${sqlEscape(domain)}',
  '${sqlEscape(e.sourceUrl)}',
  '${sqlEscape(JSON.stringify([e.sourceUrl]))}'::jsonb,
  'source_verified',
  'not_found',
  'official_matched',
  '${sqlEscape(JSON.stringify(["from_curated_label_sheet"]))}'::jsonb,
  true,
  '${attrs}'::jsonb,
  'external_link_only',
  '${sqlEscape(sprint)}',
  false,
  false,
  now(),
  now()
)`;
    })
    .join(",\n");

  q(
    "10-upsert",
    `
INSERT INTO public.catalog_staging_products (
  external_product_id, brand_raw, brand_canonical,
  product_name_raw, product_name_en,
  category_raw, category_canonical, beauty_domain,
  official_product_url, source_urls,
  product_status, ingredients_status, match_class, enrichment_reasons,
  recommendable, product_attributes, image_rights_status, sprint_tag,
  is_fixture, test_only, first_seen_at, last_seen_at
)
VALUES ${values}
ON CONFLICT (sprint_tag, external_product_id)
WHERE sprint_tag IS NOT NULL AND external_product_id IS NOT NULL
DO UPDATE SET
  official_product_url = COALESCE(EXCLUDED.official_product_url, catalog_staging_products.official_product_url),
  match_class = CASE
    WHEN catalog_staging_products.match_class = 'official_matched' THEN catalog_staging_products.match_class
    ELSE EXCLUDED.match_class
  END,
  product_status = CASE
    WHEN catalog_staging_products.product_status IN ('approved','rejected') THEN catalog_staging_products.product_status
    ELSE EXCLUDED.product_status
  END,
  recommendable = CASE
    WHEN catalog_staging_products.product_status = 'rejected' THEN false
    ELSE true
  END,
  last_seen_at = now(),
  updated_at = now();
`
  );

  // Link approved_product_id when public.products slug matches
  q(
    "20-link-products",
    `
UPDATE catalog_staging_products s
SET approved_product_id = p.id,
    updated_at = now()
FROM products p
WHERE s.sprint_tag='${sqlEscape(sprint)}'
  AND s.external_product_id = p.slug
  AND s.approved_product_id IS NULL
  AND s.external_product_id IN (${missing
    .map((e) => `'${sqlEscape(e.externalProductId)}'`)
    .join(",")});
`
  );

  const counts = q(
    "90-counts",
    `
SELECT
  count(*) FILTER (WHERE sprint_tag='${sqlEscape(sprint)}' AND product_status<>'rejected')::int AS heroes,
  count(*) FILTER (WHERE sprint_tag='${sqlEscape(sprint)}' AND match_class='official_matched')::int AS official_matched,
  count(*) FILTER (WHERE sprint_tag='${sqlEscape(sprint)}' AND ingredients_status='raw_collected')::int AS with_inci,
  count(*) FILTER (WHERE sprint_tag='${sqlEscape(sprint)}' AND recommendable=true)::int AS recommendable
FROM catalog_staging_products;
`
  );

  const manifest = {
    phase: "label_sheet_upsert_heroes",
    stamp,
    linked,
    productionTouched: false,
    upserted: missing.length,
    ids: missing.map((e) => e.externalProductId),
    staging: counts.rows?.[0] ?? null,
  };
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(
    path.join(root, "data/catalog/labels/latest-upsert-manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  console.log(JSON.stringify(manifest));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
