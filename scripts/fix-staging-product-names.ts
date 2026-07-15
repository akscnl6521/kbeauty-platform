/**
 * Fix garbled product_name_en on Staging heroes when product_name_raw is Latin-heavy.
 * Staging linked only. npm run catalog:fix-staging-names
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const STAGING = "jfnjufmldiqlgvgyugfd";
const PROD = "rhfrmvkjsummaylpzmns";
const SPRINT = "full-beauty-20260714";
const root = process.cwd();

function assertStaging() {
  const linked = readFileSync(
    path.join(root, "supabase/.temp/project-ref"),
    "utf8"
  ).trim();
  if (linked === PROD) throw new Error("ABORT_PRODUCTION");
  if (linked !== STAGING) throw new Error(`ABORT_NOT_STAGING:${linked}`);
  return linked;
}

function q(label: string, sql: string) {
  const dir = path.join(root, "data/catalog/labels/_tmp");
  mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${label}.sql`);
  writeFileSync(f, sql, "utf8");
  const r = spawnSync(
    "npx.cmd",
    ["supabase", "db", "query", "--linked", "--file", f, "-o", "json"],
    {
      cwd: root,
      encoding: "utf8",
      shell: true,
      env: { ...process.env, npm_config_loglevel: "silent" },
      timeout: 120000,
    }
  );
  const out = r.stdout || "";
  if ((r.status ?? 1) !== 0) throw new Error(`${label}: ${(r.stderr || out).slice(-800)}`);
  const i = out.indexOf("{");
  return i >= 0 ? JSON.parse(out.slice(i)) : {};
}

function main() {
  const linked = assertStaging();
  const before = q(
    "01-count",
    `
SELECT count(*)::int AS garbled
FROM catalog_staging_products
WHERE sprint_tag='${SPRINT}'
  AND product_status <> 'rejected'
  AND product_name_raw ~ '[A-Za-z]{4}'
  AND (
    product_name_en IS NULL
    OR product_name_en ~ '[가-힣]'
    OR product_name_en LIKE '%?%'
    OR length(regexp_replace(coalesce(product_name_en,''), '[^A-Za-z]', '', 'g'))
      < length(regexp_replace(product_name_raw, '[^A-Za-z]', '', 'g')) / 2
  );
`
  );

  q(
    "10-fix",
    `
UPDATE catalog_staging_products
SET product_name_en = product_name_raw,
    updated_at = now()
WHERE sprint_tag='${SPRINT}'
  AND product_status <> 'rejected'
  AND product_name_raw ~ '[A-Za-z]{4}'
  AND (
    product_name_en IS NULL
    OR product_name_en ~ '[가-힣]'
    OR product_name_en LIKE '%?%'
    OR length(regexp_replace(coalesce(product_name_en,''), '[^A-Za-z]', '', 'g'))
      < length(regexp_replace(product_name_raw, '[^A-Za-z]', '', 'g')) / 2
  );
`
  );

  const after = q(
    "90-count",
    `
SELECT count(*)::int AS still_garbled
FROM catalog_staging_products
WHERE sprint_tag='${SPRINT}'
  AND product_status <> 'rejected'
  AND product_name_raw ~ '[A-Za-z]{4}'
  AND (
    product_name_en IS NULL
    OR product_name_en ~ '[가-힣]'
    OR product_name_en LIKE '%?%'
  );
`
  );

  console.log(
    JSON.stringify({
      phase: "fix_staging_product_names",
      linked,
      productionTouched: false,
      garbledBefore: before.rows?.[0]?.garbled ?? null,
      stillGarbledAfter: after.rows?.[0]?.still_garbled ?? null,
    })
  );
}

main();
