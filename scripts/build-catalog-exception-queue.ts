import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildCatalogExceptionQueue,
  deriveCatalogExceptionsFromStagingRows,
  type CatalogExceptionStagingRow,
} from "@/lib/catalog/automation/exceptionQueue";

const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(root, "data", "catalog", "exceptions", stamp);

function assertStagingLinked(): string {
  const refPath = path.join(root, "supabase", ".temp", "project-ref");
  if (!existsSync(refPath)) throw new Error("missing supabase/.temp/project-ref");
  const linked = readFileSync(refPath, "utf8").trim();
  if (linked === PROD) throw new Error("ABORT_PRODUCTION");
  if (linked !== STAGING) throw new Error(`ABORT_NOT_STAGING:${linked}`);
  return linked;
}

function queryRows(): CatalogExceptionStagingRow[] {
  mkdirSync(outDir, { recursive: true });
  const sqlPath = path.join(outDir, "read-exception-candidates.sql");
  writeFileSync(
    sqlPath,
    `
SELECT external_product_id,
       brand_canonical,
       product_name_raw,
       official_product_url,
       match_class,
       enrichment_reasons,
       ingredients_status,
       primary_image_url,
       image_status,
       COALESCE(product_attributes, '{}'::jsonb) AS product_attributes
FROM catalog_staging_products
WHERE product_status <> 'rejected'
ORDER BY brand_canonical, external_product_id;
`,
    "utf8"
  );

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
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) {
    throw new Error((result.stderr || output).slice(-1200));
  }
  const start = output.indexOf("{");
  const parsed = start >= 0 ? JSON.parse(output.slice(start)) : {};
  return Array.isArray(parsed.rows) ? parsed.rows : [];
}

function main(): void {
  const linked = assertStagingLinked();
  const rows = queryRows();
  const queue = buildCatalogExceptionQueue(
    deriveCatalogExceptionsFromStagingRows(rows)
  );
  const summary = {
    phase: "catalog_exception_queue",
    linked,
    productionTouched: false,
    writeMode: "artifact_only",
    productCount: rows.length,
    exceptionCount: queue.length,
    byPriority: {
      critical: queue.filter((item) => item.priority === "critical").length,
      high: queue.filter((item) => item.priority === "high").length,
      medium: queue.filter((item) => item.priority === "medium").length,
      low: queue.filter((item) => item.priority === "low").length,
    },
    byGroup: {
      identity: queue.filter((item) => item.reviewGroup === "identity").length,
      source: queue.filter((item) => item.reviewGroup === "source").length,
      content: queue.filter((item) => item.reviewGroup === "content").length,
      commerce: queue.filter((item) => item.reviewGroup === "commerce").length,
    },
  };

  const artifact = { summary, queue };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "queue.json"), JSON.stringify(artifact, null, 2));
  const latestDir = path.join(root, "data", "catalog", "exceptions");
  mkdirSync(latestDir, { recursive: true });
  writeFileSync(path.join(latestDir, "latest-queue.json"), JSON.stringify(artifact, null, 2));
  console.log(JSON.stringify(summary));
}

main();
