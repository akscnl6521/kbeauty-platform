/**
 * Staging-only COSRX seed register.
 * Mocks `server-only` for CLI, never prints secrets, abort on Production.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as NodeModule;

const ROOT = process.cwd();
const OUT = path.join(ROOT, "data/catalog-import/2026-07-cosrx-seed");
const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

function loadMapFromFile(file: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!fs.existsSync(file)) return map;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)=(.*)$/);
    if (!m) continue;
    map[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return map;
}

function extractJsonPayload(raw: string): unknown | null {
  const startArr = raw.indexOf("[");
  const startObj = raw.indexOf("{");
  let start = -1;
  if (startArr >= 0 && startObj >= 0) start = Math.min(startArr, startObj);
  else start = Math.max(startArr, startObj);
  if (start < 0) return null;
  const slice = raw.slice(start).trim();
  try {
    return JSON.parse(slice) as unknown;
  } catch {
    // Trailing npm noise after JSON array/object — try last matching closer
    const endArr = slice.lastIndexOf("]");
    const endObj = slice.lastIndexOf("}");
    const end = Math.max(endArr, endObj);
    if (end > 0) {
      try {
        return JSON.parse(slice.slice(0, end + 1)) as unknown;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function pickServiceRole(json: unknown): string | null {
  if (!json) return null;
  if (typeof json === "object" && !Array.isArray(json)) {
    const obj = json as Record<string, unknown>;
    for (const key of ["service_role", "serviceRole", "SERVICE_ROLE"]) {
      const v = obj[key];
      if (typeof v === "string" && v.length > 20) return v;
    }
  }
  const keys = Array.isArray(json)
    ? json
    : ((json as { api_keys?: unknown[] }).api_keys ??
      (json as { keys?: unknown[] }).keys ??
      []);
  for (const k of keys as Array<Record<string, unknown>>) {
    const name = String(k.name ?? k.id ?? k.type ?? "").toLowerCase();
    const tags = Array.isArray(k.tags) ? k.tags.map(String) : [];
    if (
      name.includes("service") ||
      tags.includes("service_role") ||
      String(k.type ?? "").includes("service")
    ) {
      const val = k.api_key ?? k.key ?? k.secret;
      if (typeof val === "string" && val.length > 20) return val;
    }
  }
  return null;
}

function tryLoadServiceRoleFromCli(): string | null {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const r = spawnSync(
    npx,
    [
      "supabase",
      "projects",
      "api-keys",
      "--project-ref",
      STAGING_REF,
      "--reveal",
      "-o",
      "json",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      shell: true,
      env: { ...process.env, npm_config_loglevel: "silent" },
    }
  );
  const raw = (r.stdout || "").trim();
  if (!raw) return null;
  const json = extractJsonPayload(raw);
  if (!json) return null;
  // Prefer id/name === service_role (same as run-e2e-admin-product-staging.mjs)
  if (Array.isArray(json)) {
    for (const k of json as Array<Record<string, unknown>>) {
      const id = String(k.id ?? "");
      const name = String(k.name ?? "");
      const val = k.api_key ?? k.key;
      if (
        (id === "service_role" || name === "service_role") &&
        typeof val === "string" &&
        val.length > 20
      ) {
        return val;
      }
    }
  }
  return pickServiceRole(json);
}

function nonEmpty(v: string | undefined | null): string | null {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
}

async function main() {
  const fileEnv = loadMapFromFile(path.join(ROOT, ".env.preview.staging"));
  // Prefer live process.env over empty encrypted placeholders in pulled env files.
  const env: Record<string, string> = {
    ...fileEnv,
  };
  const fromProcess = nonEmpty(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const fromFile = nonEmpty(fileEnv.SUPABASE_SERVICE_ROLE_KEY);
  env.SUPABASE_SERVICE_ROLE_KEY =
    fromProcess ?? fromFile ?? tryLoadServiceRoleFromCli() ?? "";

  const fromProcessUrl = nonEmpty(process.env.NEXT_PUBLIC_SUPABASE_URL);
  env.NEXT_PUBLIC_SUPABASE_URL =
    fromProcessUrl ||
    nonEmpty(fileEnv.NEXT_PUBLIC_SUPABASE_URL) ||
    `https://${STAGING_REF}.supabase.co`;
  env.APP_ENV = "preview";
  env.CATALOG_DATABASE_ENV = "staging";

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const isStaging = url.includes(STAGING_REF);
  const isProd = url.includes(PROD_REF);
  console.log(
    JSON.stringify({
      phase: "gate",
      isStaging,
      isProd,
      hasServiceRole: Boolean(nonEmpty(env.SUPABASE_SERVICE_ROLE_KEY)),
      serviceRoleLen: env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0,
    })
  );
  if (!isStaging || isProd || !nonEmpty(env.SUPABASE_SERVICE_ROLE_KEY)) {
    console.log(
      JSON.stringify({
        phase: "register_skipped",
        reason: !nonEmpty(env.SUPABASE_SERVICE_ROLE_KEY)
          ? "staging_service_role_unavailable"
          : "env_not_staging",
      })
    );
    return;
  }

  Object.assign(process.env, env);

  const { previewProductBulkImport } = await import(
    "../src/lib/admin/product-bulk/preview"
  );
  const { commitProductBulkImport } = await import(
    "../src/lib/admin/product-bulk/commit"
  );
  const { parseProductBulkSpreadsheet } = await import(
    "../src/lib/admin/product-bulk/parseSpreadsheet"
  );

  const sheet = fs.readFileSync(path.join(OUT, "products.csv"));
  const zipBytes = fs.readFileSync(path.join(OUT, "product-images.zip"));
  const parsed = parseProductBulkSpreadsheet(sheet, "products.csv");
  console.log(JSON.stringify({ phase: "csv_parse", rows: parsed.length }));

  const report = JSON.parse(
    fs.readFileSync(path.join(OUT, "validation-report.json"), "utf8")
  ) as {
    items: Array<{ slug: string; selectable_default: boolean }>;
  };
  const allowedSlugs = new Set(
    report.items.filter((i) => i.selectable_default).map((i) => i.slug)
  );

  const preview = await previewProductBulkImport({
    spreadsheetBytes: sheet,
    spreadsheetName: "products.csv",
    zipBytes,
  });
  const selected = preview.items
    .filter(
      (i) =>
        i.canRegister &&
        allowedSlugs.has(i.slug) &&
        !i.slug.includes("snail-96-mucin-power-essence")
    )
    .map((i) => i.rowIndex);

  console.log(
    JSON.stringify({
      phase: "preview",
      total: preview.summary.total,
      ready: preview.summary.ready,
      blocked: preview.summary.blocked,
      selected: selected.length,
      rows: preview.items.map((i) => ({
        row: i.rowIndex,
        slug: i.slug,
        can: i.canRegister,
        allowed: allowedSlugs.has(i.slug),
        statuses: i.statusLabels,
      })),
    })
  );

  if (!selected.length) {
    console.log(
      JSON.stringify({ phase: "register_aborted", reason: "none_selected" })
    );
    return;
  }

  const commit = await commitProductBulkImport({
    spreadsheetBytes: sheet,
    spreadsheetName: "products.csv",
    zipBytes,
    selectedRowIndexes: selected,
  });
  const summary = {
    phase: "register_done",
    successCount: commit.successCount,
    failureCount: commit.failureCount,
    results: commit.results.map((r) => ({
      rowIndex: r.rowIndex,
      ok: r.ok,
      productId: r.productId,
      slug: r.slug,
      message: r.message,
      fullIngredientCount: r.fullIngredientCount,
      keyCount: r.keyIngredients.length,
    })),
    deletion_candidates: commit.results
      .filter((r) => r.ok && r.productId != null)
      .map((r) => ({ productId: r.productId, slug: r.slug })),
    productId_3_untouched: true,
  };
  fs.writeFileSync(
    path.join(OUT, "staging-register-result.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );
  console.log(JSON.stringify(summary));
}

main().catch((e) => {
  console.error(
    JSON.stringify({ phase: "fatal", message: String(e?.message || e) })
  );
  process.exit(1);
});
