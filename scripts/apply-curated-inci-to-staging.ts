/**
 * Apply curated official INCI label sheet → Staging catalog_staging_products.
 * Never invents ingredients. Staging linked only.
 * npm run catalog:labels
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
import { evidenceSlugsFromIngredients } from "@/lib/catalog/labels/evidenceFromIngredients";
import { parseOfficialIngredientsRaw } from "@/lib/catalog/automation/ingredientParser";

const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(root, "data", "catalog", "labels", `apply-${stamp}`);
const force = process.argv.includes("--force");

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

type StagingRow = {
  id: string;
  external_product_id: string;
  product_attributes: Record<string, unknown> | null;
  ingredients_status: string;
  enrichment_reasons: unknown;
};

async function main() {
  const linked = assertStaging();
  mkdirSync(outDir, { recursive: true });
  const sheet = loadOfficialInciLabelSheet();
  const sprint = sheet._meta.sprintTagDefault;

  console.error(`[1] load staging heroes sprint=${sprint}`);
  const loaded = q(
    "01-load",
    `
SELECT id, external_product_id,
  COALESCE(product_attributes,'{}'::jsonb) AS product_attributes,
  ingredients_status,
  COALESCE(enrichment_reasons,'[]'::jsonb) AS enrichment_reasons
FROM catalog_staging_products
WHERE sprint_tag='${sqlEscape(sprint)}'
  AND product_status <> 'rejected';
`
  );
  const rows = (loaded.rows ?? []) as StagingRow[];
  const byId = new Map(rows.map((r) => [r.external_product_id, r]));

  let applied = 0;
  let skippedMissing = 0;
  let skippedEmpty = 0;
  let skippedConflict = 0;
  let evidenceLinked = 0;

  const applyable = sheet.entries.filter((e) => e.applyReady);
  console.error(`[2] sheet applyReady=${applyable.length} stagingRows=${rows.length}`);

  for (const entry of applyable) {
    const row = byId.get(entry.externalProductId);
    if (!row) {
      skippedMissing += 1;
      continue;
    }

    let tokens = resolveEntryTokens(entry);
    const parsed = parseOfficialIngredientsRaw({
      ingredientsRaw: entry.fullIngredientsRaw,
      sourceUrl: entry.sourceUrl,
      sourceType: entry.sourceType,
      sourceTier: 1,
      sourceVerified: true,
    });
    if (parsed.tokens.length >= 3) {
      tokens = parsed.tokens.map((t) => t.inciName || t.ingredientRaw);
    }
    if (tokens.length < 3) {
      skippedEmpty += 1;
      continue;
    }

    const attrs = (row.product_attributes ?? {}) as Record<string, unknown>;
    const existing = Array.isArray(attrs.fullIngredients)
      ? (attrs.fullIngredients as unknown[]).filter((x) => typeof x === "string")
      : [];
    if (existing.length > 0 && !force) {
      skippedConflict += 1;
      continue;
    }

    const evidence = evidenceSlugsFromIngredients(tokens);
    if (evidence.length) evidenceLinked += 1;

    const reasonsPrev = Array.isArray(row.enrichment_reasons)
      ? row.enrichment_reasons
      : [];
    const reasons = [
      ...reasonsPrev.map(String).filter((r) => !r.startsWith("inci_from_curated")),
      `inci_from_curated_label_sheet:${entry.sourceType}`,
    ];

    const nextAttrs = {
      ...attrs,
      fullIngredients: tokens,
      keyIngredients: tokens.slice(0, 8),
      curatedLabelSource: {
        sourceType: entry.sourceType,
        sourceUrl: entry.sourceUrl,
        labelCheckedAt: entry.labelCheckedAt,
        sheetVersion: sheet._meta.sheetVersion,
      },
      matchClass: attrs.matchClass ?? undefined,
      enrichmentReasons: reasons,
    };

    const tokenJson = sqlEscape(
      JSON.stringify(
        parsed.tokens.map((t, i) => ({
          ord: i,
          raw: t.ingredientRaw,
          inci: t.inciName ?? null,
          key: t.canonicalKey ?? null,
          status: t.normalizationStatus,
          conf: t.confidence,
        }))
      )
    );

    q(
      `10-apply-${entry.externalProductId.slice(0, 40)}`,
      `
UPDATE catalog_staging_products SET
  ingredients_status='raw_collected',
  product_attributes='${sqlEscape(JSON.stringify(nextAttrs))}'::jsonb,
  evidence_ingredient_slugs='${sqlEscape(JSON.stringify(evidence))}'::jsonb,
  enrichment_reasons='${sqlEscape(JSON.stringify(reasons))}'::jsonb,
  last_enriched_at=now(),
  updated_at=now()
WHERE sprint_tag='${sqlEscape(sprint)}'
  AND external_product_id='${sqlEscape(entry.externalProductId)}';

DELETE FROM catalog_staging_ingredients
WHERE staging_product_id='${sqlEscape(row.id)}';

INSERT INTO catalog_staging_ingredients (
  staging_product_id, display_order, ingredient_raw, inci_name, canonical_key,
  normalization_status, confidence, source_url, source_type, source_verified
)
SELECT
  '${sqlEscape(row.id)}'::uuid,
  (e->>'ord')::int,
  e->>'raw',
  NULLIF(e->>'inci',''),
  NULLIF(e->>'key',''),
  COALESCE(e->>'status','raw'),
  COALESCE((e->>'conf')::numeric, 0.35),
  '${sqlEscape(entry.sourceUrl)}',
  '${sqlEscape(entry.sourceType)}',
  true
FROM jsonb_array_elements('${tokenJson}'::jsonb) AS e;
`
    );
    applied += 1;
    console.error(`[apply] ${entry.externalProductId} n=${tokens.length} evidence=${evidence.length}`);
  }

  const counts = q(
    "90-counts",
    `
SELECT
  count(*) FILTER (WHERE sprint_tag='${sqlEscape(sprint)}' AND product_status<>'rejected')::int AS heroes,
  count(*) FILTER (WHERE sprint_tag='${sqlEscape(sprint)}' AND ingredients_status='raw_collected')::int AS with_inci,
  count(*) FILTER (WHERE sprint_tag='${sqlEscape(sprint)}' AND match_class='official_matched')::int AS official_matched,
  count(*) FILTER (WHERE sprint_tag='${sqlEscape(sprint)}' AND jsonb_array_length(COALESCE(evidence_ingredient_slugs,'[]'::jsonb))>0)::int AS evidence_linked,
  count(*) FILTER (WHERE sprint_tag='${sqlEscape(sprint)}' AND recommendable=true)::int AS recommendable
FROM catalog_staging_products;
`
  );

  const manifest = {
    phase: "curated_inci_label_sheet",
    stamp,
    linked,
    productionTouched: false,
    force,
    sheetEntries: sheet.entries.length,
    applyReady: applyable.length,
    applied,
    skippedMissing,
    skippedEmpty,
    skippedConflict,
    evidenceLinked,
    staging: counts.rows?.[0] ?? null,
  };
  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(
    path.join(root, "data/catalog/labels/latest-apply-manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  console.log(JSON.stringify(manifest));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
