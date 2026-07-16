#!/usr/bin/env node
/**
 * Apply Staging service_role grant migration (file), verify grants, run HTTP-path test.
 * Aborts if linked project is Production. Never prints secrets / full refs.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { writeFileSync, unlinkSync } from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = "rhfrmvkjsummaylpzmns";
const EXPECTED = "jfnjufmldiqlgvgyugfd";
const MIGRATION = path.join(
  root,
  "supabase/migrations/20260714050000_grant_service_role_admin_product_create.sql"
);

function mask(ref) {
  return ref.length <= 8
    ? `${ref.slice(0, 2)}***`
    : `${ref.slice(0, 4)}***${ref.slice(-3)}`;
}

function linkedRef() {
  return readFileSync(
    path.join(root, "supabase", ".temp", "project-ref"),
    "utf8"
  ).trim();
}

function npx() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function dbFile(sqlText) {
  const f = path.join(tmpdir(), `kb-grant-${process.pid}-${Date.now()}.sql`);
  const out = path.join(tmpdir(), `kb-grant-${process.pid}-${Date.now()}.out`);
  const err = path.join(tmpdir(), `kb-grant-${process.pid}-${Date.now()}.err`);
  writeFileSync(f, sqlText, "utf8");
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
  // Prefer spawn stdout; also support redirected if empty
  let raw = (r.stdout || "").trim();
  if (!raw) {
    const r2 = spawnSync(
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
      { cwd: root, shell: false }
    );
    if (existsSync(out)) raw = readFileSync(out, "utf8");
    try {
      unlinkSync(out);
      unlinkSync(err);
    } catch {
      /* ignore */
    }
    if (!raw && r2.status) throw new Error(`db query failed status=${r2.status}`);
  }
  try {
    unlinkSync(f);
  } catch {
    /* ignore */
  }
  if (r.status && r.status !== 0 && !raw) {
    throw new Error(`db query failed status=${r.status}`);
  }
  return raw;
}

function getStagingServiceRole(ref) {
  if (ref === PROD) throw new Error("ABORT Production");
  const r = spawnSync(
    npx(),
    [
      "supabase",
      "projects",
      "api-keys",
      "--project-ref",
      ref,
      "--reveal",
      "-o",
      "json",
    ],
    {
      cwd: root,
      encoding: "utf8",
      shell: true,
      env: { ...process.env, npm_config_loglevel: "silent" },
    }
  );
  let raw = (r.stdout || "").trim();
  if (!raw) {
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
    raw = readFileSync(outFile, "utf8").trim();
    try {
      unlinkSync(outFile);
    } catch {
      /* ignore */
    }
  }
  const keys = JSON.parse(raw);
  for (const k of keys) {
    const id = String(k.id ?? "");
    const name = String(k.name ?? "");
    const val = k.api_key ?? k.key;
    if ((id === "service_role" || name === "service_role") && val) return String(val);
  }
  throw new Error("service_role missing");
}

const ref = linkedRef();
console.log(`[grant] linked_masked=${mask(ref)} is_prod=${ref === PROD}`);
if (ref !== EXPECTED || ref === PROD) {
  console.error("[grant] refused: not expected staging");
  process.exit(1);
}

if (!existsSync(MIGRATION)) {
  console.error("[grant] migration file missing");
  process.exit(1);
}

console.log("[grant] read_grants_before");
const before = dbFile(`
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema='public' and grantee='service_role'
  and table_name in ('products','ingredients','product_ingredients','catalog_product_media')
  and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')
order by table_name, privilege_type;
`);
console.log("[grant] before=", before.replace(/\s+/g, " ").slice(0, 800));

console.log("[grant] apply_migration_file");
const applyOut = dbFile(readFileSync(MIGRATION, "utf8"));
console.log("[grant] apply_out=", applyOut.replace(/\s+/g, " ").slice(0, 400));

const after = dbFile(`
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema='public' and grantee='service_role'
  and table_name in ('products','ingredients','product_ingredients','catalog_product_media')
  and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')
order by table_name, privilege_type;
`);
console.log("[grant] after=", after.replace(/\s+/g, " ").slice(0, 1000));

const anonCheck = dbFile(`
select count(*)::int as dml_changed_attempt_scope
from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated')
  and table_name in ('products','ingredients','product_ingredients','catalog_product_media')
  and privilege_type in ('INSERT','UPDATE','DELETE');
`);
console.log("[grant] anon_auth_dml_count=", anonCheck.replace(/\s+/g, " ").slice(0, 300));

const serviceRole = getStagingServiceRole(ref);
console.log(`[grant] service_ready len=${serviceRole.length}`);

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
const entry = path.join(
  root,
  "scripts",
  "http-api-admin-product-verify-staging.ts"
);

const result = spawnSync(
  process.execPath,
  ["--import", register, "--import", tsxLoader, entry],
  { cwd: root, stdio: "inherit", env, shell: false }
);

process.exit(result.status ?? 1);
