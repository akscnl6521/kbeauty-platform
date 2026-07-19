import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { compareProductIdentity } from "@/lib/catalog/automation/productIdentity";
import type { ParsedCatalogProduct } from "@/lib/catalog/automation/types";

const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(root, "data", "catalog", "dedupe", stamp);

function assertStagingLinked(): string {
  const refPath = path.join(root, "supabase", ".temp", "project-ref");
  if (!existsSync(refPath)) throw new Error("missing supabase/.temp/project-ref");
  const linked = readFileSync(refPath, "utf8").trim();
  if (linked === PROD) throw new Error("ABORT_PRODUCTION");
  if (linked !== STAGING) throw new Error(`ABORT_NOT_STAGING:${linked}`);
  return linked;
}

function query(sql: string): Record<string, unknown>[] {
  mkdirSync(outDir, { recursive: true });
  const sqlPath = path.join(outDir, "read-candidates.sql");
  writeFileSync(sqlPath, sql, "utf8");
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(
    command,
    ["supabase", "db", "query", "--linked", "--file", sqlPath, "-o", "json"],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, npm_config_loglevel: "silent" },
      timeout: 180000,
    }
  );
  const output = result.stdout || "";
  if ((result.status ?? 1) !== 0) {
    throw new Error((result.stderr || output).slice(-1200));
  }
  const start = output.indexOf("{");
  const parsed = start >= 0 ? JSON.parse(output.slice(start)) : {};
  return Array.isArray(parsed.rows) ? parsed.rows : [];
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toProduct(row: Record<string, unknown>): ParsedCatalogProduct {
  const attrs =
    row.product_attributes && typeof row.product_attributes === "object"
      ? (row.product_attributes as Record<string, unknown>)
      : {};
  const officialUrl = text(row.official_product_url);
  const image = text(row.primary_image_url);
  return {
    brandRaw: text(row.brand_canonical) ?? "Unknown",
    brandCanonical: text(row.brand_canonical),
    productNameRaw: text(row.product_name_raw) ?? text(row.product_name_en) ?? "Unknown",
    productNameKo: text(row.product_name_ko),
    productNameEn: text(row.product_name_en),
    categoryCanonical: text(row.category_canonical),
    sizeValue: number(attrs.sizeValue),
    sizeUnit: text(attrs.sizeUnit),
    gtin: text(attrs.gtin),
    sku: text(attrs.sku),
    imageUrls: image ? [image] : [],
    primaryImageUrl: image,
    officialProductUrl: officialUrl,
    sourceUrls: officialUrl ? [officialUrl] : [],
    sourceTier: 1,
  };
}

function main() {
  const linked = assertStagingLinked();
  const rows = query(`
SELECT id::text,
       external_product_id,
       brand_canonical,
       product_name_raw,
       product_name_ko,
       product_name_en,
       category_canonical,
       official_product_url,
       primary_image_url,
       COALESCE(product_attributes, '{}'::jsonb) AS product_attributes,
       product_status,
       recommendable
FROM catalog_staging_products
WHERE product_status IN ('source_verified', 'needs_review', 'parsed')
  AND COALESCE(match_class, '') NOT IN ('rejected_candidate', 'duplicate')
ORDER BY brand_canonical, external_product_id;
`);

  const decisions: Record<string, unknown>[] = [];
  const accepted: Record<string, unknown>[] = [];

  for (const row of rows) {
    const product = toProduct(row);
    let matched = false;
    for (const prior of accepted) {
      const decision = compareProductIdentity(toProduct(prior), product);
      if (decision.kind === "distinct") continue;
      decisions.push({
        externalProductId: row.external_product_id,
        relatedExternalProductId: prior.external_product_id,
        decision: decision.kind,
        confidence: decision.confidence,
        reasons: decision.reasons,
        proposedStatus:
          decision.kind === "exact_duplicate"
            ? "duplicate_candidate"
            : decision.kind === "renewal_suspect"
              ? "needs_review"
              : row.product_status,
        proposedRecommendable:
          decision.kind === "exact_duplicate" || decision.kind === "renewal_suspect"
            ? false
            : row.recommendable,
      });
      matched = true;
      break;
    }
    if (!matched) accepted.push(row);
  }

  const summary = {
    phase: "catalog_dedupe_plan",
    linked,
    productionTouched: false,
    writeMode: "plan_only",
    candidateCount: rows.length,
    decisionCount: decisions.length,
    exactDuplicates: decisions.filter((d) => d.decision === "exact_duplicate").length,
    renewalSuspects: decisions.filter((d) => d.decision === "renewal_suspect").length,
    sizeVariants: decisions.filter((d) => d.decision === "same_product_different_size").length,
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "plan.json"), JSON.stringify({ summary, decisions }, null, 2));
  writeFileSync(
    path.join(root, "data", "catalog", "dedupe", "latest-plan.json"),
    JSON.stringify({ summary, decisions }, null, 2)
  );
  console.log(JSON.stringify(summary));
}

main();
