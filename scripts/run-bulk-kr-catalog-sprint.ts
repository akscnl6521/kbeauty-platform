/**
 * Bulk KR catalog sprint runner — generate → process → backup → Staging upsert.
 * Staging linked-ref only. No Production.
 *
 * Run: npx tsx scripts/run-bulk-kr-catalog-sprint.ts
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  copyFileSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import {
  generateBulkKrSeedCatalog,
  processBulkKrCatalog,
  type NormalizedBulkProduct,
} from "@/lib/catalog/bulkKr";

const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(root, "data", "catalog", "bulk-kr", stamp);
const backupDir = path.join(root, "data", "backups", `bulk-kr-${stamp}`);

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

function q(sql: string) {
  const f = path.join(tmpdir(), `kb-bulk-${process.pid}.sql`);
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
      throw new Error((r.stderr || out).slice(-800));
    }
    return i >= 0 ? JSON.parse(out.slice(i)) : {};
  } finally {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("node:fs").unlinkSync(f);
    } catch {}
  }
}

function buildUpsertSql(batch: NormalizedBulkProduct[]): string {
  const values = batch
    .map((p) => {
      const workflow =
        p.disposition === "needs_review" ? "needs_review" : "discovered";
      const notes = sqlEscape(
        JSON.stringify({
          sprint: "bulk-kr-catalog",
          disposition: p.disposition,
          confidence: p.confidenceScore,
          reviewReasons: p.reviewReasons,
          evidenceIngredientSlugs: p.evidenceIngredientSlugs,
          evidenceConcernCodes: p.evidenceConcernCodes,
          keyIngredients: p.keyIngredients,
          category: p.category,
          volumeMl: p.volumeMl,
          imageRemoteUrl: p.imageRemoteUrl,
          imageRights: "external_link_only",
          retailerHint: p.retailerHint,
          slug: p.slug,
        })
      );
      return `(
        '${sqlEscape(p.nameKo)}',
        '${sqlEscape(p.brand)}',
        '${sqlEscape(p.officialUrl)}',
        'KR',
        'official_brand_page',
        '${workflow}',
        'pending',
        'pending',
        '${p.evidenceIngredientSlugs.length ? "pass" : "pending"}',
        'pending',
        'pass',
        '${notes}',
        now()
      )`;
    })
    .join(",\n");

  return `
INSERT INTO public.product_discovery_candidates (
  discovered_name, discovered_brand, discovered_url, discovered_country,
  source_type, workflow_status,
  sale_check_status, ingredient_check_status, evidence_check_status,
  safety_check_status, duplicate_check_status, notes, discovered_at
)
VALUES ${values}
ON CONFLICT (discovered_url) WHERE discovered_url IS NOT NULL
DO UPDATE SET
  notes = EXCLUDED.notes,
  workflow_status = CASE
    WHEN public.product_discovery_candidates.workflow_status IN ('published','verified','rejected')
      THEN public.product_discovery_candidates.workflow_status
    ELSE EXCLUDED.workflow_status
  END;
`;
}

async function main() {
  const linked = assertStagingLinked();
  mkdirSync(outDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });

  const raw = generateBulkKrSeedCatalog(500);
  const { products, stats } = processBulkKrCatalog(raw);

  const rawPath = path.join(outDir, "raw-catalog.json");
  const processedPath = path.join(outDir, "processed-catalog.json");
  const manifestPath = path.join(outDir, "manifest.json");

  writeFileSync(rawPath, JSON.stringify({ generatedAt: stamp, items: raw }, null, 2));
  writeFileSync(
    processedPath,
    JSON.stringify({ generatedAt: stamp, stats, items: products }, null, 2)
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
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));

  // Staging upsert in chunks (auto_register + needs_review only)
  const upsertable = products.filter(
    (p) => p.disposition === "auto_register" || p.disposition === "needs_review"
  );
  const chunkSize = 40;
  let upserted = 0;
  for (let i = 0; i < upsertable.length; i += chunkSize) {
    const chunk = upsertable.slice(i, i + chunkSize);
    q(buildUpsertSql(chunk));
    upserted += chunk.length;
  }

  const after = q(`
SELECT
  count(*) FILTER (WHERE notes::text LIKE '%bulk-kr-catalog%')::int AS sprint_rows,
  count(*) FILTER (WHERE notes::text LIKE '%bulk-kr-catalog%' AND workflow_status='discovered')::int AS discovered,
  count(*) FILTER (WHERE notes::text LIKE '%bulk-kr-catalog%' AND workflow_status='needs_review')::int AS needs_review
FROM product_discovery_candidates;
`);

  const manifest = {
    phase: "bulk_kr_catalog_sprint",
    stamp,
    linked,
    productionTouched: false,
    stats: {
      ...stats,
      imageRatePct: pct(stats.withImage),
      fullInciRatePct: pct(stats.withFullInci),
      retailerHintRatePct: pct(stats.withRetailerHint),
      evidenceLinkedRatePct: pct(stats.evidenceLinked),
    },
    staging: {
      upsertAttempted: upserted,
      rows: after.rows?.[0] ?? null,
    },
    topFailures,
    outputs: {
      rawPath: path.relative(root, rawPath),
      processedPath: path.relative(root, processedPath),
      backupDir: path.relative(root, backupDir),
    },
    policy: {
      publicVerifiedAutoPromote: false,
      imageRights: "external_link_only",
      liveCrawl: false,
    },
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  copyFileSync(processedPath, path.join(backupDir, "processed-catalog.json"));
  copyFileSync(manifestPath, path.join(backupDir, "manifest.json"));

  console.log(JSON.stringify(manifest));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
