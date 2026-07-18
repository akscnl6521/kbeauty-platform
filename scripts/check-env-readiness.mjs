#!/usr/bin/env node
/**
 * Phase E — environment readiness (presence only, never print secret values).
 * npm run check:env-readiness
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = "rhfrmvkjsummaylpzmns";
const STAGING = "jfnjufmldiqlgvgyugfd";

function loadEnvLocal() {
  const p = path.join(root, ".env.local");
  if (!existsSync(p)) return { loaded: false };
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
  return { loaded: true };
}

function present(name) {
  const v = process.env[name];
  return Boolean(v && String(v).trim());
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
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "";
const ai = (process.env.AI_PROVIDER || "").trim().toLowerCase();

const vars = [
  { name: "AI_PROVIDER", scope: "REQUIRED_PROD", present: present("AI_PROVIDER") },
  {
    name: "NEXT_PUBLIC_SITE_URL",
    scope: "REQUIRED_PROD",
    present: present("NEXT_PUBLIC_SITE_URL") || present("SITE_URL"),
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    scope: "REQUIRED",
    present: present("NEXT_PUBLIC_SUPABASE_URL"),
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    scope: "REQUIRED",
    present: present("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    scope: "OPTIONAL_LOCAL_SERVER",
    present: present("SUPABASE_SERVICE_ROLE_KEY"),
  },
  {
    name: "CARE_EMAIL_PROVIDER",
    scope: "OPTIONAL",
    present: present("CARE_EMAIL_PROVIDER"),
  },
  { name: "RESEND_API_KEY", scope: "OPTIONAL", present: present("RESEND_API_KEY") },
  { name: "SMTP_HOST", scope: "OPTIONAL", present: present("SMTP_HOST") },
  { name: "OPENAI_API_KEY", scope: "OPTIONAL", present: present("OPENAI_API_KEY") },
  {
    name: "ANTHROPIC_API_KEY",
    scope: "OPTIONAL",
    present: present("ANTHROPIC_API_KEY"),
  },
  {
    name: "VERCEL_CRON_SECRET",
    scope: "OPTIONAL",
    present: present("VERCEL_CRON_SECRET"),
  },
];

const findings = [];
const blockers = [];

if (ai === "mock") {
  blockers.push({
    code: "AI_PROVIDER_MOCK",
    severity: "PRODUCTION_BLOCKER",
    note: "AI_PROVIDER=mock is forbidden for Production",
  });
}

if (present("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")) {
  blockers.push({
    code: "SERVICE_ROLE_PUBLIC_PREFIX",
    severity: "PRODUCTION_BLOCKER",
    note: "service role must never use NEXT_PUBLIC_ prefix",
  });
}

if (ref === PROD) {
  findings.push({
    code: "LOCAL_ENV_POINTS_AT_PRODUCTION_REF",
    severity: "WRONG_SCOPE_SUSPECTED",
    note: "Local .env URL host matches Production ref — DB write scripts must stay blocked",
  });
}

if (ref && ref !== PROD && ref !== STAGING) {
  findings.push({
    code: "UNKNOWN_SUPABASE_REF",
    severity: "WARN",
    note: "URL ref is neither known Production nor Staging constant",
  });
}

if (!siteUrl) {
  findings.push({
    code: "SITE_URL_MISSING_LOCAL",
    severity: "WARN",
    note: "NEXT_PUBLIC_SITE_URL missing locally — Production dashboard must set canonical domain",
  });
} else if (/vercel\.app/i.test(siteUrl) || /localhost/i.test(siteUrl)) {
  findings.push({
    code: "SITE_URL_PREVIEW_OR_LOCAL",
    severity: "WRONG_SCOPE_SUSPECTED",
    note: "SITE_URL looks like preview/local — Production must use real domain",
  });
}

const report = {
  phase: "environment_readiness",
  generatedAt: new Date().toISOString(),
  secretsPrinted: false,
  refs: {
    productionConstant: PROD,
    stagingConstant: STAGING,
    localUrlRefHint: ref ? `${ref.slice(0, 4)}…` : null,
    isProdRef: ref === PROD,
    isStagingRef: ref === STAGING,
  },
  variables: vars.map((v) => ({
    ...v,
    status: v.present ? "PRESENT" : "MISSING",
  })),
  findings,
  blockers,
  verdict:
    blockers.length === 0
      ? "LOCAL_OK_WITH_MANUAL_PROD_CHECKS"
      : "HAS_PRODUCTION_BLOCKERS_IF_DEPLOYED_AS_IS",
};

writeFileSync(
  path.join(root, "reports", "environment-readiness.json"),
  JSON.stringify(report, null, 2) + "\n"
);

const md = [
  "# ENVIRONMENT_READINESS.md",
  "",
  `생성: ${report.generatedAt}`,
  "",
  "**비밀키 값은 기록하지 않음.**",
  "",
  `판정: **${report.verdict}**`,
  "",
  "## 변수 존재 여부",
  "",
  "| 변수 | 범위 | 상태 |",
  "|------|------|------|",
  ...report.variables.map(
    (v) => `| \`${v.name}\` | ${v.scope} | ${v.status} |`
  ),
  "",
  "## Findings",
  "",
  ...(findings.length
    ? findings.map((f) => `- **${f.severity}** \`${f.code}\`: ${f.note}`)
    : ["- (없음)"]),
  "",
  "## Production blockers (if deployed with current local semantics)",
  "",
  ...(blockers.length
    ? blockers.map((b) => `- **${b.severity}** \`${b.code}\`: ${b.note}`)
    : ["- 로컬에서 AI_PROVIDER=mock / NEXT_PUBLIC service role 은 감지되지 않음"]),
  "",
  "## 수동 확인 (대시보드)",
  "",
  "- Vercel Production `AI_PROVIDER` ≠ mock",
  "- `NEXT_PUBLIC_SITE_URL` = 실제 도메인",
  "- Supabase Auth Site URL / Redirect URL",
  "- Staging vs Production ref 혼동 금지",
  "",
];

writeFileSync(path.join(root, "docs", "ENVIRONMENT_READINESS.md"), md.join("\n"));
console.log(
  JSON.stringify(
    {
      phase: report.phase,
      verdict: report.verdict,
      blockers: blockers.map((b) => b.code),
      findings: findings.map((f) => f.code),
      presentCount: vars.filter((v) => v.present).length,
      missingCount: vars.filter((v) => !v.present).length,
    },
    null,
    2
  )
);
