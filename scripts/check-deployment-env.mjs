#!/usr/bin/env node
import { loadEnvLocal } from "./load-env-local.mjs";

/**
 * 배포 환경의 값 자체를 출력하지 않고 존재 여부와 안전 규칙만 검사한다.
 * 로컬에서는 Next.js와 동일하게 .env.local을 읽되 값을 출력하지 않는다.
 */
loadEnvLocal();

const isProduction = process.env.NODE_ENV === "production";
const has = (name) => Boolean(process.env[name]?.trim());
const issues = [];
const publicUrl = has("NEXT_PUBLIC_SUPABASE_URL");
const publicAnonKey = has("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceRoleKey = has("SUPABASE_SERVICE_ROLE_KEY");
const aiProvider = process.env.AI_PROVIDER?.trim().toLowerCase() ?? "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "";

if (!publicUrl) issues.push("NEXT_PUBLIC_SUPABASE_URL is required.");
if (!publicAnonKey) issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is required.");
if (!serviceRoleKey) issues.push("SUPABASE_SERVICE_ROLE_KEY is required for admin and care worker paths.");
if (isProduction && !aiProvider) issues.push("AI_PROVIDER is required in production.");
if (isProduction && aiProvider === "mock") issues.push("AI_PROVIDER=mock is not allowed in production.");

if (isProduction && siteUrl) {
  try {
    if (["localhost", "127.0.0.1", "::1"].includes(new URL(siteUrl).hostname.toLowerCase())) {
      issues.push("Production site URL must not use localhost.");
    }
  } catch {
    issues.push("Production site URL must be a valid URL.");
  }
}

console.log(
  JSON.stringify(
    {
      hasSupabaseUrl: publicUrl,
      hasSupabaseAnonKey: publicAnonKey,
      hasServiceRoleKey: serviceRoleKey,
      hasAiProvider: Boolean(aiProvider),
      hasSiteUrl: Boolean(siteUrl.trim()),
      mode: isProduction ? "production" : "non-production",
      issues,
    },
    null,
    2
  )
);

if (issues.length) process.exit(1);
