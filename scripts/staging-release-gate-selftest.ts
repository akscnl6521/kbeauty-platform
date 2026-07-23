/**
 * P2-T02 — Staging release gate selftest (no live Staging required).
 * Validates contract integrity, static gate outcomes, Production abort,
 * and dashboard_only_unknown honesty. Does not claim Dashboard verification.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  AUTH_CALLBACK_INPUTS,
  EXPECTED_DATED_MIGRATIONS,
  EXPECTED_STAGING_TABLES,
  KNOWN_STAGING_SUPABASE_REF,
  PUBLICATION_PIPELINE_STATES,
  STAGING_RELEASE_GATE_TASK_ID,
  assessEnvironmentIdentity,
  assertContractIntegrity,
  formatReportMarkdown,
  mergeReadonlyProbeResults,
  reportIsOk,
  runStaticStagingReleaseGate,
  summarizeChecks,
} from "../src/lib/release/stagingReleaseGate";
import { KNOWN_PRODUCTION_SUPABASE_REF } from "../src/lib/catalog/automation/ingestionGate";
import { CARE_PHOTO_BUCKET } from "../src/lib/care/photoComparisonPolicy";

const root = process.cwd();

function fileExists(rel: string) {
  return existsSync(path.join(root, rel));
}

function readFile(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

// --- identity ---
assert.equal(STAGING_RELEASE_GATE_TASK_ID, "P2-T02");
assert.notEqual(KNOWN_STAGING_SUPABASE_REF, KNOWN_PRODUCTION_SUPABASE_REF);
assert.equal(CARE_PHOTO_BUCKET, "care-photos");
assert.equal(
  PUBLICATION_PIPELINE_STATES[PUBLICATION_PIPELINE_STATES.length - 1],
  "published"
);
assert.ok(EXPECTED_STAGING_TABLES.includes("products"));
assert.ok(AUTH_CALLBACK_INPUTS.includes("token_hash"));
assert.ok(AUTH_CALLBACK_INPUTS.includes("next"));

const stagingId = assessEnvironmentIdentity({
  NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_STAGING_SUPABASE_REF}.supabase.co`,
  APP_ENV: "preview",
  CATALOG_DATABASE_ENV: "staging",
});
assert.equal(stagingId.isProduction, false);
assert.equal(stagingId.isStaging, true);
assert.ok(stagingId.projectRefMasked);
assert.ok(!stagingId.projectRefMasked!.includes(KNOWN_STAGING_SUPABASE_REF));

const prodId = assessEnvironmentIdentity({
  NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_PRODUCTION_SUPABASE_REF}.supabase.co`,
  APP_ENV: "production",
});
assert.equal(prodId.isProduction, true);

// --- contract files ---
const contractErrors = assertContractIntegrity({ fileExists });
assert.deepEqual(
  contractErrors,
  [],
  `contract errors: ${contractErrors.join("; ")}`
);

for (const rel of EXPECTED_DATED_MIGRATIONS) {
  assert.ok(fileExists(rel), `migration present: ${rel}`);
}

// --- static gate on real repo (no secrets required) ---
const report = runStaticStagingReleaseGate({
  env: {
    APP_ENV: "preview",
    CATALOG_DATABASE_ENV: "staging",
    NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_STAGING_SUPABASE_REF}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-not-a-real-key",
  },
  fileExists,
  readFile,
  now: "2026-07-24T00:00:00.000Z",
});

assert.equal(report.taskId, "P2-T02");
assert.equal(report.mode, "static");
assert.equal(report.writeAttempted, false);
assert.equal(report.isProductionBlocked, false);
assert.equal(report.ok, true);
assert.ok(report.checks.length >= 15);

const categories = new Set(report.checks.map((c) => c.category));
for (const cat of [
  "environment_identity",
  "health",
  "tables_contracts",
  "auth_callback",
  "storage",
  "publication_states",
  "migrations",
] as const) {
  assert.ok(categories.has(cat), `missing category ${cat}`);
}

const dashboardUnknown = report.checks.filter(
  (c) => c.factKind === "dashboard_only_unknown"
);
assert.ok(
  dashboardUnknown.length >= 3,
  "must keep dashboard-only unknowns (auth redirect, storage live, migration history)"
);
assert.ok(
  dashboardUnknown.some((c) => c.id === "auth_dashboard_redirect_urls"),
  "auth dashboard redirect must be dashboard_only_unknown"
);
assert.ok(
  dashboardUnknown.some((c) => c.id === "storage_care_photos_live"),
  "care-photos live must be dashboard_only_unknown"
);
assert.ok(
  dashboardUnknown.every((c) => c.status === "unknown"),
  "dashboard_only_unknown must not be marked pass/fail as verified"
);

const authInputs = report.checks.find((c) => c.id === "auth_callback_inputs");
assert.ok(authInputs);
assert.equal(authInputs!.status, "pass");
assert.equal(authInputs!.factKind, "verified");

const pipelineFlags = report.checks.find(
  (c) => c.id === "publication_pipeline_flags"
);
assert.ok(pipelineFlags);
assert.equal(pipelineFlags!.status, "pass");

// --- Production abort ---
const blocked = runStaticStagingReleaseGate({
  env: {
    APP_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: `https://${KNOWN_PRODUCTION_SUPABASE_REF}.supabase.co`,
  },
  fileExists,
  readFile,
});
assert.equal(blocked.isProductionBlocked, true);
assert.equal(blocked.ok, false);
assert.equal(blocked.writeAttempted, false);
assert.ok(
  blocked.checks.some(
    (c) => c.id === "env_not_production" && c.factKind === "blocked"
  )
);

// --- merge readonly probes ---
const merged = mergeReadonlyProbeResults(report, {
  healthOk: true,
  tablesFound: {
    products: true,
    ingredients: true,
    product_ingredients: true,
    product_offers: true,
    product_variants: true,
    profiles: true,
  },
});
assert.equal(merged.mode, "readonly");
assert.equal(merged.writeAttempted, false);
assert.equal(merged.ok, true);
const healthLive = merged.checks.find((c) => c.id === "health_live_status");
assert.equal(healthLive?.status, "pass");
assert.equal(healthLive?.factKind, "verified");
const tablesLive = merged.checks.find((c) => c.id === "tables_live_presence");
assert.equal(tablesLive?.status, "pass");
assert.equal(tablesLive?.factKind, "verified");

const mergedFail = mergeReadonlyProbeResults(report, { healthOk: false });
assert.equal(mergedFail.ok, false);

// --- helpers ---
const summary = summarizeChecks(report.checks);
assert.equal(summary.fail, 0);
assert.ok(summary.dashboardOnlyUnknown >= 3);
assert.equal(reportIsOk(report.checks, false), true);
assert.equal(reportIsOk(report.checks, true), false);

const md = formatReportMarkdown(report);
assert.ok(md.includes("P2-T02"));
assert.ok(md.includes("dashboard_only_unknown"));
assert.ok(md.includes("writeAttempted"));

// --- docs + scripts wired ---
assert.ok(fileExists("docs/prelaunch/P2-T02_STAGING_RELEASE_GATE.md"));
const pkg = JSON.parse(readFile("package.json")) as {
  scripts: Record<string, string>;
};
assert.ok(pkg.scripts["test:staging-release-gate"]);
assert.ok(pkg.scripts["check:staging-release-gate"]);

console.log("[staging-release-gate-selftest] PASS");
