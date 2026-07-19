import assert from "node:assert/strict";
import {
  CLINIC_PRODUCTION_PROJECT_REF,
  CLINIC_STAGING_PROJECT_REF,
} from "@/lib/clinic/clinicStagingApplyGuard";
import { buildClinicStagingApplyManifest } from "@/lib/clinic/clinicStagingApplyManifest";
import type { ClinicStagingOperation } from "@/lib/clinic/clinicStagingSyncPlan";

const operations: ClinicStagingOperation[] = [
  {
    action: "insert_candidate",
    clinicId: null,
    sourceHash: "source-a",
    reasonCodes: ["new_verified_candidate"],
    publishAllowed: false,
  },
  {
    action: "no_change",
    clinicId: "clinic-1",
    sourceHash: "source-b",
    reasonCodes: ["verified_fields_unchanged"],
    publishAllowed: false,
  },
];

const allowed = buildClinicStagingApplyManifest({
  approvalFlag: "1",
  targetEnvironment: "staging",
  projectRef: CLINIC_STAGING_PROJECT_REF,
  operations,
  generatedAt: "2026-07-19T00:00:00.000Z",
});
assert.equal(allowed.executionAllowed, true);
assert.equal(allowed.commands.length, 1);
assert.equal(allowed.commands[0]?.action, "insert_candidate");
assert.equal(allowed.commands[0]?.forcePublish, false);
assert.equal(allowed.skippedNoChangeCount, 1);
assert.equal(allowed.productionTouched, false);

const productionBlocked = buildClinicStagingApplyManifest({
  approvalFlag: "1",
  targetEnvironment: "production",
  projectRef: CLINIC_PRODUCTION_PROJECT_REF,
  operations,
});
assert.equal(productionBlocked.executionAllowed, false);
assert.equal(productionBlocked.commands.length, 0);
assert.ok(productionBlocked.guardReasonCodes.includes("production_project_ref_blocked"));

const approvalBlocked = buildClinicStagingApplyManifest({
  approvalFlag: undefined,
  targetEnvironment: "staging",
  projectRef: CLINIC_STAGING_PROJECT_REF,
  operations,
});
assert.equal(approvalBlocked.executionAllowed, false);
assert.equal(approvalBlocked.commands.length, 0);

console.log("clinic staging apply manifest self-test passed");
