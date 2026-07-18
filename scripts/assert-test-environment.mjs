#!/usr/bin/env node

const failures = [];
const environment = (process.env.TEST_ENVIRONMENT ?? "").trim().toLowerCase();
const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
const vercelEnv = (process.env.VERCEL_ENV ?? "").trim().toLowerCase();

if (!["ci", "local", "staging"].includes(environment)) {
  failures.push("TEST_ENVIRONMENT must be ci, local, or staging.");
}
if (nodeEnv === "production" || vercelEnv === "production") {
  failures.push("Automated tests must not run with a production runtime environment.");
}

for (const key of [
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL_NON_POOLING",
]) {
  if (process.env[key]?.trim()) {
    failures.push(`${key} must be unset for automated repository checks.`);
  }
}

if (environment === "ci") {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]) {
    const value = process.env[key]?.trim();
    if (!value) continue;
    let host;
    try {
      host = new URL(value).hostname.toLowerCase();
    } catch {
      failures.push(`${key} must be a valid URL when set.`);
      continue;
    }
    const safe =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "example.supabase.co" ||
      host.endsWith(".example.com");
    if (!safe) failures.push(`${key} must use a local or placeholder host in CI; received ${host}.`);
  }
}

if (failures.length) {
  console.error(["[test-safety] blocked", ...failures.map((failure) => `- ${failure}`)].join("\n"));
  process.exit(1);
}

console.log(`[test-safety] safe ${environment} environment confirmed; database write credentials are absent`);
