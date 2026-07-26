/**
 * Scaffold-mode automated verification for the login-gated screens a human
 * could not click through manually: /my/check-ins, /my/clinics,
 * /my/consultation-report (fresh throwaway customer account) and
 * /admin/discovery (fixed, human-bootstrapped admin account).
 *
 * Customer checks use a fresh Staging test user via the regular signUp flow
 * (works now that Staging Auth email auto-confirm is enabled). The admin
 * check uses a FIXED account whose admin_users(reviewer) row was bootstrapped
 * by a human directly in the Supabase Dashboard SQL editor (see
 * docs/47-admin-auth-migration-review.md §8) — service_role cannot INSERT
 * into admin_users itself (permission denied by design), and the Admin API
 * (auth.admin.createUser/listUsers/deleteUser) is broken for this project's
 * newer-format service_role key, so neither path can be automated here.
 *
 * Requires a Next.js dev server already running at BASE_URL (default
 * http://localhost:3000) and FIXED_ADMIN_EMAIL / FIXED_ADMIN_PASSWORD env
 * vars for the already-bootstrapped admin account.
 *
 * Usage: FIXED_ADMIN_EMAIL=... FIXED_ADMIN_PASSWORD=... npx tsx scripts/scaffold-journey-e2e.ts
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
  loginAs: "customer" | "admin";
  mustContain: string[];
  ok: boolean;
  foundText: string | null;
  missing: string[];
  screenshot: string | null;
  error: string | null;
};

async function loginAndCheck(
  chromium: typeof import("playwright").chromium,
  outDir: string,
  runStamp: string,
  loginPath: string,
  email: string,
  password: string,
  checks: ScreenCheck[]
): Promise<{ loginOk: boolean; loginError: string | null }> {
  const browser = await chromium.launch({ headless: true });
  let loginOk = false;
  let loginError: string | null = null;
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}${loginPath}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.getByLabel("이메일").fill(email);
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByRole("button", { name: "로그인" }).click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);

    const afterLoginUrl = page.url();
    loginOk = !afterLoginUrl.includes("login");
    if (!loginOk) loginError = `still on login page after submit: ${afterLoginUrl}`;

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
  return { loginOk, loginError };
}

async function main() {
  const env = { ...loadEnvFile(".env.staging"), ...loadEnvFile(".env.local") };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("missing_supabase_credentials");
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] || "";
  if (ref === PROD_REF) throw new Error("ABORT_PRODUCTION");
  if (ref !== STAGING_REF) throw new Error(`ABORT_NOT_STAGING:${ref}`);

  const fixedAdminEmail = process.env.FIXED_ADMIN_EMAIL;
  const fixedAdminPassword = process.env.FIXED_ADMIN_PASSWORD;
  if (!fixedAdminEmail || !fixedAdminPassword) {
    throw new Error(
      "missing_fixed_admin_credentials: set FIXED_ADMIN_EMAIL / FIXED_ADMIN_PASSWORD for the already-bootstrapped admin_users(reviewer) account"
    );
  }

  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const stamp = Date.now();
  const testEmail = `scaffold-e2e-${stamp}@kbeauty-match-test.com`;
  const testPassword = `Scaffold-e2e-${stamp}!`;

  console.log(`[scaffold-e2e] signing up throwaway customer test user ${testEmail}`);
  const signUp = await anon.auth.signUp({ email: testEmail, password: testPassword });
  if (signUp.error || !signUp.data.user) {
    throw new Error(`signup_failed: ${signUp.error?.message}`);
  }
  if (!signUp.data.session) {
    throw new Error(
      "signup_no_session: email confirmation still required — auto-confirm may not be enabled yet"
    );
  }

  const outDir = path.join(ROOT, "artifacts", "scaffold-journey-e2e");
  fs.mkdirSync(outDir, { recursive: true });
  const runStamp = new Date().toISOString().replace(/[:.]/g, "-");

  const customerChecks: ScreenCheck[] = [
    {
      path: "/my/check-ins",
      label: "체크인 화면",
      loginAs: "customer",
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
      loginAs: "customer",
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
      loginAs: "customer",
      mustContain: ["상담 리포트", "주요 고민", "현재 루틴"],
      ok: false,
      foundText: null,
      missing: [],
      screenshot: null,
      error: null,
    },
  ];

  const adminChecks: ScreenCheck[] = [
    {
      path: "/admin/discovery",
      label: "관리자 제품 발견 후보 화면",
      loginAs: "admin",
      mustContain: ["제품 발견 후보", "workflow status"],
      ok: false,
      foundText: null,
      missing: [],
      screenshot: null,
      error: null,
    },
  ];

  let customerLoginOk = false;
  let customerLoginError: string | null = null;
  let adminLoginOk = false;
  let adminLoginError: string | null = null;

  try {
    const { chromium } = await import("playwright");

    const customerResult = await loginAndCheck(
      chromium,
      outDir,
      runStamp,
      "/login",
      testEmail,
      testPassword,
      customerChecks
    );
    customerLoginOk = customerResult.loginOk;
    customerLoginError = customerResult.loginError;

    const adminResult = await loginAndCheck(
      chromium,
      outDir,
      runStamp,
      "/admin/login",
      fixedAdminEmail,
      fixedAdminPassword,
      adminChecks
    );
    adminLoginOk = adminResult.loginOk;
    adminLoginError = adminResult.loginError;
  } catch (err) {
    customerLoginError = customerLoginError ?? (err instanceof Error ? err.message : String(err));
  }

  console.log(
    `[scaffold-e2e] NOTE: throwaway customer auth.users row (${testEmail}) is left in Staging — ` +
      "Admin API (deleteUser) is unavailable with this project's service_role key format."
  );

  const allChecks = [...customerChecks, ...adminChecks];
  const allOk = customerLoginOk && adminLoginOk && allChecks.every((c) => c.ok);

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    stagingRef: ref,
    productionTouched: false,
    testCustomerEmail: testEmail,
    testCustomerDeleted: false,
    testCustomerDeletionNote:
      "Admin API unavailable for this key format — auth.users row left in Staging (disposable test data, not Production).",
    fixedAdminAccountUsed: true,
    customerLoginOk,
    customerLoginError,
    adminLoginOk,
    adminLoginError,
    checks: allChecks,
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
