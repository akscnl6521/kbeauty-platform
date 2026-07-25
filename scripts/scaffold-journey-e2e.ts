/**
 * Scaffold-mode automated verification for the login-gated /my/* screens
 * (check-ins, clinics, consultation-report) that a human could not click
 * through manually. Creates a throwaway, pre-confirmed Staging test user
 * via the Supabase admin API, logs in with Playwright, navigates the three
 * screens, and asserts key content actually rendered. Deletes the test
 * user afterward. Writes a JSON report under artifacts/.
 *
 * Requires a Next.js dev server already running at BASE_URL (default
 * http://localhost:3000).
 *
 * Usage: npx tsx scripts/scaffold-journey-e2e.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const STAGING_REF = "jfnjufmldiqlgvgyugfd";
const PROD_REF = "rhfrmvkjsummaylpzmns";

function loadEnvFile(name: string): Record<string, string> {
  const out: Record<string, string> = {};
  const p = path.join(ROOT, name);
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

type ScreenCheck = {
  path: string;
  label: string;
  mustContain: string[];
  ok: boolean;
  foundText: string | null;
  missing: string[];
  screenshot: string | null;
  error: string | null;
};

async function main() {
  const env = { ...loadEnvFile(".env.staging"), ...loadEnvFile(".env.local") };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("missing_supabase_credentials");
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] || "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stamp = Date.now();
  const testEmail = `scaffold-e2e-${stamp}@kbeauty-match.test`;
  const testPassword = `Scaffold-e2e-${stamp}!`;

  console.log(`[scaffold-e2e] creating test user ${testEmail}`);
  const created = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`create_user_failed: ${created.error?.message}`);
  }
  const userId = created.data.user.id;

  const outDir = path.join(ROOT, "artifacts", "scaffold-journey-e2e");
  fs.mkdirSync(outDir, { recursive: true });
  const runStamp = new Date().toISOString().replace(/[:.]/g, "-");

  const checks: ScreenCheck[] = [
    {
      path: "/my/check-ins",
      label: "체크인 화면",
      mustContain: ["체크인"],
      ok: false,
      foundText: null,
      missing: [],
      screenshot: null,
      error: null,
    },
    {
      path: "/my/clinics",
      label: "피부과 추천 화면",
      mustContain: ["피부과 추천", "샘플 서울피부과의원", "안전 필터 자리"],
      ok: false,
      foundText: null,
      missing: [],
      screenshot: null,
      error: null,
    },
    {
      path: "/my/consultation-report",
      label: "상담 리포트 화면",
      mustContain: ["상담 리포트", "주요 고민", "현재 루틴"],
      ok: false,
      foundText: null,
      missing: [],
      screenshot: null,
      error: null,
    },
  ];

  let loginOk = false;
  let loginError: string | null = null;

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.getByLabel("이메일").fill(testEmail);
      await page.getByLabel("비밀번호", { exact: true }).fill(testPassword);
      await page.getByRole("button", { name: "로그인" }).click();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1500);

      const afterLoginUrl = page.url();
      loginOk = !afterLoginUrl.includes("/login");
      if (!loginOk) {
        loginError = `still on login page after submit: ${afterLoginUrl}`;
      }

      if (loginOk) {
        for (const check of checks) {
          try {
            await page.goto(`${BASE_URL}${check.path}`, {
              waitUntil: "domcontentloaded",
              timeout: 30000,
            });
            await page.waitForTimeout(800);
            const bodyText = (await page.textContent("body")) || "";
            const missing = check.mustContain.filter((s) => !bodyText.includes(s));
            check.foundText = bodyText.replace(/\s+/g, " ").trim().slice(0, 300);
            check.missing = missing;
            check.ok = missing.length === 0;

            const shotName = `${check.path.replace(/\//g, "_")}__${runStamp}.png`;
            const shotPath = path.join(outDir, shotName);
            await page.screenshot({ path: shotPath, fullPage: true });
            check.screenshot = path.relative(ROOT, shotPath).replace(/\\/g, "/");
          } catch (err) {
            check.error = err instanceof Error ? err.message : String(err);
          }
        }
      }

      await context.close();
    } finally {
      await browser.close();
    }
  } catch (err) {
    loginError = err instanceof Error ? err.message : String(err);
  }

  console.log(`[scaffold-e2e] deleting test user ${userId}`);
  await admin.auth.admin.deleteUser(userId);

  const allOk = loginOk && checks.every((c) => c.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    stagingRef: ref,
    productionTouched: false,
    testUserDeleted: true,
    loginOk,
    loginError,
    checks,
    ok: allOk,
  };

  const reportPath = path.join(outDir, `report-${runStamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(
    path.join(outDir, "report-latest.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );

  console.log(JSON.stringify(report, null, 2));
  if (!allOk) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[scaffold-e2e] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
