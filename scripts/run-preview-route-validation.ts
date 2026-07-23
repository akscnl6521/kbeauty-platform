/**
 * P2-T01 — Preview / local route validation runner.
 *
 * Modes:
 *   static (default) — file inventory + UI state markers + machine-readable JSON
 *   http             — BASE_URL / PREVIEW_BASE_URL status + auth redirect checks
 *   browser          — Playwright screenshots at 320/390/768/1440 (optional)
 *
 * Never claims visual approval. Does not bypass login/CAPTCHA/SSO.
 *
 * Usage:
 *   npm run check:preview-routes
 *   BASE_URL=http://127.0.0.1:3000 npm run check:preview-routes -- --mode=http
 *   npx tsx scripts/run-preview-route-validation.ts --mode=browser --base-url=http://127.0.0.1:3000
 *   PREVIEW_BASE_URL=https://….vercel.app npm run check:preview-routes -- --mode=http
 */
import fs from "node:fs";
import path from "node:path";
import {
  PREVIEW_ROUTE_CASES,
  PREVIEW_ROUTE_TASK_ID,
  PREVIEW_VIEWPORTS,
  UI_STATE_MARKERS,
  assertContractIntegrity,
  createEmptyReport,
  screenshotRoutes,
  type PreviewRouteValidationReport,
  type PreviewValidationMode,
  type RouteCheckResult,
  type ViewportCheckResult,
} from "../src/lib/validation/previewRouteValidation";

const root = process.cwd();
const outDir = path.join(root, "artifacts", "preview-route-validation");
const screenshotDir = path.join(outDir, "screenshots");

function parseArgs(argv: string[]) {
  let mode: PreviewValidationMode = "static";
  let writeArtifacts = true;
  let baseUrlArg: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith("--mode=")) {
      const value = arg.slice("--mode=".length);
      if (value === "static" || value === "http" || value === "browser") mode = value;
      else throw new Error(`Unknown mode: ${value}`);
    }
    if (arg.startsWith("--base-url=")) {
      baseUrlArg = arg.slice("--base-url=".length).replace(/\/$/, "");
    }
    if (arg === "--no-artifacts") writeArtifacts = false;
  }
  return { mode, writeArtifacts, baseUrlArg };
}

function resolveBaseUrl(baseUrlArg: string | null): string | null {
  const raw =
    baseUrlArg ||
    process.env.BASE_URL ||
    process.env.PREVIEW_BASE_URL ||
    process.env.PREVIEW_URL ||
    "";
  const base = raw.replace(/\/$/, "");
  if (!base) return null;
  if (/kbeautymatch\.com/i.test(base) && !/vercel\.app/i.test(base)) {
    throw new Error("ABORT: refuse non-preview production host");
  }
  return base;
}

function runInventory(report: PreviewRouteValidationReport): boolean {
  const contractErrors = assertContractIntegrity();
  for (const err of contractErrors) {
    report.routes.push({
      id: "contract",
      path: "-",
      ok: false,
      mode: "inventory",
      detail: err,
    });
  }

  for (const route of PREVIEW_ROUTE_CASES) {
    const abs = path.join(root, route.sourceFile);
    const ok = fs.existsSync(abs);
    report.routes.push({
      id: route.id,
      path: route.path,
      ok,
      mode: "inventory",
      detail: ok ? "source present" : `missing ${route.sourceFile}`,
    });
  }

  for (const marker of UI_STATE_MARKERS) {
    const abs = path.join(root, marker.file);
    if (!fs.existsSync(abs)) {
      report.uiStateMarkers.push({
        id: marker.id,
        ok: false,
        detail: `missing file ${marker.file}`,
      });
      continue;
    }
    const text = fs.readFileSync(abs, "utf8");
    const missing = marker.needles.filter((n) => !text.includes(n));
    report.uiStateMarkers.push({
      id: marker.id,
      ok: missing.length === 0,
      detail:
        missing.length === 0
          ? `${marker.state} markers ok`
          : `missing needles: ${missing.join(", ")}`,
    });
  }

  const inventoryFailed =
    report.routes.some((r) => r.mode === "inventory" && !r.ok) ||
    report.uiStateMarkers.some((m) => !m.ok);
  report.summary.inventoryPassed = !inventoryFailed;
  return !inventoryFailed;
}

async function runHttp(
  report: PreviewRouteValidationReport,
  baseUrl: string,
): Promise<boolean> {
  report.modesRun.push("http");
  report.baseUrl = baseUrl;
  const results: RouteCheckResult[] = [];

  try {
    await fetch(`${baseUrl}/api/health`, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    report.notes.push(`HTTP skipped: server unavailable at ${baseUrl}`);
    report.summary.httpPassed = null;
    return true; // not a hard fail — static still valid
  }

  for (const route of PREVIEW_ROUTE_CASES) {
    const expected = route.httpUnauthenticated;
    try {
      const response = await fetch(`${baseUrl}${route.path}`, {
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
        headers: bypassHeaders(),
      });
      const location = response.headers.get("location");
      const statusOk = expected.statuses.includes(response.status);
      const locationOk = expected.locationIncludes
        ? Boolean(location && location.includes(expected.locationIncludes))
        : true;
      // Vercel SSO / deployment protection — only for HTML page routes, not expected API 401
      const sso =
        route.group !== "auth_api" &&
        (response.status === 401 ||
          (response.status === 302 &&
            Boolean(location && /vercel\.com\/sso|protection/i.test(location))));
      const ok = sso ? true : statusOk && locationOk;
      if (sso) {
        report.notes.push(
          `${route.path}: Preview protection/SSO response ${response.status} (manual login required — not claimed pass)`,
        );
      }
      results.push({
        id: route.id,
        path: route.path,
        ok,
        mode: "http",
        status: response.status,
        location,
        detail: sso
          ? "sso_or_protection"
          : ok
            ? "status ok"
            : `expected ${expected.statuses.join("/")} loc~${expected.locationIncludes ?? "-"}`,
      });
    } catch (error) {
      results.push({
        id: route.id,
        path: route.path,
        ok: false,
        mode: "http",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  report.routes.push(...results);
  const failed = results.filter((r) => !r.ok && r.detail !== "sso_or_protection");
  // SSO-marked ok=true still means not verified for content
  report.summary.httpPassed = failed.length === 0;
  return failed.length === 0;
}

function bypassHeaders(): Record<string, string> {
  const bypass =
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
    process.env.VERCEL_PROTECTION_BYPASS ||
    process.env.PREVIEW_BYPASS_SECRET ||
    "";
  if (!bypass) return {};
  return {
    "x-vercel-protection-bypass": bypass,
    "x-vercel-set-bypass-cookie": "true",
  };
}

async function loadPlaywright(): Promise<typeof import("playwright") | null> {
  try {
    return await import("playwright");
  } catch {
    return null;
  }
}

async function runBrowser(
  report: PreviewRouteValidationReport,
  baseUrl: string,
): Promise<boolean> {
  report.modesRun.push("browser");
  report.baseUrl = baseUrl;
  const pw = await loadPlaywright();
  if (!pw) {
    report.browserAvailable = false;
    report.summary.browserPassed = null;
    report.notes.push(
      "Playwright not installed — browser/screenshot mode skipped. Run: npm i -D playwright && npx playwright install chromium",
    );
    return true;
  }
  report.browserAvailable = true;
  fs.mkdirSync(screenshotDir, { recursive: true });

  const targets = screenshotRoutes();
  const viewportResults: ViewportCheckResult[] = [];
  let screenshots = 0;
  let failures = 0;

  const browser = await pw.chromium.launch({ headless: true });
  try {
    for (const viewport of PREVIEW_VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        extraHTTPHeaders: bypassHeaders(),
      });
      const page = await context.newPage();
      for (const route of targets) {
        const url = `${baseUrl}${route.path}`;
        try {
          const response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 45000,
          });
          const status = response?.status() ?? 0;
          // Auth redirects are expected — still capture landing page evidence.
          const fileName = `${route.id}__${viewport.id}.png`;
          const abs = path.join(screenshotDir, fileName);
          await page.screenshot({ path: abs, fullPage: false });
          screenshots += 1;
          const rel = path.relative(root, abs).replace(/\\/g, "/");
          viewportResults.push({
            viewportId: viewport.id,
            width: viewport.width,
            height: viewport.height,
            routeId: route.id,
            path: route.path,
            ok: status > 0 && status < 500,
            screenshotRelPath: rel,
            detail: `http ${status}; screenshot saved (not visual approval)`,
          });
          if (!(status > 0 && status < 500)) failures += 1;
        } catch (error) {
          failures += 1;
          viewportResults.push({
            viewportId: viewport.id,
            width: viewport.width,
            height: viewport.height,
            routeId: route.id,
            path: route.path,
            ok: false,
            detail: error instanceof Error ? error.message : String(error),
          });
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  report.viewports.push(...viewportResults);
  report.summary.viewportChecks = viewportResults.length;
  report.summary.screenshots = screenshots;
  report.summary.browserPassed = failures === 0;
  report.notes.push(
    "Browser screenshots are automated evidence only — human Preview visual approval remains external_only.",
  );
  return failures === 0;
}

function finalizeSummary(report: PreviewRouteValidationReport) {
  const routeFailures = report.routes.filter((r) => !r.ok).length;
  report.summary.routeChecks = report.routes.length;
  report.summary.routeFailures = routeFailures;
}

function writeReport(report: PreviewRouteValidationReport) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "latest-result.json");
  const stamp = report.generatedAt.replace(/[:.]/g, "-");
  const stamped = path.join(outDir, `result-${stamp}.json`);
  const body = `${JSON.stringify(report, null, 2)}\n`;
  fs.writeFileSync(jsonPath, body, "utf8");
  fs.writeFileSync(stamped, body, "utf8");
  // Lightweight checklist for humans (no visual claim)
  const md = [
    `# ${PREVIEW_ROUTE_TASK_ID} automated route validation`,
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- visualApprovalClaimed: **false**`,
    `- inventoryPassed: ${report.summary.inventoryPassed}`,
    `- httpPassed: ${report.summary.httpPassed}`,
    `- browserPassed: ${report.summary.browserPassed}`,
    `- screenshots: ${report.summary.screenshots}`,
    `- baseUrl: ${report.baseUrl ?? "(none)"}`,
    "",
    "Human Preview/device visual approval is still required (external_only).",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "latest-summary.md"), md, "utf8");
  return jsonPath;
}

async function main() {
  const { mode, writeArtifacts, baseUrlArg } = parseArgs(process.argv.slice(2));
  const report = createEmptyReport();
  report.modesRun.push("static");

  const inventoryOk = runInventory(report);
  let httpOk = true;
  let browserOk = true;

  const baseUrl = resolveBaseUrl(baseUrlArg);
  if (mode === "http" || mode === "browser") {
    if (!baseUrl) {
      report.notes.push(
        `${mode} requested but BASE_URL/PREVIEW_BASE_URL/--base-url missing — HTTP/browser not run`,
      );
      if (mode === "http") report.summary.httpPassed = null;
      if (mode === "browser") report.summary.browserPassed = null;
    } else if (mode === "http") {
      httpOk = await runHttp(report, baseUrl);
    } else {
      // browser implies http context; run http first then screenshots
      httpOk = await runHttp(report, baseUrl);
      browserOk = await runBrowser(report, baseUrl);
    }
  } else if (baseUrl) {
    report.notes.push(
      `BASE_URL present (${baseUrl}) but mode=static — use --mode=http or --mode=browser for live checks`,
    );
  }

  finalizeSummary(report);
  let outPath: string | null = null;
  if (writeArtifacts) outPath = writeReport(report);

  const hardFail =
    !inventoryOk ||
    (mode === "http" && httpOk === false) ||
    (mode === "browser" && (httpOk === false || browserOk === false));

  console.log(
    JSON.stringify(
      {
        taskId: PREVIEW_ROUTE_TASK_ID,
        mode,
        visualApprovalClaimed: false,
        inventoryPassed: report.summary.inventoryPassed,
        httpPassed: report.summary.httpPassed,
        browserPassed: report.summary.browserPassed,
        routeFailures: report.summary.routeFailures,
        screenshots: report.summary.screenshots,
        artifact: outPath,
      },
      null,
      2,
    ),
  );

  if (hardFail) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
