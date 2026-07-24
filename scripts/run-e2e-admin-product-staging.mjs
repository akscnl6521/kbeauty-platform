#!/usr/bin/env node
/**
 * Loads Staging-only credentials via Supabase CLI (never prints keys),
 * then runs createAdminProduct E2E. Aborts on Production ref.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = "rhfrmvkjsummaylpzmns";
const EXPECTED = "jfnjufmldiqlgvgyugfd";

function linkedRef() {
  return readFileSync(path.join(root, "supabase", ".temp", "project-ref"), "utf8").trim();
}

function mask(ref) {
  if (ref.length <= 8) return `${ref.slice(0, 2)}***`;
  return `${ref.slice(0, 4)}***${ref.slice(-3)}`;
}

function getStagingServiceRole(ref) {
  if (ref === PROD) throw new Error("ABORT Production");
  const outFile = path.join(tmpdir(), `kb-keys-${process.pid}.json`);
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const r = spawnSync(
    npx,
    ["supabase", "projects", "api-keys", "--project-ref", ref, "--reveal", "-o", "json"],
    { cwd: root, encoding: "utf8", shell: true, env: { ...process.env, npm_config_loglevel: "silent" } }
  );
  let raw = (r.stdout || "").trim();
  if (!raw) {
    // fallback: write via PowerShell-style not available; try stderr-split
    writeFileSync(outFile, "");
    const r2 = spawnSync(
      process.platform === "win32" ? "cmd.exe" : "sh",
      process.platform === "win32"
        ? ["/c", `${npx} supabase projects api-keys --project-ref ${ref} --reveal -o json 1>${outFile} 2>nul`]
        : ["-c", `${npx} supabase projects api-keys --project-ref ${ref} --reveal -o json > "${outFile}" 2>/dev/null`],
      { cwd: root, shell: false }
    );
    if (existsSync(outFile)) {
      raw = readFileSync(outFile, "utf8").trim();
      unlinkSync(outFile);
    }
    if (!raw) {
      throw new Error(`api-keys failed status=${r.status ?? r2.status}`);
    }
  } else if (existsSync(outFile)) {
    try { unlinkSync(outFile); } catch { /* ignore */ }
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
console.log(`[e2e-runner] linked=${mask(ref)}`);
if (ref !== EXPECTED || ref === PROD) {
  console.error("[e2e-runner] refused: not expected staging");
  process.exit(1);
}

const serviceRole = getStagingServiceRole(ref);
console.log(`[e2e-runner] service_ready len=${serviceRole.length}`);

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
const register = pathToFileURL(path.join(root, "scripts", "register-server-only.mjs")).href;
const tsxLoader = pathToFileURL(tsxEntry).href;
const entry = path.join(root, "scripts", "e2e-admin-product-register-staging.ts");

const result = spawnSync(
  process.execPath,
  ["--import", register, "--import", tsxLoader, entry],
  { cwd: root, stdio: "inherit", env, shell: false }
);

process.exit(result.status ?? 1);
