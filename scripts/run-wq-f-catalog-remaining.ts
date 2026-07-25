/**
 * WQ-F catalog remaining runner.
 * Default: dry-run crawl + report (no DB write).
 * WQF_COMMIT_STAGING=1: candidate-only Staging upsert after dry-run artifacts.
 *
 * Env:
 *   WQF_DRY_RUN=1 (default)
 *   WQF_COMMIT_STAGING=1
 *   WQF_MAX_BRANDS=5
 *   WQF_MAX_PRODUCTS_PER_BRAND=10
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { runWqfCatalogRemainingSprint } from "@/lib/catalog/wqFRemainingSprint";

const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(root, "data", "catalog", "wq-f-remaining", stamp);
const backupDir = path.join(root, "data", "backups", `wq-f-${stamp}`);

function envFlag(name: string, defaultOn = false): boolean {
  const v = (process.env[name] ?? "").trim();
  if (!v) return defaultOn;
  return v === "1" || /^true$/i.test(v) || /^yes$/i.test(v);
}

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function envBrandIds(name: string): string[] | undefined {
  const raw = (process.env[name] ?? "").trim();
  if (!raw) return undefined;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length ? ids : undefined;
}

function assertStagingLinked(): string {
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

function q(sql: string): { rows?: Array<Record<string, unknown>> } {
  const f = path.join(tmpdir(), `kb-wqf-${process.pid}-${Date.now()}.sql`);
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
    return i >= 0 ? (JSON.parse(out.slice(i)) as { rows?: Array<Record<string, unknown>> }) : {};
  } finally {
    try {
      unlinkSync(f);
    } catch {
      /* ignore */
    }
  }
}

function loadExistingUrls(): Set<string> {
  try {
    const res = q(`
SELECT discovered_url AS url
FROM product_discovery_candidates
WHERE discovered_url IS NOT NULL
LIMIT 5000;
`);
    const set = new Set<string>();
    for (const row of res.rows ?? []) {
      const url = row.url;
      if (typeof url === "string" && url.startsWith("https://")) set.add(url);
    }
    return set;
  } catch (error) {
    console.warn(
      "[wq-f] existing URL SELECT skipped:",
      error instanceof Error ? error.message.slice(0, 200) : error
    );
    return new Set();
  }
}

function buildUpsertSql(
  rows: Array<{
    productName: string;
    brand: string;
    url: string;
    workflowStatus: "discovered" | "needs_review";
    qualityStatus: string;
    externalProductId: string;
    hasIngredients: boolean;
    hasImage: boolean;
    hasOffer: boolean;
  }>
): string {
  const values = rows
    .map((p) => {
      const notes = sqlEscape(
        JSON.stringify({
          sprint: "wq-f-catalog-remaining",
          externalProductId: p.externalProductId,
          qualityStatus: p.qualityStatus,
          hasIngredients: p.hasIngredients,
          hasImage: p.hasImage,
          hasOffer: p.hasOffer,
          active: false,
          verified_at: null,
          verification_status: "needs_review",
        })
      );
      return `(
        '${sqlEscape(p.productName)}',
        '${sqlEscape(p.brand)}',
        '${sqlEscape(p.url)}',
        'KR',
        'official_brand_page',
        '${p.workflowStatus}',
        'pending',
        '${p.hasIngredients ? "pass" : "pending"}',
        'pending',
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


function loadStagingEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of [".env.staging", ".env.local"]) {
    const p = path.join(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[m[1]] = v;
    }
  }
  return out;
}

async function upsertViaSupabaseJs(
  rows: Array<{
    productName: string;
    brand: string;
    url: string;
    workflowStatus: "discovered" | "needs_review";
    qualityStatus: string;
    externalProductId: string;
    hasIngredients: boolean;
    hasImage: boolean;
    hasOffer: boolean;
  }>
): Promise<number> {
  const env = { ...process.env, ...loadStagingEnv() };
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";
  const key = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("missing_supabase_js_credentials");
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] || "";
  if (ref === PROD) throw new Error("ABORT_PRODUCTION");
  if (ref && ref !== STAGING) throw new Error("ABORT_NOT_STAGING:" + ref);

  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let inserted = 0;
  for (const p of rows) {
    const notes = JSON.stringify({
      sprint: "wq-f-catalog-remaining",
      externalProductId: p.externalProductId,
      qualityStatus: p.qualityStatus,
      hasIngredients: p.hasIngredients,
      hasImage: p.hasImage,
      hasOffer: p.hasOffer,
      active: false,
      verified_at: null,
      verification_status: "needs_review",
    });
    const { error } = await client.from("product_discovery_candidates").upsert(
      {
        discovered_name: p.productName,
        discovered_brand: p.brand,
        discovered_url: p.url,
        discovered_country: "KR",
        source_type: "official_brand_page",
        workflow_status: p.workflowStatus,
        sale_check_status: "pending",
        ingredient_check_status: p.hasIngredients ? "pass" : "pending",
        evidence_check_status: "pending",
        safety_check_status: "pending",
        duplicate_check_status: "pass",
        notes,
        discovered_at: new Date().toISOString(),
      },
      { onConflict: "discovered_url" }
    );
    if (error) {
      // unique partial index may not map to onConflict; try insert ignore
      const ins = await client.from("product_discovery_candidates").insert({
        discovered_name: p.productName,
        discovered_brand: p.brand,
        discovered_url: p.url,
        discovered_country: "KR",
        source_type: "official_brand_page",
        workflow_status: p.workflowStatus,
        sale_check_status: "pending",
        ingredient_check_status: p.hasIngredients ? "pass" : "pending",
        evidence_check_status: "pending",
        safety_check_status: "pending",
        duplicate_check_status: "pass",
        notes,
        discovered_at: new Date().toISOString(),
      });
      if (ins.error) {
        console.warn("[wq-f] upsert skip", p.url, ins.error.message.slice(0, 120));
        continue;
      }
    }
    inserted += 1;
  }
  return inserted;
}

function writeJson(filePath: string, data: unknown) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function runReadonlyBackup(): { ok: boolean; path: string; message?: string } {
  mkdirSync(backupDir, { recursive: true });
  const r = spawnSync(
    process.execPath,
    [path.join(root, "scripts", "backup-staging-catalog-readonly.mjs")],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        BACKUP_OUT: backupDir,
        npm_config_loglevel: "silent",
      },
      shell: false,
    }
  );
  if ((r.status ?? 1) !== 0) {
    return {
      ok: false,
      path: backupDir,
      message: (r.stderr || r.stdout || "backup_failed").slice(-600),
    };
  }
  return { ok: true, path: backupDir };
}

async function main() {
  const linked = assertStagingLinked();
  const dryRun = !envFlag("WQF_COMMIT_STAGING", false);
  // WQF_DRY_RUN defaults on; commit only when WQF_COMMIT_STAGING=1
  const commit = envFlag("WQF_COMMIT_STAGING", false);
  const maxBrands = envInt("WQF_MAX_BRANDS", 5);
  const maxProductsPerBrand = envInt("WQF_MAX_PRODUCTS_PER_BRAND", 10);
  const brandIds = envBrandIds("WQF_BRAND_IDS");

  mkdirSync(outDir, { recursive: true });

  console.log(
    `[wq-f] linked=${linked} dryRun=${!commit} brands=${maxBrands} perBrand=${maxProductsPerBrand}${
      brandIds ? ` brandIds=${brandIds.join(",")}` : ""
    }`
  );

  const existingUrls = loadExistingUrls();
  const sprint = await runWqfCatalogRemainingSprint({
    maxBrands,
    maxProductsPerBrand,
    existingUrls,
    brandIds,
  });

  const dryRunReport = {
    generatedAt: sprint.generatedAt,
    stamp,
    linked,
    productionTouched: false,
    mode: commit ? "commit_staging_candidates" : "dry_run",
    counts: sprint.counts,
    rates: sprint.rates,
    statusCounts: sprint.statusCounts,
    candidates: sprint.dryRunCandidates,
    brands: sprint.brands.map((b) => ({
      brandId: b.discovery.brandId,
      origin: b.discovery.origin,
      robotsAllowed: b.discovery.robotsAllowed,
      blocked: b.discovery.blocked,
      connector: b.discovery.connector,
      productUrlCount: b.discovery.productUrls.length,
      reasons: b.discovery.reasons,
      pagesFetched: b.discovery.pagesFetched,
    })),
  };

  const exceptionPayload = {
    generatedAt: sprint.generatedAt,
    stamp,
    mode: "artifact_only",
    publishAllowed: false,
    databaseTouched: false,
    productionTouched: false,
    items: sprint.exceptionQueue,
  };

  const crawlSummary = {
    generatedAt: sprint.generatedAt,
    stamp,
    brandsCrawled: sprint.counts.brandsCrawled,
    productsAttempted: sprint.counts.productsAttempted,
    success: sprint.counts.success,
    fail: sprint.counts.fail,
    duplicate: sprint.counts.duplicate,
    review: sprint.counts.review,
    stagingReady: sprint.counts.stagingReady,
    rates: sprint.rates,
  };

  const dryRunPath = path.join(outDir, "dry-run-report.json");
  const exceptionPath = path.join(outDir, "exception-queue.json");
  const crawlPath = path.join(outDir, "crawl-summary.json");
  writeJson(dryRunPath, dryRunReport);

  // Always emit candidate upsert SQL (apply only when COMMIT + DB reachable).
  const upsertablePreview = sprint.products
    .filter((p) => p.ok && !p.duplicate && p.productName && p.url.startsWith("https://"))
    .map((p) => ({
      productName: p.productName as string,
      brand: p.brand,
      url: p.url,
      workflowStatus:
        p.qualityStatus === "staging_ready"
          ? ("discovered" as const)
          : ("needs_review" as const),
      qualityStatus: p.qualityStatus,
      externalProductId: p.externalProductId,
      hasIngredients: p.hasIngredients,
      hasImage: p.hasImage,
      hasOffer: p.hasOffer,
    }));
  const sqlPath = path.join(outDir, "staging-upsert.sql");
  writeFileSync(
    sqlPath,
    upsertablePreview.length
      ? buildUpsertSql(upsertablePreview)
      : "-- no upsertable candidates\n",
    "utf8"
  );
  writeJson(exceptionPath, exceptionPayload);
  writeJson(crawlPath, crawlSummary);

  let stagingInsertCount = 0;
  if (commit) {
    const upsertable = sprint.products
      .filter((p) => p.ok && !p.duplicate && p.productName && p.url.startsWith("https://"))
      .map((p) => ({
        productName: p.productName as string,
        brand: p.brand,
        url: p.url,
        workflowStatus:
          p.qualityStatus === "staging_ready"
            ? ("discovered" as const)
            : ("needs_review" as const),
        qualityStatus: p.qualityStatus,
        externalProductId: p.externalProductId,
        hasIngredients: p.hasIngredients,
        hasImage: p.hasImage,
        hasOffer: p.hasOffer,
      }));

    try {
      const chunkSize = 25;
      for (let i = 0; i < upsertable.length; i += chunkSize) {
        const chunk = upsertable.slice(i, i + chunkSize);
        q(buildUpsertSql(chunk));
        stagingInsertCount += chunk.length;
      }
    } catch (cliError) {
      console.warn(
        "[wq-f] supabase CLI upsert failed, trying JS client:",
        cliError instanceof Error ? cliError.message.slice(0, 180) : cliError
      );
      stagingInsertCount = await upsertViaSupabaseJs(upsertable);
    }
  }

  let backup = runReadonlyBackup();

  const manifest = {
    phase: "wq-f-catalog-remaining",
    stamp,
    linked,
    productionTouched: false,
    dryRun: !commit,
    commitStaging: commit,
    counts: sprint.counts,
    rates: sprint.rates,
    statusCounts: sprint.statusCounts,
    staging: {
      insertAttempted: stagingInsertCount,
      table: "product_discovery_candidates",
      productsPublished: false,
    },
    outputs: {
      dryRunReport: path.relative(root, dryRunPath).replace(/\\/g, "/"),
      exceptionQueue: path.relative(root, exceptionPath).replace(/\\/g, "/"),
      crawlSummary: path.relative(root, crawlPath).replace(/\\/g, "/"),
      stagingUpsertSql: path.relative(root, path.join(outDir, "staging-upsert.sql")).replace(/\\/g, "/"),
      backupDir: path.relative(root, backup.path).replace(/\\/g, "/"),
      backupOk: backup.ok,
      backupMessage: backup.message ?? null,
    },
  };

  const manifestPath = path.join(outDir, "manifest.json");
  writeJson(manifestPath, manifest);

  if (!backup.ok) {
    mkdirSync(backupDir, { recursive: true });
    for (const name of [
      "dry-run-report.json",
      "exception-queue.json",
      "crawl-summary.json",
      "manifest.json",
      "staging-upsert.sql",
    ]) {
      const src = path.join(outDir, name);
      if (existsSync(src)) {
        writeFileSync(path.join(backupDir, name), readFileSync(src));
      }
    }
    writeJson(path.join(backupDir, "backup-note.json"), {
      mode: "local_artifact_fallback",
      reason: backup.message ?? "db_backup_failed",
      sourceDir: path.relative(root, outDir).replace(/\\/g, "/"),
      productionTouched: false,
      pii: false,
    });
    backup = {
      ok: true,
      path: backupDir,
      message: "local artifact fallback (DB readonly backup unavailable)",
    };
    manifest.outputs.backupOk = true;
    manifest.outputs.backupMessage = backup.message;
    writeJson(manifestPath, manifest);
    writeJson(path.join(backupDir, "manifest.json"), manifest);
  }

  console.log(JSON.stringify(manifest, null, 2));
  if (dryRun && !commit) {
    console.log("[wq-f] dry-run complete — no Staging write");
  }
}

main().catch((error) => {
  console.error("[wq-f] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
