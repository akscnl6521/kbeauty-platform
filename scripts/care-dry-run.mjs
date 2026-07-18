#!/usr/bin/env node
/**
 * Care dry-run — no DB writes, no email send.
 * npm run care:dry-run
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = "rhfrmvkjsummaylpzmns";
const STAGING = "jfnjufmldiqlgvgyugfd";

function loadEnvLocal() {
  const p = path.join(root, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] != null) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

function refFromUrl(url) {
  try {
    return new URL(url).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

loadEnvLocal();
mkdirSync(path.join(root, "reports"), { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ref = refFromUrl(url);
const hasService = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const provider = (process.env.CARE_EMAIL_PROVIDER || "").trim() || null;

const summary = {
  phase: "care_dry_run",
  startedAt: new Date().toISOString(),
  productionBlocked: ref === PROD,
  stagingReady: ref === STAGING && hasService,
  env: {
    hasUrl: Boolean(url),
    hasService,
    catalogEnv: process.env.CATALOG_DATABASE_ENV || null,
    refHint: ref ? `${ref.slice(0, 4)}…` : null,
  },
  milestones: [3, 7, 15, 30],
  email: {
    status: "dry_run",
    reason: provider ? "credentials_or_live_send_disabled" : "provider_missing",
    provider,
    previewSubject: "Day 3 체크인 안내 — K-Beauty Match",
    previewBody:
      "짧은 체크인으로 피부 상태를 기록해 주세요. 의료 진단이 아닙니다.",
  },
  skipped: [],
  note: "Schedule/notify apply requires Staging link + service role. Production never written.",
};

if (ref === PROD) summary.skipped.push("production_url_detected");
if (ref !== STAGING) summary.skipped.push("staging_not_linked");
if (!hasService) summary.skipped.push("service_role_missing");
summary.skipped.push("db_writes");
summary.skipped.push("live_email_send");

writeFileSync(
  path.join(root, "reports", "care-dry-run.json"),
  JSON.stringify(summary, null, 2) + "\n"
);
console.log(JSON.stringify(summary, null, 2));
