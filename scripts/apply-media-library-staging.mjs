#!/usr/bin/env node
/**
 * Apply the §36.4 media asset library migration to Staging only.
 * Gate first, then CLI apply, then hand off to the read-only verify.
 *
 * If the Supabase CLI cannot reach the database (this workstation's network is
 * IPv4-only and the direct host is IPv6), the script stops and prints the
 * Dashboard SQL Editor fallback instead of pretending it applied anything.
 *
 * Never prints secrets or full project refs. Never DELETEs.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD_REF = "rhfrmvkjsummaylpzmns";
const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const MIGRATION_REL =
  "supabase/migrations/20260727120000_create_media_asset_library.sql";
const MIGRATION = path.join(root, MIGRATION_REL);

function fail(msg) {
  console.error(`[apply:media-library] FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`[apply:media-library] OK: ${msg}`);
}

function maskRef(ref) {
  if (!ref || ref.length < 8) return "***";
  return `${ref.slice(0, 4)}***${ref.slice(-3)}`;
}

function npx() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function loadEnvFile(name) {
  const p = path.join(root, name);
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

/**
 * The CLI needs SUPABASE_ACCESS_TOKEN in the environment. Square brackets are
 * stripped because a token pasted as "[sbp_…]" is otherwise rejected with an
 * unhelpful format error — the brackets are never part of the token.
 */
function withAccessToken(env) {
  const raw = (env.SUPABASE_ACCESS_TOKEN ?? process.env.SUPABASE_ACCESS_TOKEN ?? "")
    .trim()
    .replace(/^\[/, "")
    .replace(/\]$/, "");
  if (!raw) return { ...process.env, npm_config_loglevel: "silent" };
  return {
    ...process.env,
    SUPABASE_ACCESS_TOKEN: raw,
    npm_config_loglevel: "silent",
  };
}

function resolveLinkedRef() {
  const refFile = path.join(root, "supabase", ".temp", "project-ref");
  if (existsSync(refFile)) return readFileSync(refFile, "utf8").trim();
  for (const name of [".env.staging", ".env.local"]) {
    const env = loadEnvFile(name);
    if (env.SUPABASE_PROJECT_REF) return env.SUPABASE_PROJECT_REF;
    const m = (env.NEXT_PUBLIC_SUPABASE_URL || "").match(
      /https:\/\/([a-z0-9]+)\.supabase\.co/i
    );
    if (m) return m[1];
  }
  return "";
}

function printDashboardFallback(detail) {
  console.log("");
  console.log("[apply:media-library] CLI 적용 불가 — Dashboard 실행 필요");
  console.log(`  원인: ${detail}`);
  console.log("");
  console.log("  1. Supabase Dashboard → Staging 프로젝트 → SQL Editor 열기");
  console.log(`  2. 아래 파일 내용을 그대로 붙여넣고 실행`);
  console.log(`     ${MIGRATION_REL}`);
  console.log("  3. 실행 후 이 명령으로 확인:");
  console.log("     npm run verify:media-library-staging");
  console.log("");
  console.log("  이 migration은 CREATE TABLE IF NOT EXISTS / GRANT 만 포함합니다.");
  console.log("  DROP · TRUNCATE · DELETE 없음. Production 대상 아님.");
}

// --- gate first --------------------------------------------------------------
const gate = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "gate:media-library-staging"],
  { cwd: root, encoding: "utf8", shell: true }
);
if (gate.status !== 0) {
  console.error((gate.stdout || "").slice(-3000));
  console.error((gate.stderr || "").slice(-2000));
  fail("gate failed — migration not applied");
}
pass("gate passed");

// --- ref guard ---------------------------------------------------------------
const ref = resolveLinkedRef();
if (ref === PROD_REF) fail("Production abort");
if (ref !== STAGING_REF) fail(`ref guard ${maskRef(ref)}`);
pass(`target Staging ${maskRef(ref)}`);

if (!existsSync(MIGRATION)) fail("migration file missing");

// --- apply -------------------------------------------------------------------
const sqlFile = path.join(tmpdir(), `kb-media-${process.pid}-${Date.now()}.sql`);
writeFileSync(sqlFile, readFileSync(MIGRATION, "utf8"), "utf8");

const cliEnv = withAccessToken(loadEnvFile(".env.local"));

const applied = spawnSync(
  npx(),
  ["supabase", "db", "query", "--linked", "--file", sqlFile],
  { cwd: root, encoding: "utf8", shell: true, env: cliEnv }
);
try {
  unlinkSync(sqlFile);
} catch {
  /* ignore */
}

if (applied.status !== 0) {
  const output = `${applied.stdout || ""}${applied.stderr || ""}`;
  if (/Ipv6|IPv6 is not supported/i.test(output)) {
    printDashboardFallback(
      "Supabase CLI direct host is IPv6-only and this network is IPv4-only"
    );
    process.exit(3);
  }
  if (/access token|not logged in|login/i.test(output)) {
    printDashboardFallback("Supabase CLI access token not available in this session");
    process.exit(3);
  }
  console.error(output.slice(0, 2000));
  fail(`db query failed status=${applied.status}`);
}
pass("migration SQL applied");

// --- reload PostgREST -------------------------------------------------------
// New tables exist in Postgres immediately, but PostgREST answers from a cached
// schema and returns PGRST205 ("could not find the table") until it reloads. The
// verify step goes through PostgREST, so without this it reports the migration
// as missing right after a successful apply.
const reloadFile = path.join(tmpdir(), `kb-reload-${process.pid}.sql`);
writeFileSync(reloadFile, "notify pgrst, 'reload schema';", "utf8");
spawnSync(npx(), ["supabase", "db", "query", "--linked", "--file", reloadFile], {
  cwd: root,
  encoding: "utf8",
  shell: true,
  env: cliEnv,
});
try {
  unlinkSync(reloadFile);
} catch {
  /* ignore */
}
await new Promise((resolve) => setTimeout(resolve, 5000));
pass("PostgREST schema cache reloaded");

// --- verify ------------------------------------------------------------------
const verify = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "verify:media-library-staging"],
  { cwd: root, encoding: "utf8", shell: true }
);
console.log(verify.stdout || "");
if (verify.status !== 0) {
  console.error(verify.stderr || "");
  fail("verify failed after apply");
}

console.log("");
console.log("[apply:media-library] DONE");
console.log("- Staging migration applied");
console.log("- No anon / authenticated grant issued");
console.log("- No DELETE executed");
process.exit(0);
