#!/usr/bin/env node
/**
 * Launch-blocker classification for Production env (read-only).
 * Prints ONLY classifications / key names — never secret values.
 * Deletes the pulled file before exit. Does NOT change Production deploy/DB/git.
 *
 * Usage: node scripts/check-production-launch-blockers.mjs
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const dir = path.join(
  tmpdir(),
  `kb-prod-blockers-${process.pid}-${Date.now()}`
);
mkdirSync(dir, { recursive: true });
const envFile = path.join(dir, "production.env");

function parseEnvFile(file) {
  const map = new Map();
  const raw = readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // vercel may escape newlines as \n
    val = val.replace(/\\n/g, "").trim();
    map.set(key, val);
  }
  return map;
}

function classifyAiProvider(raw) {
  const v = (raw || "").trim().toLowerCase();
  if (!v) return { set: false, isMock: false, allowed: false, kind: "unset" };
  if (v === "mock")
    return { set: true, isMock: true, allowed: false, kind: "mock" };
  if (v === "openai" || v === "anthropic") {
    return { set: true, isMock: false, allowed: true, kind: v };
  }
  if (v === "ollama") {
    return { set: true, isMock: false, allowed: false, kind: "ollama" };
  }
  return { set: true, isMock: false, allowed: false, kind: "other" };
}

function classifySiteUrl(raw) {
  const v = (raw || "").trim();
  if (!v) return { set: false, isLocalhost: false, isProdDomain: false, usesHttps: false };
  const lower = v.toLowerCase();
  return {
    set: true,
    isLocalhost: /localhost|127\.0\.0\.1/.test(lower),
    isProdDomain: /kbeautymatch\.com/.test(lower),
    usesHttps: /^https:\/\//i.test(v),
  };
}

function classifySupabaseUrl(raw) {
  const v = (raw || "").trim();
  const PROD = "rhfrmvkjsummaylpzmns";
  const STAGING = "jfnjufmldiqlgvgyugfd";
  return {
    set: Boolean(v),
    isProductionRef: v.includes(PROD),
    isStagingRef: v.includes(STAGING),
  };
}

let exitCode = 1;
try {
  const pull = spawnSync(
    "npx.cmd",
    ["--yes", "vercel", "env", "pull", envFile, "--environment=production", "--yes"],
    {
      cwd: root,
      encoding: "utf8",
      shell: true,
      env: { ...process.env, npm_config_loglevel: "silent" },
    }
  );
  if ((pull.status ?? 1) !== 0 || !existsSync(envFile)) {
    console.log(
      JSON.stringify({
        phase: "production_launch_blockers_fail",
        reason: "vercel_env_pull_failed",
        status: pull.status,
        fileExists: existsSync(envFile),
      })
    );
    process.exit(1);
  }

  const env = parseEnvFile(envFile);
  const keyNames = [...env.keys()].filter(
    (k) =>
      !k.startsWith("VERCEL_") &&
      !k.startsWith("TURBO_") &&
      k !== "NX_DAEMON"
  );
  const ai = classifyAiProvider(env.get("AI_PROVIDER"));
  const site = classifySiteUrl(env.get("NEXT_PUBLIC_SITE_URL"));
  const sb = classifySupabaseUrl(env.get("NEXT_PUBLIC_SUPABASE_URL"));
  const hasAnon = Boolean(env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")?.trim());
  const hasService = Boolean(env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim());
  const hasOpenAi = Boolean(env.get("OPENAI_API_KEY")?.trim());

  const blockers = [];
  if (!ai.set) blockers.push("AI_PROVIDER_unset");
  if (ai.isMock) blockers.push("AI_PROVIDER_is_mock");
  if (ai.set && !ai.allowed) blockers.push(`AI_PROVIDER_not_allowed:${ai.kind}`);
  if (!site.set) blockers.push("SITE_URL_unset");
  if (site.isLocalhost) blockers.push("SITE_URL_localhost");
  if (site.set && !site.isProdDomain) blockers.push("SITE_URL_not_prod_domain");
  if (site.set && !site.usesHttps) blockers.push("SITE_URL_not_https");
  if (!sb.isProductionRef) blockers.push("SUPABASE_URL_not_production_ref");
  if (!hasAnon) blockers.push("missing_anon_key");
  if (!hasOpenAi && ai.kind === "openai") blockers.push("missing_OPENAI_API_KEY");

  const summary = {
    phase:
      blockers.length === 0
        ? "production_env_blockers_clear"
        : "production_env_blockers_present",
    pulled_app_keys: keyNames.sort(),
    ai_provider: {
      set: ai.set,
      is_mock: ai.isMock,
      allowed_for_production: ai.allowed,
      kind: ai.kind,
    },
    site_url: {
      set: site.set,
      is_localhost: site.isLocalhost,
      is_prod_domain: site.isProdDomain,
      uses_https: site.usesHttps,
    },
    supabase: {
      url_set: sb.set,
      is_production_ref: sb.isProductionRef,
      is_staging_ref: sb.isStagingRef,
      has_anon_key: hasAnon,
      has_service_role_key: hasService,
    },
    openai_key_present: hasOpenAi,
    blockers,
    auth_redirects:
      "Supabase Dashboard manual check required (Site URL + Redirect URLs)",
    production_db_or_deploy_changed: false,
  };
  console.log(JSON.stringify(summary));
  exitCode = blockers.length ? 2 : 0;
} finally {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    try {
      if (existsSync(envFile)) unlinkSync(envFile);
    } catch {}
  }
}
process.exit(exitCode);
