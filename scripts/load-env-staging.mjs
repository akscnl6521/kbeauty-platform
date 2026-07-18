/**
 * Load Staging-only env from `.env.staging`.
 * Never reads `.env.local` (Production isolation).
 * Overwrites the three Supabase keys so parent shell Production values cannot leak.
 * Never logs values.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STAGING_ENV_FILE = ".env.staging";
export const STAGING_SUPABASE_REF = "jfnjufmldiqlgvgyugfd";
export const PRODUCTION_SUPABASE_REF = "rhfrmvkjsummaylpzmns";

const STAGING_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

function parseEnvFile(filePath) {
  const map = {};
  if (!existsSync(filePath)) return map;
  let text = readFileSync(filePath, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map[key] = value;
  }
  return map;
}

export function extractProjectRefFromUrl(url) {
  if (!url) return "";
  try {
    const host = new URL(url).hostname.toLowerCase();
    const m = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return m?.[1] ?? "";
  } catch {
    return "";
  }
}

/**
 * Project root = directory that contains `scripts/` (same for check + preview).
 * Prefer this over process.cwd() so tsx/npm wrappers cannot drift.
 */
export function resolveProjectRootFromScript(scriptUrl) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

/**
 * @returns {{ loaded: boolean, file: string, absFile: string, ref: string, hasServiceRole: boolean, hasAnonKey: boolean, hasUrl: boolean, isStaging: boolean, isProduction: boolean, lengths: Record<string, number> }}
 */
export function loadEnvStaging(root = process.cwd()) {
  const file = path.join(root, STAGING_ENV_FILE);
  const map = parseEnvFile(file);
  if (!existsSync(file)) {
    return {
      loaded: false,
      file: STAGING_ENV_FILE,
      absFile: file,
      ref: "",
      hasServiceRole: false,
      hasAnonKey: false,
      hasUrl: false,
      isStaging: false,
      isProduction: false,
      lengths: Object.fromEntries(STAGING_KEYS.map((k) => [k, 0])),
    };
  }

  // Force-overwrite staging keys from file (block Production shell bleed).
  // Missing keys are deleted so parent-shell Production values cannot leak.
  for (const key of STAGING_KEYS) {
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      process.env[key] = map[key];
    } else {
      delete process.env[key];
    }
  }

  // Script-only defaults — not required in the user's env file.
  if (!process.env.APP_ENV) process.env.APP_ENV = "preview";
  if (!process.env.CATALOG_DATABASE_ENV) {
    process.env.CATALOG_DATABASE_ENV = "staging";
  }

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  const service = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const ref = extractProjectRefFromUrl(url);
  return {
    loaded: true,
    file: STAGING_ENV_FILE,
    absFile: file,
    ref,
    hasServiceRole: service.length > 0,
    hasAnonKey: anon.length > 0,
    hasUrl: url.length > 0,
    isStaging: ref === STAGING_SUPABASE_REF,
    isProduction: ref === PRODUCTION_SUPABASE_REF,
    // Meta only — never include values
    lengths: {
      NEXT_PUBLIC_SUPABASE_URL: url.length,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anon.length,
      SUPABASE_SERVICE_ROLE_KEY: service.length,
    },
  };
}

/**
 * Shared gate used by check + preview (same loader, same rules).
 * @returns {{ allow: boolean, gate: string, meta: ReturnType<typeof loadEnvStaging> }}
 */
export function evaluateStagingWriteGate(root = process.cwd()) {
  const meta = loadEnvStaging(root);
  const isProd = meta.isProduction || meta.ref === PRODUCTION_SUPABASE_REF;
  const isStaging = meta.isStaging && meta.ref === STAGING_SUPABASE_REF;
  const allow =
    meta.loaded &&
    isStaging &&
    !isProd &&
    meta.hasServiceRole &&
    meta.hasUrl &&
    meta.hasAnonKey;

  let gate = "ALLOW_STAGING_WRITE";
  if (!meta.loaded) gate = "BLOCK_MISSING_STAGING_ENV_FILE";
  else if (isProd) gate = "BLOCK_PRODUCTION";
  else if (!meta.hasUrl || !meta.hasAnonKey) gate = "BLOCK_MISSING_PUBLIC_KEYS";
  else if (!meta.hasServiceRole) gate = "BLOCK_NO_SERVICE_ROLE";
  else if (!isStaging) gate = "BLOCK_NOT_STAGING_REF";

  return { allow, gate: allow ? "ALLOW_STAGING_WRITE" : gate, meta };
}
