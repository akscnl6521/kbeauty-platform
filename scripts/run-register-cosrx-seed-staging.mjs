#!/usr/bin/env node
/**
 * Staging-only: load service_role via Supabase CLI (--reveal), never print keys,
 * then run COSRX seed register. Aborts on Production.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = "rhfrmvkjsummaylpzmns";
const EXPECTED = "jfnjufmldiqlgvgyugfd";

function linkedRef() {
  const p = path.join(root, "supabase", ".temp", "project-ref");
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf8").trim();
}

function mask(ref) {
  if (!ref) return "missing";
  if (ref.length <= 8) return `${ref.slice(0, 2)}***`;
  return `${ref.slice(0, 4)}***${ref.slice(-3)}`;
}

function extractJson(raw) {
  const startArr = raw.indexOf("[");
  const startObj = raw.indexOf("{");
  let start = -1;
  if (startArr >= 0 && startObj >= 0) start = Math.min(startArr, startObj);
  else start = Math.max(startArr, startObj);
  if (start < 0) return null;
  const slice = raw.slice(start).trim();
  try {
    return JSON.parse(slice);
  } catch {
    const end = Math.max(slice.lastIndexOf("]"), slice.lastIndexOf("}"));
    if (end > 0) {
      try {
        return JSON.parse(slice.slice(0, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function getStagingServiceRole(ref) {
  if (ref === PROD) throw new Error("ABORT Production");
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const r = spawnSync(
    npx,
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
  const raw = (r.stdout || "").trim();
  if (!raw) throw new Error(`api-keys empty status=${r.status}`);
  const keys = extractJson(raw);
  if (!Array.isArray(keys)) throw new Error("api-keys not array");
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

const ref = linkedRef() || EXPECTED;
console.log(`[cosrx-seed] linked=${mask(ref)}`);
if (ref !== EXPECTED || ref === PROD) {
  console.error("[cosrx-seed] refused: not expected staging");
  process.exit(1);
}

const serviceRole = getStagingServiceRole(ref);
console.log(`[cosrx-seed] service_ready len=${serviceRole.length}`);

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
const entry = path.join(root, "scripts", "register-cosrx-seed-staging.ts");

const result = spawnSync(
  process.execPath,
  ["--import", register, "--import", tsxLoader, entry],
  { cwd: root, stdio: "inherit", env, shell: false }
);

process.exit(result.status ?? 1);
