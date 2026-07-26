/**
 * P2-T05 — Phase 2 final evidence package selftest.
 * Does not claim Preview/device/Dashboard/Production approval.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  HUMAN_VERIFICATION_STEPS,
  PHASE2_AUTOMATED_COMMANDS,
  PHASE2_EVIDENCE_BUCKETS,
  assertPhase2EvidenceHonesty,
  buildPhase2EvidencePackageReport,
  formatPhase2EvidenceMarkdown,
  requiredAutomatedCommandIds,
  type Phase2CommandRunResult,
} from "../src/lib/release/phase2FinalEvidencePackage";

const root = process.cwd();

function mustExist(rel: string) {
  assert.ok(existsSync(path.join(root, rel)), `expected path: ${rel}`);
}

function read(rel: string): string {
  mustExist(rel);
  return readFileSync(path.join(root, rel), "utf8");
}

assertPhase2EvidenceHonesty();

assert.equal(PHASE2_EVIDENCE_BUCKETS.length, 6, "six evidence buckets");
const bucketIds = PHASE2_EVIDENCE_BUCKETS.map((b) => b.id);
assert.deepEqual(
  bucketIds,
  [
    "automated_tests_build_routes",
    "screenshots_visual_review",
    "device_android_iphone",
    "external_source_approval",
    "dashboard_only_settings",
    "main_production_gates",
  ],
  "bucket order"
);

const autoBucket = PHASE2_EVIDENCE_BUCKETS.find(
  (b) => b.id === "automated_tests_build_routes"
);
assert.ok(autoBucket?.agentMayMarkVerified, "auto bucket may mark verified");

for (const bucket of PHASE2_EVIDENCE_BUCKETS) {
  if (bucket.id === "automated_tests_build_routes") continue;
  assert.equal(
    bucket.agentMayMarkVerified,
    false,
    `${bucket.id} must not allow agent verified claims`
  );
}

assert.ok(HUMAN_VERIFICATION_STEPS.length >= 8, "human steps");
assert.ok(
  HUMAN_VERIFICATION_STEPS.every((s) => s.onceOnly === true),
  "all human steps onceOnly"
);

const required = requiredAutomatedCommandIds();
assert.ok(required.includes("preview_routes"));
assert.ok(required.includes("staging_release_gate"));
assert.ok(required.includes("admin_review_e2e"));
assert.ok(required.includes("real_data_onboarding"));
assert.ok(required.includes("final_integration"));
assert.ok(required.includes("autopilot_queue"));
assert.ok(required.includes("release_security"));
assert.ok(required.includes("production_build"));
assert.ok(
  PHASE2_AUTOMATED_COMMANDS.every((c) => c.nodeArgs.length > 0),
  "each automated command needs nodeArgs"
);

const fixtureResults: Phase2CommandRunResult[] = PHASE2_AUTOMATED_COMMANDS.map(
  (c) => ({
    commandId: c.id,
    npmScript: c.npmScript,
    status: "pass",
    exitCode: 0,
    notesKo: "selftest fixture",
  })
);

const report = buildPhase2EvidencePackageReport(
  fixtureResults,
  "2026-07-24T00:00:00.000Z"
);
assert.equal(report.taskId, "P2-T05");
assert.equal(report.writeAttempted, false);
assert.equal(report.mainMergeAttempted, false);
assert.equal(report.productionDeployAttempted, false);
assert.equal(report.visualApprovalClaimed, false);
assert.equal(report.deviceApprovalClaimed, false);
assert.equal(report.dashboardSettingsClaimedVerified, false);
assert.equal(report.releaseReadyClaimed, false);
assert.equal(report.summary.automatedFailed, 0);
assert.equal(
  report.summary.automatedPassed,
  report.summary.automatedRequired
);
assert.ok(report.summary.externalOnlyItemCount >= 6);
assert.ok(report.summary.dashboardOnlyItemCount >= 3);
assert.ok(report.summary.blockedGateCount >= 3);

const md = formatPhase2EvidenceMarkdown(report);
assert.ok(md.includes("visualApprovalClaimed"));
assert.ok(md.includes("1회성 사람 검증"));
assert.ok(md.includes("출시 가능으로 보지 않음"));

// Path presence for Phase 2 contracts
const paths = [
  "src/lib/release/phase2FinalEvidencePackage.ts",
  "src/lib/validation/previewRouteValidation.ts",
  "src/lib/release/stagingReleaseGate.ts",
  "src/lib/admin/adminReviewE2E.ts",
  "src/lib/onboarding/realDataOnboarding/index.ts",
  "src/lib/release/finalIntegrationEvidence.ts",
  "docs/prelaunch/P2-T01_PREVIEW_ROUTE_VALIDATION.md",
  "docs/prelaunch/P2-T02_STAGING_RELEASE_GATE.md",
  "docs/prelaunch/P2-T03_ADMIN_REVIEW_E2E.md",
  "docs/prelaunch/P2-T04_REAL_DATA_ONBOARDING.md",
  "docs/prelaunch/T06_FINAL_INTEGRATION_RELEASE_EVIDENCE.md",
  "docs/prelaunch/P2-T05_FINAL_PREVIEW_EVIDENCE_PACKAGE.md",
];
for (const p of paths) mustExist(p);

const pkg = read("package.json");
assert.ok(
  pkg.includes('"test:phase2-final-evidence"'),
  "package.json must define test:phase2-final-evidence"
);
assert.ok(
  pkg.includes('"check:phase2-final-evidence"'),
  "package.json must define check:phase2-final-evidence"
);

const doc = read("docs/prelaunch/P2-T05_FINAL_PREVIEW_EVIDENCE_PACKAGE.md");
assert.ok(doc.includes("P2-T05"));
assert.ok(doc.includes("visualApprovalClaimed"));
assert.ok(doc.includes("1회성"));
assert.ok(doc.includes("main") && doc.includes("Production"));
assert.ok(
  doc.includes("출시 가능으로 보지 않"),
  "doc must state not release-ready"
);
assert.ok(
  !/출시 가능[^.]*다\./.test(doc.replace(/출시 가능으로 보지 않[^.]*\./g, "")),
  "doc must not claim release-ready affirmatively"
);

console.log("phase2-final-evidence selftest: OK");
