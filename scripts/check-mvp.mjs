#!/usr/bin/env node
/**
 * Unified Korea MVP safety gate.
 * Runs static/local checks only. Never writes to any database.
 * Aborts immediately if Production environment is detected.
 *
 * Usage: npm run check:mvp
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadEnvLocal } from "./load-env-local.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvLocal();

const KNOWN_PRODUCTION_REF =
  process.env.PRODUCTION_SUPABASE_PROJECT_REF?.trim() || "rhfrmvkjsummaylpzmns";

function deriveRef(url) {
  if (!url?.trim()) return "";
  try {
    const host = new URL(url).hostname.toLowerCase();
    const m = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return m?.[1] ?? "";
  } catch {
    return "";
  }
}

function detectProductionRisk() {
  const reasons = [];
  const appEnv = (process.env.APP_ENV ?? "").trim().toLowerCase();
  const catalogEnv = (process.env.CATALOG_DATABASE_ENV ?? "").trim().toLowerCase();
  const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
  const vercelEnv = (process.env.VERCEL_ENV ?? "").trim().toLowerCase();
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    ""
  ).trim();
  const supabaseUrl = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    ""
  ).trim();
  const ref =
    process.env.SUPABASE_PROJECT_REF?.trim() || deriveRef(supabaseUrl);

  if (appEnv === "production") reasons.push("APP_ENV=production");
  if (catalogEnv === "production") reasons.push("CATALOG_DATABASE_ENV=production");
  if (vercelEnv === "production") reasons.push("VERCEL_ENV=production");
  if (nodeEnv === "production" && process.env.CI === "true") {
    // CI build uses NODE_ENV=production for next build; only flag when
    // a Production URL/ref is also present.
  }
  if (/kbeautymatch\.com/i.test(siteUrl) && process.env.MVP_ALLOW_PROD_URL !== "1") {
    // Site URL alone is not a hard abort for local read-only gates, but we
    // refuse any DB-facing step when Production ref matches.
  }
  if (ref && ref === KNOWN_PRODUCTION_REF) {
    reasons.push(`SUPABASE_PROJECT_REF matches Production (${KNOWN_PRODUCTION_REF})`);
  }
  if (supabaseUrl.includes(KNOWN_PRODUCTION_REF)) {
    reasons.push("NEXT_PUBLIC_SUPABASE_URL host matches Production ref");
  }

  return reasons;
}

/** Steps that never write to DB and do not require live secrets. */
const SAFE_STEPS = [
  {
    id: "lint",
    label: "ESLint",
    command: "npm",
    args: ["run", "lint"],
    // Pre-existing repo lint errors must not block MVP static gate;
    // CI still runs lint as a visible step. Treat local failure as WARN.
    required: false,
    warnOnly: true,
  },
  {
    id: "build",
    label: "Next.js build",
    command: "npm",
    args: ["run", "build"],
    required: true,
    env: {
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-key-for-mvp-check",
      AI_PROVIDER: process.env.AI_PROVIDER || "mock",
    },
  },
  {
    id: "smoke",
    label: "Smoke (static)",
    command: "npm",
    args: ["run", "test:smoke"],
    required: true,
    env: { SMOKE_MODE: "static" },
  },
  {
    id: "journey",
    label: "Customer journey selftest",
    command: "npm",
    args: ["run", "test:journey"],
    required: true,
  },
  {
    id: "quality",
    label: "Recommend quality regression",
    command: "npm",
    args: ["run", "test:quality"],
    required: true,
  },
  {
    id: "release-security",
    label: "Release security check",
    command: "npm",
    args: ["run", "check:release-security"],
    required: true,
  },
  {
    id: "responsive",
    label: "Responsive layout check",
    command: "npm",
    args: ["run", "check:responsive"],
    required: true,
  },
  {
    id: "production-safety",
    label: "Production readiness (static)",
    command: "npm",
    args: ["run", "check:production"],
    required: true,
  },
];

/** Optional steps — SKIPPED when secrets/env missing; never fail CI as code bugs. */
const OPTIONAL_STEPS = [
  {
    id: "staging-quality",
    label: "Staging recommend quality",
    script: "check:staging-quality",
    requiredSecrets: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    skipIfProductionRef: true,
  },
  {
    id: "preview-substitute",
    label: "Preview substitute quality",
    script: "check:preview-substitute",
    requiredSecrets: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    skipIfProductionRef: true,
  },
  {
    id: "deployment-env",
    label: "Deployment env presence",
    script: "check:deployment-env",
    requiredSecrets: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ],
    skipIfProductionRef: false,
  },
];

const results = [];

function hasSecret(name) {
  return Boolean(process.env[name]?.trim());
}

function runNpmScript(script, envExtra = {}) {
  return spawnSync("npm", ["run", script], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...envExtra, MVP_CHECK: "1" },
  });
}

function runStep(step) {
  console.log(`\n======== [check:mvp] ${step.id}: ${step.label} ========`);
  const result = spawnSync(step.command, step.args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...(step.env ?? {}), MVP_CHECK: "1" },
  });
  const code = result.status ?? 1;
  let status = code === 0 ? "PASS" : "FAIL";
  if (code !== 0 && step.warnOnly) status = "WARN";
  results.push({ id: step.id, status, code });
  console.log(`[check:mvp] ${step.id} → ${status}`);
  return code === 0;
}

console.log("[check:mvp] Korea MVP unified gate (read-only / no DB writes)");
console.log("[check:mvp] CI=", process.env.CI ?? "false");

const prodRisk = detectProductionRisk();
const onProductionRef = prodRisk.some((r) => /Production/i.test(r));
const inCi =
  process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

if (inCi) {
  console.log("[check:mvp] CI detected — DB write steps are disabled by design");
}

if (
  process.env.CATALOG_INGESTION_ENABLED === "true" &&
  onProductionRef
) {
  console.error(
    "[check:mvp] ABORT: CATALOG_INGESTION_ENABLED=true with Production ref is forbidden."
  );
  process.exit(2);
}

// CI must never run against Production credentials / URL.
if (inCi && onProductionRef) {
  console.error(
    "[check:mvp] ABORT: Production environment detected in CI.\n" +
      "  Reasons: " +
      prodRisk.join("; ") +
      "\n  Remove Production secrets from CI. Use placeholders or Staging only."
  );
  process.exit(2);
}

if (onProductionRef) {
  console.warn(
    "[check:mvp] Production Supabase ref detected locally.\n" +
      "  Continuing with STATIC checks only — no DB write steps.\n" +
      "  Staging/DB optional steps will be SKIPPED.\n" +
      "  Reasons: " +
      prodRisk.join("; ")
  );
}

let failedRequired = false;

for (const step of SAFE_STEPS) {
  const ok = runStep(step);
  if (!ok && step.required) failedRequired = true;
  if (!ok && step.required && process.env.MVP_FAIL_FAST === "1") break;
}

for (const opt of OPTIONAL_STEPS) {
  console.log(`\n======== [check:mvp] ${opt.id}: ${opt.label} ========`);
  const missing = (opt.requiredSecrets ?? []).filter((s) => !hasSecret(s));
  if (opt.skipIfProductionRef && onProductionRef) {
    results.push({
      id: opt.id,
      status: "SKIPPED",
      reason: "Production Supabase ref — DB checks disabled",
      secrets: opt.requiredSecrets,
    });
    console.log(`[check:mvp] ${opt.id} → SKIPPED (Production ref)`);
    continue;
  }
  if (missing.length) {
    results.push({
      id: opt.id,
      status: "SKIPPED",
      reason: `missing secrets: ${missing.join(", ")}`,
      secrets: missing,
    });
    console.log(
      `[check:mvp] ${opt.id} → SKIPPED (need: ${missing.join(", ")})`
    );
    continue;
  }
  const result = runNpmScript(opt.script);
  const code = result.status ?? 1;
  const status = code === 0 ? "PASS" : "FAIL";
  results.push({ id: opt.id, status, code });
  console.log(`[check:mvp] ${opt.id} → ${status}`);
  // Optional steps do not fail the gate unless MVP_STRICT_OPTIONAL=1
  if (code !== 0 && process.env.MVP_STRICT_OPTIONAL === "1") {
    failedRequired = true;
  }
}

console.log("\n======== [check:mvp] SUMMARY ========");
for (const r of results) {
  const extra = r.reason ? ` (${r.reason})` : "";
  console.log(`  ${r.id.padEnd(22)} ${r.status}${extra}`);
}

const skipped = results.filter((r) => r.status === "SKIPPED");
if (skipped.length) {
  const secretNames = [
    ...new Set(skipped.flatMap((r) => r.secrets ?? [])),
  ];
  if (secretNames.length) {
    console.log(
      `[check:mvp] SKIPPED secrets summary: ${secretNames.join(", ")}`
    );
  }
}

if (failedRequired) {
  console.error("[check:mvp] FAILED — required checks did not all pass");
  process.exit(1);
}

console.log("[check:mvp] PASSED — required static/local gates OK");
process.exit(0);
