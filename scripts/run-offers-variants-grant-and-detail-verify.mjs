#!/usr/bin/env node
/**
 * Apply product_offers/product_variants SELECT grants on Staging and verify
 * getAdminProductDetail(productId=3). No secrets/refs printed.
 */
import { spawnSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = "rhfrmvkjsummaylpzmns";
const EXPECTED = "jfnjufmldiqlgvgyugfd";
const MIGRATION = path.join(
  root,
  "supabase/migrations/20260714052000_grant_service_role_select_offers_variants.sql"
);

function npx() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function linkedRef() {
  return readFileSync(
    path.join(root, "supabase", ".temp", "project-ref"),
    "utf8"
  ).trim();
}

function dbFile(sqlText) {
  const f = path.join(tmpdir(), `kb-ov-${process.pid}-${Date.now()}.sql`);
  writeFileSync(f, sqlText.trim() + "\n", "utf8");
  try {
    const r = spawnSync(
      npx(),
      ["supabase", "db", "query", "--linked", "--file", f],
      {
        cwd: root,
        encoding: "utf8",
        shell: true,
        env: { ...process.env, npm_config_loglevel: "silent" },
      }
    );
    let raw = (r.stdout || "").trim();
    if (!raw) {
      const out = path.join(tmpdir(), `kb-ov-out-${process.pid}.out`);
      const err = path.join(tmpdir(), `kb-ov-err-${process.pid}.err`);
      spawnSync(
        process.platform === "win32" ? "cmd.exe" : "sh",
        process.platform === "win32"
          ? [
              "/c",
              `${npx()} supabase db query --linked --file "${f}" 1>"${out}" 2>"${err}"`,
            ]
          : [
              "-c",
              `${npx()} supabase db query --linked --file "${f}" > "${out}" 2> "${err}"`,
            ],
        { cwd: root }
      );
      if (existsSync(out)) raw = readFileSync(out, "utf8");
      try {
        unlinkSync(out);
        unlinkSync(err);
      } catch {
        /* ignore */
      }
    }
    if (!raw) throw new Error(`db query failed status=${r.status}`);
    return raw;
  } finally {
    try {
      unlinkSync(f);
    } catch {
      /* ignore */
    }
  }
}

function getStagingServiceRole(ref) {
  if (ref === PROD) throw new Error("ABORT Production");
  const outFile = path.join(tmpdir(), `kb-keys-${process.pid}.json`);
  spawnSync(
    process.platform === "win32" ? "cmd.exe" : "sh",
    process.platform === "win32"
      ? [
          "/c",
          `${npx()} supabase projects api-keys --project-ref ${ref} --reveal -o json 1>${outFile} 2>nul`,
        ]
      : [
          "-c",
          `${npx()} supabase projects api-keys --project-ref ${ref} --reveal -o json > "${outFile}" 2>/dev/null`,
        ],
    { cwd: root }
  );
  const raw = readFileSync(outFile, "utf8").trim();
  try {
    unlinkSync(outFile);
  } catch {
    /* ignore */
  }
  const keys = JSON.parse(raw);
  for (const k of keys) {
    const id = String(k.id ?? "");
    const name = String(k.name ?? "");
    const val = k.api_key ?? k.key;
    if ((id === "service_role" || name === "service_role") && val) {
      return String(val);
    }
  }
  throw new Error("service_role missing");
}

const ref = linkedRef();
if (ref === PROD || ref !== EXPECTED) {
  console.error("[ov-grant] ABORT unexpected_or_production");
  process.exit(2);
}
console.log("[ov-grant] production_block=ok");

dbFile(readFileSync(MIGRATION, "utf8"));
const verify = dbFile(`
select
  has_table_privilege('service_role','public.product_offers','SELECT') as offers_select,
  has_table_privilege('service_role','public.product_variants','SELECT') as variants_select,
  has_table_privilege('service_role','public.product_offers','INSERT') as offers_insert,
  has_table_privilege('service_role','public.product_variants','INSERT') as variants_insert,
  has_table_privilege('service_role','public.product_offers','DELETE') as offers_delete,
  has_table_privilege('service_role','public.product_variants','DELETE') as variants_delete;
`);
console.log("[ov-grant] verify=", verify.replace(/\s+/g, " ").slice(0, 700));

const serviceRole = getStagingServiceRole(ref);
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  SUPABASE_SERVICE_ROLE_KEY: serviceRole,
  SUPABASE_PROJECT_REF: ref,
  APP_ENV: "preview",
  CATALOG_DATABASE_ENV: "staging",
  PRODUCTION_SUPABASE_PROJECT_REF: PROD,
  npm_config_loglevel: "silent",
};
delete env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

const require = createRequire(import.meta.url);
const tsxEntry = require.resolve("tsx/esm");
const register = pathToFileURL(
  path.join(root, "scripts", "register-server-only.mjs")
).href;
const tsxLoader = pathToFileURL(tsxEntry).href;
const entry = path.join(root, "scripts", "verify-admin-product-detail-staging.ts");

writeFileSync(
  entry,
  `
import { getAdminProductDetail } from "@/lib/admin/product-detail";
import { assertStagingCatalogWriteAllowed } from "@/lib/admin/stagingWriteGate";
import { KNOWN_PRODUCTION_SUPABASE_REF } from "@/lib/catalog/automation/ingestionGate";

async function main() {
  const ref = (process.env.SUPABASE_PROJECT_REF || "").trim();
  if (!ref || ref === KNOWN_PRODUCTION_SUPABASE_REF) throw new Error("ABORT");
  const gate = assertStagingCatalogWriteAllowed();
  if (!gate.ok) throw new Error(gate.code);
  const detail = await getAdminProductDetail(3);
  if (!detail) throw new Error("product_3_missing");
  const img = detail.primaryMedia?.imageUrl ?? null;
  console.log("[detail] ok=", JSON.stringify({
    name: detail.product.name,
    brand: detail.product.brand,
    fullLen: detail.product.fullIngredients?.length ?? 0,
    keyLen: detail.product.keyIngredients?.length ?? 0,
    keyIngredients: detail.product.keyIngredients ?? [],
    ingredientLinks: detail.ingredients?.length ?? 0,
    offers: detail.offers?.length ?? 0,
    variants: detail.variants?.length ?? 0,
    hasMedia: Boolean(detail.primaryMedia),
    imageHttps: Boolean(img?.startsWith("https://")),
    imageSigned: Boolean(img && /\\/object\\/sign\\//.test(img)),
  }));
}
main().catch((e) => { console.error("[detail] failed", e instanceof Error ? e.message : e); process.exit(1); });
`,
  "utf8"
);

const result = spawnSync(
  process.execPath,
  ["--import", register, "--import", tsxLoader, entry],
  { cwd: root, stdio: "inherit", env, shell: false }
);

try {
  unlinkSync(entry);
} catch {
  /* ignore */
}

process.exit(result.status ?? 1);
