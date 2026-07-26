/**
 * P2-T01 — Preview route validation selftest (no live Preview required).
 * Validates contract integrity, source inventory, UI markers, and result schema.
 * Does not claim visual approval.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  PREVIEW_ROUTE_CASES,
  PREVIEW_ROUTE_TASK_ID,
  PREVIEW_VIEWPORTS,
  UI_STATE_MARKERS,
  assertContractIntegrity,
  createEmptyReport,
  routesByGroup,
  screenshotRoutes,
} from "../src/lib/validation/previewRouteValidation";

const root = process.cwd();

function mustExist(rel: string) {
  assert.ok(existsSync(path.join(root, rel)), `expected path: ${rel}`);
}

const contractErrors = assertContractIntegrity();
assert.deepEqual(contractErrors, [], `contract errors: ${contractErrors.join("; ")}`);

assert.equal(PREVIEW_ROUTE_TASK_ID, "P2-T01");
assert.equal(PREVIEW_VIEWPORTS.length, 4);
assert.deepEqual(
  PREVIEW_VIEWPORTS.map((v) => v.width),
  [320, 390, 768, 1440],
);

for (const group of [
  "public",
  "analyze",
  "results",
  "routine",
  "profile_guidance",
  "admin_review",
] as const) {
  assert.ok(routesByGroup(group).length >= 1, `group ${group}`);
}

assert.ok(
  PREVIEW_ROUTE_CASES.some((r) => r.path === "/analyze"),
  "analyze route",
);
assert.ok(
  PREVIEW_ROUTE_CASES.some((r) => r.path === "/results"),
  "results route",
);
assert.ok(
  PREVIEW_ROUTE_CASES.some((r) => r.path === "/routine"),
  "routine route",
);
assert.ok(
  PREVIEW_ROUTE_CASES.some((r) => r.path === "/my/profile"),
  "profile route",
);
assert.ok(
  PREVIEW_ROUTE_CASES.some((r) => r.path === "/my/guidance"),
  "guidance route",
);
assert.ok(
  PREVIEW_ROUTE_CASES.some((r) => r.path === "/admin/review"),
  "admin review entry",
);

const myProfile = PREVIEW_ROUTE_CASES.find((r) => r.id === "my_profile");
assert.ok(myProfile);
assert.ok(myProfile!.httpUnauthenticated.locationIncludes?.includes("/login"));

const adminReview = PREVIEW_ROUTE_CASES.find((r) => r.id === "admin_review");
assert.ok(adminReview);
assert.ok(
  adminReview!.httpUnauthenticated.locationIncludes?.includes("/admin/login"),
);

for (const route of PREVIEW_ROUTE_CASES) {
  mustExist(route.sourceFile);
}

for (const marker of UI_STATE_MARKERS) {
  mustExist(marker.file);
  const text = readFileSync(path.join(root, marker.file), "utf8");
  for (const needle of marker.needles) {
    assert.ok(
      text.includes(needle),
      `${marker.id} missing needle in ${marker.file}: ${needle}`,
    );
  }
}

assert.ok(screenshotRoutes().length >= 5, "screenshot targets");

const report = createEmptyReport();
assert.equal(report.visualApprovalClaimed, false);
assert.equal(report.taskId, "P2-T01");
assert.ok(report.notes.some((n) => /visual|approval|육안|evidence/i.test(n) || n.includes("approval")));

// Runner + docs + package script presence
mustExist("scripts/run-preview-route-validation.ts");
mustExist("docs/prelaunch/P2-T01_PREVIEW_ROUTE_VALIDATION.md");

const pkg = readFileSync(path.join(root, "package.json"), "utf8");
assert.ok(pkg.includes('"test:preview-routes"'), "package.json test:preview-routes");
assert.ok(pkg.includes('"check:preview-routes"'), "package.json check:preview-routes");

// Smoke reuse: smoke still lists core public routes
mustExist("scripts/smoke-test.mjs");
const smoke = readFileSync(path.join(root, "scripts/smoke-test.mjs"), "utf8");
assert.ok(smoke.includes('"/analyze"'), "smoke keeps analyze");
assert.ok(smoke.includes('"/my"'), "smoke keeps my auth redirect");

console.log("preview-route-validation selftest: OK");
