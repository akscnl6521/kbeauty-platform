/**
 * Classify + enrich Staging full-beauty discovery candidates.
 * Brand checkpoints for resume. Staging linked only. No Production.
 *
 * npm run catalog:enrich
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { KR_BRAND_SEED_REGISTRY } from "@/lib/catalog/bulkKr/brandRegistry";
import {
  classifyProvenance,
  enrichOfficialUrl,
  stagingStatusFor,
  type BrandCheckpoint,
  type EnrichmentRecord,
} from "@/lib/catalog/enrichment";

const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const SPRINT = "full-beauty-20260714";
const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(root, "data", "catalog", "enrichment", stamp);
const checkpointPath = path.join(
  root,
  "data",
  "catalog",
  "enrichment",
  "checkpoint.json"
);
const MAX_FETCH_PER_RUN = Number(process.env.ENRICH_MAX_FETCH ?? "40");
const DRY_FETCH = process.env.ENRICH_DRY_FETCH === "1";

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
  const f = path.join(outDir, "sql", `${label}.sql`);
  mkdirSync(path.dirname(f), { recursive: true });
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
    throw new Error(`${label}: ${(r.stderr || out).slice(-1200)}`);
  }
  const i = out.indexOf("{");
  return i >= 0 ? JSON.parse(out.slice(i)) : {};
}

type StagingRow = {
  id: string;
  external_product_id: string;
  brand_canonical: string;
  product_name_raw: string;
  product_name_ko: string | null;
  category_canonical: string | null;
  official_product_url: string | null;
  validation_warnings: unknown;
  product_attributes: Record<string, unknown> | null;
  product_status: string;
};

function loadCheckpoint(): {
  brands: BrandCheckpoint[];
  resumeBrandId: string | null;
} {
  if (!existsSync(checkpointPath)) {
    return {
      brands: KR_BRAND_SEED_REGISTRY.map((b) => ({
        brandId: b.brandId,
        status: "pending" as const,
        processed: 0,
        matched: 0,
        failed: 0,
        placeholders: 0,
        lastError: null,
        updatedAt: new Date().toISOString(),
      })),
      resumeBrandId: KR_BRAND_SEED_REGISTRY[0]?.brandId ?? null,
    };
  }
  return JSON.parse(readFileSync(checkpointPath, "utf8"));
}

function saveCheckpoint(data: {
  brands: BrandCheckpoint[];
  resumeBrandId: string | null;
  summary?: Record<string, unknown>;
}) {
  mkdirSync(path.dirname(checkpointPath), { recursive: true });
  writeFileSync(
    checkpointPath,
    JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2)
  );
}

function brandIdFromExternal(ext: string): string {
  const hit = KR_BRAND_SEED_REGISTRY.find((b) =>
    ext.toLowerCase().startsWith(`${b.brandId}-`)
  );
  return hit?.brandId ?? "unknown";
}

function parseProvenance(warnings: unknown, attrs: Record<string, unknown> | null) {
  if (attrs && typeof attrs.curatedProvenance === "string") {
    return attrs.curatedProvenance;
  }
  const w = Array.isArray(warnings) ? warnings.map(String) : [];
  if (w.includes("discovery_placeholder")) return "category_discovery";
  return "known_hero";
}

async function main() {
  const linked = assertStagingLinked();
  mkdirSync(outDir, { recursive: true });

  console.error("[1] migration");
  qFile(
    "00-mig",
    readFileSync(
      path.join(
        root,
        "supabase/migrations/20260715010000_enrichment_and_bulk_audit.sql"
      ),
      "utf8"
    )
  );

  console.error("[2a] reject placeholders in SQL");
  qFile(
    "01-reject-placeholders",
    `
UPDATE catalog_staging_products SET
  product_status = 'rejected',
  match_class = 'rejected_candidate',
  recommendable = false,
  enrichment_reasons = '["placeholder_not_recommendable"]'::jsonb,
  last_enriched_at = now(),
  updated_at = now()
WHERE sprint_tag = '${SPRINT}'
  AND (
    validation_warnings::text LIKE '%discovery_placeholder%'
    OR product_name_raw ILIKE '%discovery candidate%'
    OR product_name_ko ILIKE '%발견 후보%'
  );
`
  );

  console.error("[2b] load non-placeholder heroes");
  const loaded = qFile(
    "02-load-heroes",
    `
SELECT id::text,
  external_product_id,
  brand_canonical,
  product_name_raw,
  product_name_ko,
  category_canonical,
  official_product_url,
  validation_warnings,
  COALESCE(product_attributes, '{}'::jsonb) AS product_attributes,
  product_status
FROM catalog_staging_products
WHERE sprint_tag = '${SPRINT}'
  AND product_status <> 'rejected'
  AND COALESCE(match_class, '') <> 'rejected_candidate'
ORDER BY brand_canonical, external_product_id;
`
  );
  const rows = (loaded.rows ?? []) as StagingRow[];
  console.error(`[2b] hero rows=${rows.length}`);

  const placeholderCountRes = qFile(
    "02b-placeholder-count",
    `SELECT count(*)::int AS n FROM catalog_staging_products WHERE sprint_tag='${SPRINT}' AND product_status='rejected';`
  );

  const totalRes = qFile(
    "02c-total",
    `SELECT count(*)::int AS n FROM catalog_staging_products WHERE sprint_tag='${SPRINT}';`
  );

  const checkpoint = loadCheckpoint();
  const byBrand = new Map<string, StagingRow[]>();
  for (const row of rows) {
    const bid = brandIdFromExternal(row.external_product_id ?? "");
    if (!byBrand.has(bid)) byBrand.set(bid, []);
    byBrand.get(bid)!.push(row);
  }

  let fetchBudget = MAX_FETCH_PER_RUN;
  const enrichments: EnrichmentRecord[] = [];
  const stats = {
    total: Number(totalRes.rows?.[0]?.n ?? rows.length),
    placeholderRemoved: Number(placeholderCountRes.rows?.[0]?.n ?? 0),
    officialMatched: 0,
    needsReview: 0,
    matchFailed: 0,
    discontinued: 0,
    renewal: 0,
    duplicate: 0,
    withInci: 0,
    withImage: 0,
    withRetailer: 0,
    evidenceLinked: 0,
    fetchesAttempted: 0,
    byDomain: {} as Record<string, number>,
  };

  // Phase A removed: placeholders rejected in SQL. Heroes are fetched brand-by-brand.

  // Phase B: brand-by-brand fetch for non-placeholders
  const brandOrder = KR_BRAND_SEED_REGISTRY.map((b) => b.brandId);
  let resumeIdx = Math.max(
    0,
    brandOrder.indexOf(checkpoint.resumeBrandId ?? brandOrder[0]!)
  );

  for (let bi = resumeIdx; bi < brandOrder.length; bi++) {
    const brandId = brandOrder[bi]!;
    const cp =
      checkpoint.brands.find((b) => b.brandId === brandId) ??
      ({
        brandId,
        status: "pending",
        processed: 0,
        matched: 0,
        failed: 0,
        placeholders: 0,
        lastError: null,
        updatedAt: new Date().toISOString(),
      } satisfies BrandCheckpoint);

    if (cp.status === "completed") {
      checkpoint.resumeBrandId = brandOrder[bi + 1] ?? null;
      continue;
    }

    cp.status = "running";
    cp.updatedAt = new Date().toISOString();
    saveCheckpoint({ brands: checkpoint.brands, resumeBrandId: brandId });

    const brandRows = (byBrand.get(brandId) ?? []).filter((r) => {
      const provenance = parseProvenance(
        r.validation_warnings,
        r.product_attributes
      );
      return provenance !== "category_discovery";
    });

    console.error(`[brand] ${brandId} candidates=${brandRows.length} budget=${fetchBudget}`);

    for (const row of brandRows) {
      const provenance = parseProvenance(
        row.validation_warnings,
        row.product_attributes
      );
      if (!row.official_product_url) {
        enrichments.push({
          externalProductId: row.external_product_id,
          brand: row.brand_canonical,
          brandIdHint: brandId,
          nameRaw: row.product_name_raw,
          category: row.category_canonical,
          officialUrl: null,
          curatedProvenance: provenance,
          matchClass: "match_failed",
          reasons: ["missing_official_url"],
          officialName: null,
          description: null,
          imageRemoteUrl: null,
          imageStatus: "missing",
          imageContentHash: null,
          price: null,
          currency: null,
          availability: null,
          fullIngredients: [],
          keyIngredients: [],
          evidenceSlugs: [],
          attributes: row.product_attributes ?? {},
          fetchedAt: null,
          sourceHost: null,
          robotsAllowed: null,
        });
        cp.failed += 1;
        continue;
      }

      if (fetchBudget <= 0) {
        // Save remaining as needs_review without fetch this run
        enrichments.push({
          externalProductId: row.external_product_id,
          brand: row.brand_canonical,
          brandIdHint: brandId,
          nameRaw: row.product_name_raw,
          category: row.category_canonical,
          officialUrl: row.official_product_url,
          curatedProvenance: provenance,
          matchClass: "needs_review",
          reasons: ["deferred_fetch_budget"],
          officialName: null,
          description: null,
          imageRemoteUrl: null,
          imageStatus: "missing",
          imageContentHash: null,
          price: null,
          currency: null,
          availability: null,
          fullIngredients: [],
          keyIngredients: [],
          evidenceSlugs: [],
          attributes: row.product_attributes ?? {},
          fetchedAt: null,
          sourceHost: null,
          robotsAllowed: null,
        });
        continue;
      }

      fetchBudget -= 1;
      stats.fetchesAttempted += 1;
      try {
        const rec = await enrichOfficialUrl({
          externalProductId: row.external_product_id,
          brand: row.brand_canonical,
          brandIdHint: brandId,
          nameRaw: row.product_name_raw,
          category: row.category_canonical,
          officialUrl: row.official_product_url,
          curatedProvenance: provenance,
          existingAttributes: row.product_attributes ?? {},
          dryFetch: DRY_FETCH,
        });
        enrichments.push(rec);
        cp.processed += 1;
        if (rec.matchClass === "official_matched") cp.matched += 1;
        else if (
          rec.matchClass === "match_failed" ||
          rec.matchClass === "discontinued_suspect"
        ) {
          cp.failed += 1;
        }
      } catch (err) {
        cp.lastError = err instanceof Error ? err.message : String(err);
        cp.failed += 1;
        console.error(`[brand-error] ${brandId}`, cp.lastError);
      }
    }

    cp.status = fetchBudget <= 0 ? "running" : "completed";
    cp.updatedAt = new Date().toISOString();
    const idx = checkpoint.brands.findIndex((b) => b.brandId === brandId);
    if (idx >= 0) checkpoint.brands[idx] = cp;
    else checkpoint.brands.push(cp);

    checkpoint.resumeBrandId =
      cp.status === "completed" ? brandOrder[bi + 1] ?? null : brandId;
    saveCheckpoint({
      brands: checkpoint.brands,
      resumeBrandId: checkpoint.resumeBrandId,
    });

    if (fetchBudget <= 0) {
      console.error(`[budget] exhausted at brand ${brandId}`);
      break;
    }
  }

  // Aggregate stats from enrichments (dedupe by external id — last wins)
  const byExt = new Map<string, EnrichmentRecord>();
  for (const e of enrichments) byExt.set(e.externalProductId, e);
  const final = [...byExt.values()];

  for (const e of final) {
    if (e.matchClass === "official_matched") stats.officialMatched += 1;
    else if (
      e.matchClass === "rejected_candidate" ||
      e.matchClass === "placeholder"
    ) {
      /* already counted placeholders */
    } else if (e.matchClass === "duplicate") stats.duplicate += 1;
    else if (e.matchClass === "discontinued_suspect") stats.discontinued += 1;
    else if (e.matchClass === "renewal_suspect") stats.renewal += 1;
    else if (e.matchClass === "match_failed") stats.matchFailed += 1;
    else stats.needsReview += 1;

    if (e.fullIngredients.length) stats.withInci += 1;
    if (e.imageRemoteUrl && e.imageStatus === "remote_reference") {
      stats.withImage += 1;
    }
    if (e.price != null || e.officialUrl) stats.withRetailer += 1;
    if (e.evidenceSlugs.length) stats.evidenceLinked += 1;
    const domain = String(e.attributes.beautyDomain ?? e.category ?? "other");
    stats.byDomain[domain] = (stats.byDomain[domain] ?? 0) + 1;
  }

  // Apply SQL updates in chunks
  console.error(`[3] apply updates n=${final.length}`);
  const chunk = 80;
  for (let i = 0; i < final.length; i += chunk) {
    const part = final.slice(i, i + chunk);
    const stmts = part.map((e) => {
      const status = stagingStatusFor(e.matchClass);
      const recommendable = e.matchClass === "official_matched" ? "true" : "false";
      const name = e.officialName
        ? `'${sqlEscape(e.officialName)}'`
        : "product_name_en";
      const img = e.imageRemoteUrl
        ? `'${sqlEscape(e.imageRemoteUrl)}'`
        : "primary_image_url";
      const attrs = sqlEscape(
        JSON.stringify({
          ...(e.attributes ?? {}),
          matchClass: e.matchClass,
          enrichmentReasons: e.reasons,
          fullIngredients: e.fullIngredients,
          price: e.price,
          currency: e.currency,
          availability: e.availability,
          description: e.description,
        })
      );
      const reasons = sqlEscape(JSON.stringify(e.reasons));
      const evidence = sqlEscape(JSON.stringify(e.evidenceSlugs));
      const ingStatus =
        e.fullIngredients.length > 0 ? "raw_collected" : "not_found";
      return `
UPDATE catalog_staging_products SET
  product_status = '${status}',
  match_class = '${e.matchClass}',
  enrichment_reasons = '${reasons}'::jsonb,
  recommendable = ${recommendable},
  product_name_en = COALESCE(${name}, product_name_en),
  primary_image_url = ${img},
  image_source_url = ${e.imageRemoteUrl ? `'${sqlEscape(e.imageRemoteUrl)}'` : "image_source_url"},
  image_status = '${e.imageStatus}',
  image_content_hash = ${e.imageContentHash ? `'${sqlEscape(e.imageContentHash)}'` : "NULL"},
  image_rights_status = 'external_link_only',
  product_attributes = '${attrs}'::jsonb,
  evidence_ingredient_slugs = '${evidence}'::jsonb,
  ingredients_status = '${ingStatus}',
  last_enriched_at = now(),
  updated_at = now()
WHERE sprint_tag = '${SPRINT}' AND external_product_id = '${sqlEscape(e.externalProductId)}';`;
    });
    qFile(`10-apply-${Math.floor(i / chunk) + 1}`, stmts.join("\n"));
  }

  // Sync discovery workflow for placeholders
  qFile(
    "20-discovery-reject",
    `
UPDATE product_discovery_candidates
SET workflow_status = 'rejected',
    notes = coalesce(notes,'') || E'\\n[enrichment] placeholder_rejected'
WHERE notes::text LIKE '%${SPRINT}%'
  AND notes::text LIKE '%category_discovery%';
`
  );

  const afterFixed = qFile(
    "91-counts",
    `
SELECT
  count(*) FILTER (WHERE sprint_tag='${SPRINT}')::int AS total,
  count(*) FILTER (WHERE sprint_tag='${SPRINT}' AND match_class='official_matched')::int AS official_matched,
  count(*) FILTER (WHERE sprint_tag='${SPRINT}' AND product_status='rejected')::int AS rejected,
  count(*) FILTER (WHERE sprint_tag='${SPRINT}' AND product_status='needs_review')::int AS needs_review,
  count(*) FILTER (WHERE sprint_tag='${SPRINT}' AND product_status='source_verified')::int AS source_verified,
  count(*) FILTER (WHERE sprint_tag='${SPRINT}' AND recommendable = true)::int AS recommendable,
  count(*) FILTER (WHERE sprint_tag='${SPRINT}' AND ingredients_status='raw_collected')::int AS with_inci,
  count(*) FILTER (WHERE sprint_tag='${SPRINT}' AND primary_image_url IS NOT NULL)::int AS with_image
FROM catalog_staging_products;
`
  );

  const denom = Math.max(
    stats.officialMatched +
      stats.needsReview +
      stats.matchFailed +
      stats.renewal +
      stats.discontinued,
    1
  );
  const manifest = {
    phase: "discovery_enrichment_sprint",
    stamp,
    linked,
    productionTouched: false,
    dryFetch: DRY_FETCH,
    maxFetchPerRun: MAX_FETCH_PER_RUN,
    fetchesAttempted: stats.fetchesAttempted,
    resumeBrandId: checkpoint.resumeBrandId,
    brands: checkpoint.brands,
    stats: {
      ...stats,
      inciRatePct: Number(
        (
          (stats.withInci / Math.max(stats.officialMatched || 1, 1)) *
          100
        ).toFixed(1)
      ),
      imageRatePctAmongMatched: Number(
        (
          (stats.withImage / Math.max(stats.officialMatched || 1, 1)) *
          100
        ).toFixed(1)
      ),
      evidenceRatePct: Number(
        ((stats.evidenceLinked / Math.max(denom, 1)) * 100).toFixed(1)
      ),
    },
    staging: afterFixed.rows?.[0] ?? null,
  };

  writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  writeFileSync(
    path.join(root, "data", "catalog", "enrichment", "latest-manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  saveCheckpoint({
    brands: checkpoint.brands,
    resumeBrandId: checkpoint.resumeBrandId,
    summary: manifest.stats,
  });

  console.log(JSON.stringify(manifest));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
