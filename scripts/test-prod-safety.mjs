#!/usr/bin/env node
/**
 * Phase E — production safety selftest (no real prod writes).
 * Verifies guard scripts refuse production scope.
 * npm run test:prod-safety
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = "rhfrmvkjsummaylpzmns";
let checks = 0;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  checks += 1;
}

function runNode(script, env = {}) {
  return spawnSync(process.execPath, [path.join(root, script)], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, ...env },
  });
}

// Destructive flags should be false in catalog automation config if present
const opPath = path.join(root, "config", "catalog-automation.json");
if (existsSync(opPath)) {
  const op = JSON.parse(readFileSync(opPath, "utf8"));
  assert(op.autoPromote !== true, "autoPromote off");
} else {
  checks += 1; // optional file
}

const pipePath = path.join(root, "config", "pipeline-operation.json");
if (existsSync(pipePath)) {
  const op = JSON.parse(readFileSync(pipePath, "utf8"));
  assert(op.destructive !== true, "pipeline destructive must not be true");
}

// Care dry-run with forced prod URL must block
const care = runNode("scripts/care-dry-run.mjs", {
  NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co`,
  SUPABASE_SERVICE_ROLE_KEY: "",
  CARE_EMAIL_PROVIDER: "",
});
assert((care.status ?? 1) === 0, "care dry-run exits 0");
const careOut = JSON.parse(care.stdout || "{}");
assert(careOut.productionBlocked === true, "care productionBlocked");
assert(
  Array.isArray(careOut.skipped) && careOut.skipped.includes("db_writes"),
  "care skips db writes"
);
assert(
  careOut.email?.status === "dry_run" || careOut.skipped?.includes("live_email_send"),
  "care email not live"
);

// Phase C with prod URL must not write
const phaseC = runNode("scripts/phase-c-catalog-automation.mjs", {
  NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co`,
  SUPABASE_SERVICE_ROLE_KEY: "dummy-should-not-write",
  APP_ENV: "production",
});
assert((phaseC.status ?? 1) === 0 || (phaseC.status ?? 1) === 2, "phase-c exits");
const phaseOut = JSON.parse(phaseC.stdout || "{}");
assert(phaseOut.productionTouched === false, "phase-c productionTouched false");
assert(phaseOut.autoVerified === false, "no auto verified");
assert(phaseOut.stagingWriteCount === 0, "no staging writes under prod env");

// CI workflow must not deploy production
const ci = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
assert(!/vercel\s+deploy|--prod/i.test(ci), "CI has no vercel --prod deploy");
assert(/never write to any database/i.test(ci), "CI documents no DB writes");

// No vercel.json cron registration
assert(!existsSync(path.join(root, "vercel.json")), "no vercel.json cron file");

// robots disallow admin/my
const robots = readFileSync(path.join(root, "src/app/robots.ts"), "utf8");
assert(robots.includes("/admin/"), "robots disallow admin");
assert(robots.includes("/my/"), "robots disallow my");

console.log(
  JSON.stringify({
    phase: "prod_safety_selftest_ok",
    checks,
    productionWrites: false,
    liveEmail: false,
    cronRegistered: false,
  })
);
