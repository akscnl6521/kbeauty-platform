/**
 * Re-enrich non-rejected Staging heroes with labeled HTML INCI + URL overrides.
 * Staging linked only. npm run catalog:inci
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  enrichOfficialUrl,
  stagingStatusFor,
  type EnrichmentRecord,
} from "@/lib/catalog/enrichment";

const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const SPRINT = "full-beauty-20260714";
const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(root, "data", "catalog", "enrichment", `inci-${stamp}`);

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
  if ((r.status ?? 1) !== 0) throw new Error(`${label}: ${(r.stderr || out).slice(-1000)}`);
  const i = out.indexOf("{");
  return i >= 0 ? JSON.parse(out.slice(i)) : {};
}

function brandIdFromExternal(ext: string): string {
  // Prefer first segments until known brand — reuse simple split
  const parts = ext.split("-");
  if (parts[0] === "beauty" && parts[1] === "of") return "beauty-of-joseon";
  if (parts[0] === "some" && parts[1] === "by") return "some-by-mi";
  if (parts[0] === "round" && parts[1] === "lab") return "round-lab";
  if (parts[0] === "dr" && parts[1] === "jart") return "dr-jart";
  if (parts[0] === "banila" && parts[1] === "co") return "banila-co";
  if (parts[0] === "mise" && parts[1] === "en") return "mise-en-scene";
  if (parts[0] === "axis" && parts[1] === "y") return "axis-y";
  return parts[0] ?? "unknown";
}

type Row = {
  external_product_id: string;
  brand_canonical: string;
  product_name_raw: string;
  category_canonical: string | null;
  official_product_url: string | null;
  product_attributes: Record<string, unknown> | null;
};

async function main() {
  const linked = assertStaging();
  mkdirSync(outDir, { recursive: true });
  console.error("[1] load heroes");
  const loaded = q(
    "01-load",
    `
SELECT external_product_id, brand_canonical, product_name_raw, category_canonical,
  official_product_url, COALESCE(product_attributes,'{}'::jsonb) AS product_attributes
FROM catalog_staging_products
WHERE sprint_tag='${SPRINT}' AND product_status <> 'rejected'
ORDER BY brand_canonical, external_product_id;
`
  );
  const rows = (loaded.rows ?? []) as Row[];
  console.error(`[1] n=${rows.length}`);

  const results: EnrichmentRecord[] = [];
  let withInci = 0;
  let matched = 0;
  let evidence = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (!row.official_product_url) continue;
    console.error(`[fetch ${i + 1}/${rows.length}] ${row.external_product_id}`);
    const rec = await enrichOfficialUrl({
      externalProductId: row.external_product_id,
      brand: row.brand_canonical,
      brandIdHint: brandIdFromExternal(row.external_product_id),
      nameRaw: row.product_name_raw,
      category: row.category_canonical,
      officialUrl: row.official_product_url,
      curatedProvenance: "known_hero",
      existingAttributes: row.product_attributes ?? {},
    });
    results.push(rec);
    if (rec.fullIngredients.length) withInci += 1;
    if (rec.matchClass === "official_matched") matched += 1;
    if (rec.evidenceSlugs.length) evidence += 1;
    await new Promise((r) => setTimeout(r, 350));
  }

  console.error(`[2] apply successful enrichments only`);
  const applyable = results.filter(
    (e) =>
      e.matchClass === "official_matched" ||
      e.matchClass === "renewal_suspect" ||
      e.fullIngredients.length > 0 ||
      e.reasons.some((r) => r.startsWith("inci_from_"))
  );
  // Transient failures must not wipe prior Staging match quality
  const skipped = results.length - applyable.length;
  console.error(`[2] apply=${applyable.length} skip_transient=${skipped}`);

  const chunk = 40;
  for (let i = 0; i < applyable.length; i += chunk) {
    const part = applyable.slice(i, i + chunk);
    const sql = part
      .map((e) => {
        const status = stagingStatusFor(e.matchClass);
        const recommendable =
          e.matchClass === "official_matched" && e.fullIngredients.length > 0
            ? "true"
            : e.matchClass === "official_matched"
              ? "true"
              : "false";
        const attrs = sqlEscape(
          JSON.stringify({
            ...(e.attributes ?? {}),
            matchClass: e.matchClass,
            enrichmentReasons: e.reasons,
            fullIngredients: e.fullIngredients,
            keyIngredients: e.keyIngredients,
            price: e.price,
            currency: e.currency,
            description: e.description,
          })
        );
        const url = e.officialUrl
          ? `'${sqlEscape(e.officialUrl)}'`
          : "official_product_url";
        return `
UPDATE catalog_staging_products SET
  product_status='${status}',
  match_class='${e.matchClass}',
  enrichment_reasons='${sqlEscape(JSON.stringify(e.reasons))}'::jsonb,
  recommendable=${recommendable},
  product_name_en=COALESCE(${e.officialName ? `'${sqlEscape(e.officialName)}'` : "NULL"}, product_name_en),
  official_product_url=${url},
  primary_image_url=COALESCE(${e.imageRemoteUrl ? `'${sqlEscape(e.imageRemoteUrl)}'` : "NULL"}, primary_image_url),
  image_source_url=COALESCE(${e.imageRemoteUrl ? `'${sqlEscape(e.imageRemoteUrl)}'` : "NULL"}, image_source_url),
  image_status='${e.imageStatus}',
  image_content_hash=${e.imageContentHash ? `'${sqlEscape(e.imageContentHash)}'` : "NULL"},
  image_rights_status='external_link_only',
  product_attributes='${attrs}'::jsonb,
  evidence_ingredient_slugs='${sqlEscape(JSON.stringify(e.evidenceSlugs))}'::jsonb,
  ingredients_status='${e.fullIngredients.length ? "raw_collected" : "not_found"}',
  last_enriched_at=now(),
  updated_at=now()
WHERE sprint_tag='${SPRINT}' AND external_product_id='${sqlEscape(e.externalProductId)}';`;
      })
      .join("\n");
    q(`10-apply-${Math.floor(i / chunk) + 1}`, sql);
  }

  const counts = q(
    "90-counts",
    `
SELECT
  count(*) FILTER (WHERE sprint_tag='${SPRINT}' AND product_status<>'rejected')::int AS heroes,
  count(*) FILTER (WHERE sprint_tag='${SPRINT}' AND match_class='official_matched')::int AS official_matched,
  count(*) FILTER (WHERE sprint_tag='${SPRINT}' AND ingredients_status='raw_collected')::int AS with_inci,
  count(*) FILTER (WHERE sprint_tag='${SPRINT}' AND recommendable=true)::int AS recommendable,
  count(*) FILTER (WHERE sprint_tag='${SPRINT}' AND product_status='needs_review')::int AS needs_review,
  count(*) FILTER (WHERE sprint_tag='${SPRINT}' AND jsonb_array_length(COALESCE(evidence_ingredient_slugs,'[]'::jsonb))>0)::int AS evidence_linked
FROM catalog_staging_products;
`
  );

  const manifest = {
    phase: "inci_label_enrichment",
    stamp,
    linked,
    productionTouched: false,
    fetched: results.length,
    withInci,
    matched,
    evidence,
    staging: counts.rows?.[0] ?? null,
  };
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(
    path.join(root, "data/catalog/enrichment/latest-inci-manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  console.log(JSON.stringify(manifest));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
