#!/usr/bin/env node
/**
 * Apply ingredient_aliases SELECT grant on Staging, re-verify, run HTTP-path E2E.
 * No Production applies. Does not print project refs or secrets.
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
  "supabase/migrations/20260714051000_grant_service_role_select_ingredient_aliases.sql"
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
  const f = path.join(tmpdir(), `kb-alias-${process.pid}-${Date.now()}.sql`);
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
      const out = path.join(tmpdir(), `kb-alias-out-${process.pid}.out`);
      const err = path.join(tmpdir(), `kb-alias-err-${process.pid}.err`);
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
if (ref === PROD) {
  console.error("[alias-grant] ABORT production_linked");
  process.exit(2);
}
if (ref !== EXPECTED) {
  console.error("[alias-grant] ABORT unexpected_project");
  process.exit(2);
}
console.log("[alias-grant] production_block=ok");

if (!existsSync(MIGRATION)) {
  console.error("[alias-grant] migration missing");
  process.exit(1);
}

console.log("[alias-grant] apply");
dbFile(readFileSync(MIGRATION, "utf8"));

const verify = dbFile(`
select
  exists (
    select 1 from information_schema.role_table_grants
    where table_schema='public' and table_name='ingredient_aliases'
      and grantee='service_role' and privilege_type='SELECT'
  ) as grant_row_exists,
  has_table_privilege('service_role', 'public.ingredient_aliases', 'SELECT') as has_select,
  has_table_privilege('service_role', 'public.ingredient_aliases', 'INSERT') as has_insert,
  has_table_privilege('service_role', 'public.ingredient_aliases', 'UPDATE') as has_update,
  has_table_privilege('service_role', 'public.ingredient_aliases', 'DELETE') as has_delete;
`);
console.log("[alias-grant] verify=", verify.replace(/\s+/g, " ").slice(0, 600));

const serviceRole = getStagingServiceRole(ref);
console.log(
  `[alias-grant] service_role_ready=${Boolean(serviceRole)} len=${serviceRole.length}`
);

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  SUPABASE_SERVICE_ROLE_KEY: serviceRole,
  SUPABASE_PROJECT_REF: ref,
  APP_ENV: "preview",
  CATALOG_DATABASE_ENV: "staging",
  PRODUCTION_SUPABASE_PROJECT_REF: PROD,
  npm_config_loglevel: "silent",
  HTTP_API_NEW_NAME: `HTTP API Alias Probe ${Date.now()}`,
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
