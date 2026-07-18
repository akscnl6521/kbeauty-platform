#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.BASE_URL?.replace(/\/$/, "");
const mode = process.env.SMOKE_MODE ?? (baseUrl ? "http" : "static");
const failures = [];

const staticRoutes = {
  "/": "src/app/page.tsx",
  "/analyze": "src/app/analyze/page.tsx",
  "/results": "src/app/results/page.tsx",
  "/quiz/mascara": "src/app/quiz/mascara/page.tsx",
  "/quiz/hair": "src/app/quiz/hair/page.tsx",
  "/login": "src/app/login/page.tsx",
  "/signup": "src/app/signup/page.tsx",
  "/forgot-password": "src/app/forgot-password/page.tsx",
  "/reset-password": "src/app/reset-password/page.tsx",
  "/auth/error": "src/app/auth/error/page.tsx",
  "/privacy": "src/app/privacy/page.tsx",
  "/terms": "src/app/terms/page.tsx",
  "/ingredients": "src/app/ingredients/page.tsx",
  "/sitemap.xml": "src/app/sitemap.ts",
  "/my": "src/app/my/page.tsx",
  "/onboarding": "src/app/onboarding/page.tsx",
  "/api/admin/dashboard": "src/app/api/admin/dashboard/route.ts",
  "/api/care/dashboard": "src/app/api/care/dashboard/route.ts",
  "/api/health": "src/app/api/health/route.ts",
  "/api/analyze": "src/app/api/analyze/route.ts",
  "/auth/callback": "src/app/auth/callback/route.ts",
};

function runStatic() {
  for (const [route, file] of Object.entries(staticRoutes)) {
    if (!fs.existsSync(path.join(root, file))) failures.push(`${route}: missing ${file}`);
  }

  const home = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
  if (!home.includes('href="/analyze"')) failures.push("home: missing analyze CTA href");
  if (!home.includes("피부 분석 시작하기")) failures.push("home: missing primary CTA label");

  const analyze = fs.readFileSync(path.join(root, "src/app/analyze/page.tsx"), "utf8");
  if (!analyze.includes("AI 분석 시작")) failures.push("analyze: missing start analysis CTA");
  if (!analyze.includes("navigateToResults") && !analyze.includes("/results")) {
    failures.push("analyze: missing results navigation");
  }

  const results = fs.readFileSync(path.join(root, "src/app/results/page.tsx"), "utf8");
  for (const needle of ["나를 위한 핵심 추천 제품", "RecommendedProductCard", "내 피부 관리"]) {
    if (!results.includes(needle)) failures.push(`results: missing ${needle}`);
  }

  if (failures.length) throw new Error(failures.join("\n"));
  console.log(`[smoke] static route inventory passed (${Object.keys(staticRoutes).length} routes)`);
}

async function request(route, expected) {
  const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
  if (!expected.includes(response.status)) {
    failures.push(`${route}: expected ${expected.join("/")} but received ${response.status}`);
  }
  return response;
}

async function runHttp() {
  if (!baseUrl) throw new Error("BASE_URL is required when SMOKE_MODE=http.");
  try {
    await fetch(`${baseUrl}/api/health`, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(5000) });
  } catch {
    console.log(`[smoke] server unavailable at ${baseUrl}; static inventory mode used.`);
    runStatic();
    return;
  }

  for (const route of [
    "/",
    "/analyze",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/auth/error",
    "/privacy",
    "/terms",
    "/ingredients",
    "/sitemap.xml",
    "/api/health",
  ]) {
    await request(route, [200]);
  }
  await request("/my", [302, 303, 307, 308]);
  await request("/onboarding", [302, 303, 307, 308]);
  await request("/api/admin/dashboard", [401]);
  await request("/api/care/dashboard", [401]);
  await request("/api/analyze", [405]);

  const callback = await request("/auth/callback?next=https%3A%2F%2Fevil.com", [302, 303, 307, 308]);
  const location = callback.headers.get("location");
  if (location && /^https?:\/\/evil\.com(?:\/|$)/i.test(location)) {
    failures.push("/auth/callback: external redirect was returned");
  }

  if (failures.length) throw new Error(failures.join("\n"));
  console.log(`[smoke] HTTP checks passed against ${baseUrl}`);
}

if (mode === "static") runStatic();
else if (mode === "http") await runHttp();
else throw new Error("SMOKE_MODE must be static or http.");
