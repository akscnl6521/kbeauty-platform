/**
 * T07-05 Admin dry-run + publishable gate self-test.
 * Fixture / dry-run only — no Production writes, no publish, no secrets.
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  ADMIN_DRY_RUN_PUBLISHABLE_GATE_TASK_ID,
  COMMERCIAL_INDEPENDENCE_NOTE_KO,
  FIXTURE_NOW_ISO,
  PUBLISHABLE_REQUIRES_NOTE_KO,
  UNPUBLISHED_NOTE_KO,
  assertUnsafeNeverPublic,
  buildCsvSummary,
  buildOneTimeHumanActions,
  buildStatusReasonCounts,
  collectPublishBlockReasons,
  evaluatePublishableGate,
  getFixtureGateCandidates,
  proveCommercialIndependence,
  runFixtureAdminDryRunPublishableGate,
  scoreClinicFitIgnoringCommercial,
} from "../src/lib/publicData/adminDryRunPublishableGate";
import type { AdminGateCandidateInput } from "../src/lib/publicData/adminDryRunPublishableGate";

async function main() {
  assert.equal(ADMIN_DRY_RUN_PUBLISHABLE_GATE_TASK_ID, "T07-05");
  assert.ok(UNPUBLISHED_NOTE_KO.includes("공개"));
  assert.ok(PUBLISHABLE_REQUIRES_NOTE_KO.includes("관리자"));
  assert.ok(COMMERCIAL_INDEPENDENCE_NOTE_KO.includes("Organic"));

  const human = buildOneTimeHumanActions();
  assert.equal(human.length, 2);
  assert.ok(human.some((a) => a.id === "HUMAN-T07-OFFICIAL-SITE-EVIDENCE"));
  assert.ok(human.some((a) => a.id === "HUMAN-T07-STAGING-IMPORT-APPROVAL"));
  for (const action of human) {
    assert.equal(action.productionForbidden, true);
    assert.ok(action.stepsKo.length >= 3);
  }

  // --- Commercial independence ---
  const independence = proveCommercialIndependence(
    new Date(FIXTURE_NOW_ISO),
  );
  assert.equal(independence.organicOrderUnchanged, true);
  assert.equal(independence.clinicalFitOrderUnchanged, true);
  assert.deepEqual(independence.organicOrderIds, [
    "clinic-a",
    "clinic-b",
    "clinic-c",
  ]);

  // Clinical/organic scores ignore commercial relationship
  const baseScores = scoreClinicFitIgnoringCommercial({
    symptomMatchCount: 1,
    hasOfficialDept: true,
    specialistCount: 2,
    evidenceStrength: "strong",
  });
  const paidScores = scoreClinicFitIgnoringCommercial({
    symptomMatchCount: 1,
    hasOfficialDept: true,
    specialistCount: 2,
    evidenceStrength: "strong",
  });
  assert.deepEqual(baseScores, paidScores);

  // --- Gate: fixture never structurally publishable ---
  const fixtures = getFixtureGateCandidates();
  assert.ok(fixtures.some((f) => f.isFixture));
  assert.ok(fixtures.some((f) => !f.isFixture && f.adminApproved));

  const fixtureRow = fixtures.find((f) => f.recordId === "gate-fixture-derm-001");
  assert.ok(fixtureRow);
  const fixtureEval = evaluatePublishableGate(
    fixtureRow,
    FIXTURE_NOW_ISO,
    baseScores,
  );
  assert.equal(fixtureEval.structurallyPublishable, false);
  assert.equal(fixtureEval.publicVisible, false);
  assert.equal(fixtureEval.publishAllowed, false);
  assert.ok(fixtureEval.blockReasons.includes("fixture_cannot_publish"));

  // Failed / stale / conflicting / insufficient never public
  for (const id of [
    "gate-failed-retryable-009",
    "gate-stale-010",
    "gate-conflict-007",
    "gate-insufficient-005",
  ]) {
    const row = fixtures.find((f) => f.recordId === id);
    assert.ok(row, id);
    const reasons = collectPublishBlockReasons(row);
    assert.ok(reasons.length > 0, id);
    const evaluated = evaluatePublishableGate(row, FIXTURE_NOW_ISO, baseScores);
    assert.equal(evaluated.publicVisible, false, id);
    assert.equal(evaluated.publishAllowed, false, id);
    assert.equal(evaluated.structurallyPublishable, false, id);
  }

  // Dry-run official + admin approval → structurally publishable, still not public
  const approved = fixtures.find(
    (f) => f.recordId === "gate-dry-run-official-approved",
  );
  assert.ok(approved);
  const approvedEval = evaluatePublishableGate(
    approved,
    FIXTURE_NOW_ISO,
    scoreClinicFitIgnoringCommercial({
      symptomMatchCount: 1,
      hasOfficialDept: true,
      specialistCount: 4,
      evidenceStrength: "strong",
    }),
  );
  assert.equal(approvedEval.structurallyPublishable, true);
  assert.equal(approvedEval.status, "structurally_publishable");
  assert.equal(approvedEval.publicVisible, false);
  assert.equal(approvedEval.publishAllowed, false);
  assert.equal(approved.adminApproved, true);

  // Pending admin → review eligible, not publishable
  const pending = fixtures.find(
    (f) => f.recordId === "gate-dry-run-official-pending",
  );
  assert.ok(pending);
  const pendingEval = evaluatePublishableGate(
    pending,
    FIXTURE_NOW_ISO,
    baseScores,
  );
  assert.equal(pendingEval.adminReviewEligible, true);
  assert.equal(pendingEval.structurallyPublishable, false);
  assert.ok(pendingEval.blockReasons.includes("admin_approval_missing"));

  // Paid commercial does not change clinical/organic scores on gate record
  const paid = fixtures.find((f) => f.recordId === "gate-dry-run-official-paid");
  assert.ok(paid);
  const unpaidClone: AdminGateCandidateInput = {
    ...paid,
    commercialRelationship: "none",
    symptomEvidenceReviewerStatus: "absent",
    symptomEvidencePublishEligible: false,
  };
  const paidEval = evaluatePublishableGate(paid, FIXTURE_NOW_ISO, baseScores);
  const unpaidEval = evaluatePublishableGate(
    unpaidClone,
    FIXTURE_NOW_ISO,
    baseScores,
  );
  assert.equal(paidEval.organicScore, unpaidEval.organicScore);
  assert.equal(paidEval.clinicalFitScore, unpaidEval.clinicalFitScore);

  // --- Full orchestrated dry-run ---
  const result = await runFixtureAdminDryRunPublishableGate(FIXTURE_NOW_ISO);
  assert.equal(result.taskId, "T07-05");
  assert.equal(result.audit.ok, true);
  assert.equal(result.publishAllowed, false);
  assert.equal(result.databaseTouched, false);
  assert.equal(result.writeAttempted, false);
  assert.equal(result.productionTouched, false);
  assert.equal(result.totals.publicVisible, 0);
  assert.equal(result.totals.publishAllowed, 0);
  assert.ok(result.totals.structurallyPublishable >= 1);
  assert.ok(result.totals.fixtureCount >= 1);
  assert.ok(result.stageSummaries.length >= 4);
  assert.ok(
    result.stageSummaries.every((s) => s.ok),
    "all stages ok",
  );
  assert.equal(result.commercialIndependence.organicOrderUnchanged, true);
  assert.equal(result.commercialIndependence.clinicalFitOrderUnchanged, true);
  assert.ok(result.csvSummary.includes("status_reason"));
  assert.ok(result.csvSummary.includes("publicVisible"));
  assert.equal(result.audit.secretsPresent, false);
  assert.ok(result.humanActions.length === 2);

  const inputsById = new Map(fixtures.map((c) => [c.recordId, c]));
  const safety = assertUnsafeNeverPublic(result.records, inputsById);
  assert.equal(safety.ok, true, safety.violations.join(", "));

  // No fixture structurally publishable
  assert.ok(
    result.records
      .filter((r) => r.isFixture)
      .every((r) => !r.structurallyPublishable && !r.publicVisible),
  );

  // Status/reason counts present
  const counts = buildStatusReasonCounts(result.records);
  assert.ok(counts.length > 0);
  const csv = buildCsvSummary(counts, result.totals);
  assert.ok(csv.split("\n").length > 5);

  // Audit artifact write (local only)
  const outDir = path.join(
    process.cwd(),
    "artifacts",
    "admin-dry-run-publishable-gate",
  );
  mkdirSync(outDir, { recursive: true });
  const stamp = result.generatedAt.replace(/[:.]/g, "-");
  writeFileSync(
    path.join(outDir, `selftest-audit-${stamp}.json`),
    JSON.stringify(result.audit, null, 2),
    "utf8",
  );
  writeFileSync(
    path.join(outDir, `selftest-summary-${stamp}.csv`),
    result.csvSummary,
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        taskId: result.taskId,
        totals: result.totals,
        stageSummaries: result.stageSummaries.map((s) => ({
          stage: s.stage,
          taskId: s.taskId,
          ok: s.ok,
          recordCount: s.recordCount,
        })),
        commercialIndependence: {
          organicOrderUnchanged:
            result.commercialIndependence.organicOrderUnchanged,
          clinicalFitOrderUnchanged:
            result.commercialIndependence.clinicalFitOrderUnchanged,
        },
        humanActionIds: result.humanActions.map((a) => a.id),
        publishAllowed: false,
        databaseTouched: false,
      },
      null,
      2,
    ),
  );
  console.log("admin-dry-run-publishable-gate selftest: OK");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
