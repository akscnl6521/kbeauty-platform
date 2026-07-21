#!/usr/bin/env node
/**
 * Evaluate shell command or SQL text for approval-boundary violations.
 * CLI: node scripts/safe-command-gate.mjs --check "command here"
 */
const PROD_REF = "rhfrmvkjsummaylpzmns";
const STAGING_REF = "jfnjufmldiqlgvgyugfd";

/** @type {{ pattern: RegExp, reason: string, allow?: RegExp }[]} */
const RULES = [
  {
    pattern: new RegExp(PROD_REF, "i"),
    reason: "Production Supabase ref (rhfr***mns) blocked",
  },
  {
    pattern: /\brhfr\*\*\*mns\b/i,
    reason: "Production environment target blocked",
  },
  {
    pattern: /git\s+checkout\s+main\b/i,
    reason: "git checkout main blocked",
  },
  {
    pattern: /git\s+merge\s+main\b/i,
    reason: "git merge main blocked",
  },
  {
    pattern: /vercel\s+.*--prod\b/i,
    reason: "vercel --prod blocked",
  },
  {
    pattern: /vercel\s+deploy\s+.*production/i,
    reason: "vercel production deploy blocked",
  },
  {
    pattern: /supabase\s+link\s+.*production/i,
    reason: "supabase production link blocked",
  },
  {
    pattern: new RegExp(`supabase\\s+link\\s+.*${PROD_REF}`, "i"),
    reason: "supabase link to Production ref blocked",
  },
  {
    pattern: /\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX|FUNCTION)\b/i,
    reason: "DROP statement blocked",
  },
  {
    pattern: /\bTRUNCATE\b/i,
    reason: "TRUNCATE blocked",
  },
  {
    pattern: /\bDELETE\s+FROM\b/i,
    allow: /synthetic[-_]test|fixture|_test_|test_fixture|dry[-_]run/i,
    reason: "DELETE without synthetic-test/fixture scope blocked",
  },
  {
    pattern: /resend\.com.*\/emails/i,
    reason: "resend.com live send blocked",
  },
  {
    pattern: /emails\.send\s*\(/i,
    allow: /dry[-_]run|mock|selftest|self-test|preview_checkin_email_test/i,
    reason: "provider live email send blocked",
  },
  {
    pattern: /RESEND_API_KEY\s*=\s*['"]?re_[a-zA-Z0-9]+/i,
    reason: ".env RESEND_API_KEY value dump blocked",
  },
  {
    pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"]?eyJ/i,
    reason: "service_role key dump blocked",
  },
  {
    pattern: /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/i,
    reason: "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY forbidden",
  },
  {
    pattern: /sk_live_[a-zA-Z0-9]+/,
    reason: "Stripe live secret in diff blocked",
  },
  {
    pattern: /console\.log\(.*process\.env\.(SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY)/i,
    reason: "logging secret env vars blocked",
  },
];

/** @type {{ pattern: RegExp, label: string }[]} */
export const ALLOW_HINTS = [
  { pattern: /^\s*SELECT\b/im, label: "SELECT queries" },
  {
    pattern: /GRANT\s+(SELECT|INSERT|UPDATE)\s+ON\b.*\bTO\s+service_role/i,
    label: "GRANT to service_role",
  },
  {
    pattern: /CREATE\s+(TABLE|INDEX|FUNCTION|OR\s+REPLACE\s+FUNCTION)\b/i,
    label: "CREATE DDL (Staging migration)",
  },
  {
    pattern: /ENABLE\s+ROW\s+LEVEL\s+SECURITY|ALTER\s+TABLE.*ENABLE\s+RLS/i,
    label: "RLS enable",
  },
  { pattern: /\bREVOKE\b/i, label: "REVOKE" },
  {
    pattern: /npm\s+run\s+(test:|gate:|project:)/i,
    label: "local npm tests/orchestrator",
  },
  {
    pattern: /vercel\s+(deploy|)/i,
    allowBlock: /vercel\s+.*--prod/i,
    label: "Preview deploy (non-prod)",
  },
  {
    pattern: /git\s+push\s+origin\s+(feature\/|fix\/)/i,
    label: "feature branch push",
  },
  {
    pattern: new RegExp(STAGING_REF, "i"),
    label: "Staging ref (jfnj***gfd)",
  },
];

/**
 * @param {string} text
 * @returns {{ ok: boolean, reasons: string[] }}
 */
export function evaluateCommandOrSql(text) {
  const reasons = [];
  const normalized = String(text || "");

  for (const rule of RULES) {
    if (rule.pattern.test(normalized)) {
      if (rule.allow && rule.allow.test(normalized)) continue;
      reasons.push(rule.reason);
    }
  }

  return { ok: reasons.length === 0, reasons: [...new Set(reasons)] };
}

function main() {
  const args = process.argv.slice(2);
  const checkIdx = args.indexOf("--check");
  if (checkIdx === -1) {
    console.error("Usage: node scripts/safe-command-gate.mjs --check \"command\"");
    process.exit(2);
  }
  const payload = args.slice(checkIdx + 1).join(" ");
  const result = evaluateCommandOrSql(payload);
  if (result.ok) {
    console.log("OK");
    process.exit(0);
  }
  console.error("BLOCKED:", result.reasons.join("; "));
  process.exit(1);
}

import { pathToFileURL } from "node:url";

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isMainModule()) {
  main();
}
