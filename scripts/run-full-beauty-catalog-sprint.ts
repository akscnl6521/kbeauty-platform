/**
 * Full beauty catalog sprint — generate → process → backup → Staging upsert (batched SQL files).
 * Staging linked-ref only. No Production.
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  copyFileSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  generateFullBeautyCatalog,
  processFullBeautyCatalog,
  type NormalizedBulkProduct,
} from "@/lib/catalog/bulkKr";

const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const SPRINT = "full-beauty-20260714";
const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(root, "data", "catalog", "full-beauty", stamp);
const backupDir = path.join(root, "data", "backups", `full-beauty-${stamp}`);
const sqlDir = path.join(outDir, "sql");

function assertStagingLinked() {
  const refPath = path.join(root, "supabase", ".temp", "project-ref");
  if (!existsSync(refPath)) throw new Error("missing supabase/.temp/project-ref");
  const linked = readFileSync(refPath, "utf8").trim();
  if (linked === PROD) throw new Error("ABORT_PRODUCTION");
  if (linked !== STAGING) throw new Error(`ABORT_NOT_STAGING:${linked}`);
  return linked;
}

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

function qFile(label: string, sql: string) {
  const f = path.join(sqlDir, `${label}.sql`);
  writeFileSync(f, sql, "utf8");
  console.error(`[sql] ${label} ${(sql.length / 1024).toFixed(1)}kb`);
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
  const err = r.stderr || "";
  if ((r.status ?? 1) !== 0) {
    throw new Error(`${label} failed: ${(err || out).slice(-1500)}`);
  }
  const i = out.indexOf("{");
  return i >= 0 ? JSON.parse(out.slice(i)) : {};
}

function discoveryValues(batch: NormalizedBulkProduct[]): string {
  return batch
    .map((p) => {
      const workflow =
        p.disposition === "needs_review" ? "needs_review" : "discovered";
      const notes = sqlEscape(
        JSON.stringify({
          sprint: SPRINT,
          disposition: p.disposition,
          confidence: p.confidenceScore,
          reviewReasons: p.reviewReasons,
          evidenceIngredientSlugs: p.evidenceIngredientSlugs,
          evidenceConcernCodes: p.evidenceConcernCodes,
          domain: p.domain,
          category: p.category,
          curatedProvenance: p.curatedProvenance,
          imageRemoteUrl: p.imageRemoteUrl,
          imageRights: "external_link_only",
          attributes: p.attributes,
          slug: p.slug,
        })
      );
      return `(
        '${sqlEscape(p.nameKo)}',
        '${sqlEscape(p.brand)}',
        '${sqlEscape(p.officialUrl)}',
        'KR',
        'brand_csv',
        '${workflow}',
        'pending','pending',
        '${p.evidenceIngredientSlugs.length ? "pass" : "pending"}',
        'pending','pass',
        '${notes}',
        now()
      )`;
    })
    .join(",\n");
}

function stagingValues(batch: NormalizedBulkProduct[]): string {
  return batch
    .map((p) => {
      const status =
        p.disposition === "auto_register" ? "data_complete" : "needs_review";
      const ingStatus = p.hasFullInci ? "raw_collected" : "not_found";
      const attrs = sqlEscape(JSON.stringify(p.attributes ?? {}));
      const warnings = sqlEscape(JSON.stringify(p.reviewReasons));
      const img = p.imageRemoteUrl
        ? `'${sqlEscape(JSON.stringify([p.imageRemoteUrl]))}'::jsonb`
        : `'[]'::jsonb`;
      const imgPrimary = p.imageRemoteUrl
        ? `'${sqlEscape(p.imageRemoteUrl)}'`
        : "NULL";
      const evIng = sqlEscape(JSON.stringify(p.evidenceIngredientSlugs));
      const evCon = sqlEscape(JSON.stringify(p.evidenceConcernCodes));
      const undertone = sqlEscape(
        JSON.stringify(p.attributes.undertoneFit ?? [])
      );
      return `(
        '${sqlEscape(p.slug)}',
        '${sqlEscape(p.brand)}',
        '${sqlEscape(p.brand)}',
        '${sqlEscape(p.nameEn)}',
        '${sqlEscape(p.nameKo)}',
        '${sqlEscape(p.nameEn)}',
        '${sqlEscape(p.category)}',
        '${sqlEscape(p.category)}',
        '${sqlEscape(p.domain)}',
        '${sqlEscape(p.categoryDetail)}',
        ${p.volumeMl == null ? "NULL" : p.volumeMl},
        'ml',
        ${img},
        ${imgPrimary},
        '${sqlEscape(p.officialUrl)}',
        '${sqlEscape(JSON.stringify([p.officialUrl]))}'::jsonb,
        '${status}',
        '${ingStatus}',
        '${warnings}'::jsonb,
        '${sqlEscape(p.canonicalKey)}',
        '${attrs}'::jsonb,
        '${undertone}'::jsonb,
        '${evIng}'::jsonb,
        '${evCon}'::jsonb,
        ${p.confidenceScore},
        ${p.imageRemoteUrl ? `'${sqlEscape(p.imageRemoteUrl)}'` : "NULL"},
        'external_link_only',
        '${SPRINT}',
        false,
        false,
        now(),
        now()
      )`;
    })
    .join(",\n");
}

async function main() {
  const linked = assertStagingLinked();
  mkdirSync(outDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });
  mkdirSync(sqlDir, { recursive: true });

  console.error("[1] apply migration");
  qFile(
    "00-migration",
    readFileSync(
      path.join(
        root,
        "supabase/migrations/20260714100000_full_beauty_catalog_attributes.sql"
      ),
      "utf8"
    )
  );

  console.error("[2] generate+process");
  const { items: raw, underTargetReason } = generateFullBeautyCatalog(1000);
  const { products, stats } = processFullBeautyCatalog(raw);

  writeFileSync(
    path.join(outDir, "raw-catalog.json"),
    JSON.stringify({ stamp, underTargetReason, count: raw.length }, null, 2)
  );
  // Compact processed export (no giant dump in GitHub later — keep local only)
  writeFileSync(
    path.join(outDir, "processed-summary.json"),
    JSON.stringify(
      {
        stamp,
        stats,
        sample: products.slice(0, 20),
        autoRegisterSlugs: products
          .filter((p) => p.disposition === "auto_register")
          .map((p) => p.slug),
      },
      null,
      2
    )
  );
  writeFileSync(
    path.join(outDir, "processed-full.json"),
    JSON.stringify({ stamp, stats, items: products })
  );

  const pct = (n: number) =>
    stats.total ? Number(((n / stats.total) * 100).toFixed(1)) : 0;

  const failureReasons: Record<string, number> = {};
  for (const p of products) {
    for (const r of p.reviewReasons) {
      failureReasons[r] = (failureReasons[r] ?? 0) + 1;
    }
  }
  const topFailures = Object.entries(failureReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([reason, count]) => ({ reason, count }));

  const upsertable = products.filter(
    (p) => p.disposition === "auto_register" || p.disposition === "needs_review"
  );

  console.error("[3] crawl job log");
  qFile(
    "01-job",
    `
INSERT INTO public.catalog_crawl_jobs (
  job_type, status, discovered_count, parsed_count, staged_count,
  needs_review_count, duplicate_count, error_count, dry_run, finished_at, error_summary
) VALUES (
  'full_beauty_curated_seed', 'completed', ${stats.total}, ${stats.total},
  ${stats.autoRegister}, ${stats.needsReview}, ${stats.duplicate}, ${stats.failed},
  false, now(), '${sqlEscape(JSON.stringify(topFailures))}'::jsonb
);
`
  );

  // Prefer fewer round-trips: 200-row chunks
  const chunk = 200;
  let discoveryUpserted = 0;
  let stagingUpserted = 0;
  for (let i = 0; i < upsertable.length; i += chunk) {
    const part = upsertable.slice(i, i + chunk);
    const n = Math.floor(i / chunk) + 1;
    console.error(`[4] discovery chunk ${n}`);
    qFile(
      `10-discovery-${n}`,
      `
INSERT INTO public.product_discovery_candidates (
  discovered_name, discovered_brand, discovered_url, discovered_country,
  source_type, workflow_status,
  sale_check_status, ingredient_check_status, evidence_check_status,
  safety_check_status, duplicate_check_status, notes, discovered_at
)
VALUES ${discoveryValues(part)}
ON CONFLICT (discovered_url) WHERE discovered_url IS NOT NULL
DO UPDATE SET
  notes = EXCLUDED.notes,
  workflow_status = CASE
    WHEN public.product_discovery_candidates.workflow_status IN ('published','verified','rejected')
      THEN public.product_discovery_candidates.workflow_status
    ELSE EXCLUDED.workflow_status
  END;
`
    );
    discoveryUpserted += part.length;

    console.error(`[5] staging chunk ${n}`);
    qFile(
      `20-staging-${n}`,
      `
INSERT INTO public.catalog_staging_products (
  external_product_id, brand_raw, brand_canonical,
  product_name_raw, product_name_ko, product_name_en,
  category_raw, category_canonical, beauty_domain, category_detail,
  size_value, size_unit,
  image_urls, primary_image_url, official_product_url, source_urls,
  product_status, ingredients_status, validation_warnings, duplicate_group_key,
  product_attributes, undertone_fit, evidence_ingredient_slugs, evidence_concern_codes,
  confidence_score, image_source_url, image_rights_status, sprint_tag,
  is_fixture, test_only, first_seen_at, last_seen_at
)
VALUES ${stagingValues(part)}
ON CONFLICT (sprint_tag, external_product_id)
WHERE sprint_tag IS NOT NULL AND external_product_id IS NOT NULL
DO UPDATE SET
  product_status = EXCLUDED.product_status,
  validation_warnings = EXCLUDED.validation_warnings,
  confidence_score = EXCLUDED.confidence_score,
  product_attributes = EXCLUDED.product_attributes,
  evidence_ingredient_slugs = EXCLUDED.evidence_ingredient_slugs,
  evidence_concern_codes = EXCLUDED.evidence_concern_codes,
  last_seen_at = now(),
  updated_at = now();
`
    );
    stagingUpserted += part.length;
  }

  console.error("[6] counts");
  const after = qFile(
    "90-counts",
    `
SELECT
  (SELECT count(*)::int FROM catalog_staging_products WHERE sprint_tag='${SPRINT}') AS staging_rows,
  (SELECT count(*)::int FROM catalog_staging_products WHERE sprint_tag='${SPRINT}' AND product_status='data_complete') AS staging_auto,
  (SELECT count(*)::int FROM catalog_staging_products WHERE sprint_tag='${SPRINT}' AND product_status='needs_review') AS staging_review,
  (SELECT count(*)::int FROM product_discovery_candidates WHERE notes::text LIKE '%${SPRINT}%') AS discovery_rows
`
  );

  const manifest = {
    phase: "full_beauty_catalog_sprint",
    stamp,
    linked,
    productionTouched: false,
    underTargetReason,
    stats: {
      ...stats,
      imageRatePct: pct(stats.withImage),
      fullInciRatePct: pct(stats.withFullInci),
      retailerHintRatePct: pct(stats.withRetailerHint),
      evidenceLinkedRatePct: pct(stats.evidenceLinked),
    },
    staging: {
      discoveryUpserted,
      stagingUpserted,
      rows: after.rows?.[0] ?? null,
    },
    topFailures,
    policy: {
      publicVerifiedAutoPromote: false,
      imageRights: "external_link_only",
      liveCrawl: false,
      categoryDiscoveryMarkedNeedsReview: true,
    },
    outputs: {
      outDir: path.relative(root, outDir),
      backupDir: path.relative(root, backupDir),
    },
  };

  writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  copyFileSync(
    path.join(outDir, "manifest.json"),
    path.join(backupDir, "manifest.json")
  );
  copyFileSync(
    path.join(outDir, "processed-summary.json"),
    path.join(backupDir, "processed-summary.json")
  );
  mkdirSync(path.join(root, "data", "catalog", "full-beauty"), { recursive: true });
  writeFileSync(
    path.join(root, "data", "catalog", "full-beauty", "latest-manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  // Drop heavy processed-full from tree before commit? keep in stamp folder untracked via gitignore later
  try {
    unlinkSync(path.join(outDir, "processed-full.json"));
  } catch {
    /* ignore */
  }

  console.log(JSON.stringify(manifest));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
