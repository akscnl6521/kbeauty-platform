/**
 * P3-T05 Integrated Staging import package selftest.
 * Fixture/dry-run only — never claims Staging import executed or Production writes.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  STAGING_IMPORT_AUTOMATED_COMMANDS,
  STAGING_IMPORT_PACKAGE_TASK_ID,
  UPSTREAM_TASK_IDS,
  assertNoStagingImportOrProductionWrite,
  assertStagingImportHonesty,
  buildStagingHumanReviewSteps,
  buildStagingImportHumanReviewPackage,
  formatStagingImportHumanReviewMarkdown,
  requiredAutomatedCommandIds,
  runFixtureStagingImportPackage,
  runStagingImportPackage,
  type StagingImportCommandRunResult,
} from "../src/lib/onboarding/stagingImportPackage";

const root = process.cwd();

function mustExist(rel: string) {
  assert.ok(existsSync(path.join(root, rel)), `expected path: ${rel}`);
}

function read(rel: string): string {
  mustExist(rel);
  return readFileSync(path.join(root, rel), "utf8");
}

async function main() {
  assert.equal(STAGING_IMPORT_PACKAGE_TASK_ID, "P3-T05");
  assert.ok(UPSTREAM_TASK_IDS.includes("P3-T01"));
  assert.ok(UPSTREAM_TASK_IDS.includes("T07-05"));
  assert.ok(UPSTREAM_TASK_IDS.includes("P3-T04"));

  const fixture = runFixtureStagingImportPackage();
  assertNoStagingImportOrProductionWrite(fixture);
  assert.equal(fixture.taskId, "P3-T05");
  assert.equal(fixture.mode, "fixture");
  assert.equal(fixture.publishAllowed, false);
  assert.equal(fixture.publicVisible, false);
  assert.equal(fixture.stagingImportExecuted, false);
  assert.equal(fixture.writeAttempted, false);
  assert.equal(fixture.databaseTouched, false);
  assert.ok(fixture.totals.productRows >= 4);
  assert.ok(fixture.totals.clinicRows >= 3);
  assert.ok(fixture.totals.fixtureCount === fixture.rows.length);
  assert.equal(fixture.totals.structurallyStagingImportEligible, 0);
  assert.ok(fixture.rows.every((r) => r.isFixture));
  assert.ok(fixture.rows.every((r) => !r.structurallyStagingImportEligible));
  assert.ok(fixture.rows.every((r) => r.publicVisible === false));
  assert.ok(fixture.audit.ok);
  assert.equal(fixture.sections.length, 10);
  assert.ok(
    fixture.commercialIndependence.organicOrderUnchanged,
    "organic order",
  );
  assert.ok(
    fixture.commercialIndependence.stagingEligibilityIgnoresPaidLane,
    "paid lane independence",
  );
  assert.ok(fixture.csvSummary.includes("importId"));
  assert.ok(fixture.humanReviewSteps.length >= 6);
  assert.ok(
    fixture.humanReviewSteps.every((s) => s.onceOnly && s.productionForbidden),
  );

  // Duplicates / rejections / refresh present
  assert.ok(fixture.rows.some((r) => r.isDuplicate));
  assert.ok(fixture.rows.some((r) => r.rejectionReasons.length > 0));
  assert.ok(fixture.rows.some((r) => r.refreshStatus === "stale"));
  assert.ok(
    fixture.rows.some(
      (r) =>
        r.commercialLane === "affiliate" || r.commercialLane === "sponsored",
    ),
  );

  // Dry-run structural positive path (memory-only, still not executed)
  const dry = runStagingImportPackage({
    mode: "dry_run",
    now: "2026-07-24T12:00:00.000Z",
  });
  assertNoStagingImportOrProductionWrite(dry);
  assert.ok(dry.totals.structurallyStagingImportEligible >= 2);
  assert.ok(
    dry.rows.some(
      (r) =>
        !r.isFixture &&
        r.structurallyStagingImportEligible &&
        r.lane === "product",
    ),
  );
  assert.ok(
    dry.rows.some(
      (r) =>
        !r.isFixture &&
        r.structurallyStagingImportEligible &&
        r.lane === "clinic",
    ),
  );
  assert.ok(
    dry.rows
      .filter(
        (r) =>
          r.commercialLane === "affiliate" || r.commercialLane === "sponsored",
      )
      .every((r) => r.structurallyStagingImportEligible === false),
  );

  // live_blocked must throw
  assert.throws(
    () => runStagingImportPackage({ mode: "live_blocked" }),
    /live_blocked/,
  );

  const steps = buildStagingHumanReviewSteps();
  assert.ok(
    steps.some((s) => s.id === "HUMAN-P3-T05-STAGING-IMPORT-APPROVAL"),
  );
  assert.ok(steps.some((s) => s.stagingImport === true));

  const required = requiredAutomatedCommandIds();
  assert.ok(required.includes("staging_import_package"));
  assert.ok(required.includes("release_security"));
  assert.ok(required.includes("production_build"));
  assert.ok(required.includes("commercial_separation"));
  assert.ok(required.length >= 10);
  assert.ok(
    STAGING_IMPORT_AUTOMATED_COMMANDS.every((c) => c.nodeArgs.length > 0),
  );

  const skippedResults: StagingImportCommandRunResult[] =
    STAGING_IMPORT_AUTOMATED_COMMANDS.filter((c) => c.requiredForGate).map(
      (c) => ({
        commandId: c.id,
        npmScript: c.npmScript,
        status: "skipped" as const,
        exitCode: null,
        notesKo: "selftest structure-only",
      }),
    );
  const humanPkg = buildStagingImportHumanReviewPackage(
    skippedResults,
    fixture,
    "2026-07-24T12:00:00.000Z",
  );
  assertStagingImportHonesty(fixture);
  assert.equal(humanPkg.stagingImportApprovalClaimed, false);
  assert.equal(humanPkg.mainMergeAttempted, false);
  assert.equal(humanPkg.productionDeployAttempted, false);
  const md = formatStagingImportHumanReviewMarkdown(humanPkg);
  assert.ok(md.includes("P3-T05"));
  assert.ok(md.includes("stagingImportExecuted"));
  assert.ok(md.includes("HUMAN-P3-T05-STAGING-IMPORT-APPROVAL"));

  // Docs + scripts exist
  mustExist("docs/prelaunch/P3-T05_STAGING_IMPORT_PACKAGE.md");
  mustExist("scripts/staging-import-package-selftest.ts");
  mustExist("scripts/run-staging-import-package.ts");
  mustExist("src/lib/onboarding/stagingImportPackage/index.ts");

  const pkg = read("package.json");
  assert.ok(pkg.includes('"test:staging-import-package"'));
  assert.ok(pkg.includes('"check:staging-import-package"'));

  const outDir = path.join(root, "artifacts", "staging-import-package");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "selftest-latest.json"),
    `${JSON.stringify(
      {
        taskId: fixture.taskId,
        mode: fixture.mode,
        totals: fixture.totals,
        publishAllowed: false,
        stagingImportExecuted: false,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log("staging-import-package selftest: OK");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
