import assert from "node:assert/strict";
import {
  CLINIC_PRODUCTION_PROJECT_REF,
  CLINIC_STAGING_PROJECT_REF,
  evaluateClinicStagingApplyGuard,
} from "../src/lib/clinic/clinicStagingApplyGuard";

const operations = [
  {
    action: "insert_candidate" as const,
    clinicId: null,
    sourceHash: "source-1",
    reasonCodes: ["new_verified_candidate"],
    publishAllowed: false as const,
  },
];

const allowed = evaluateClinicStagingApplyGuard({
  approvalFlag: "1",
  targetEnvironment: "staging",
  projectRef: CLINIC_STAGING_PROJECT_REF,
  operations,
});
assert.equal(allowed.allowed, true);
assert.equal(allowed.productionTouched, false);

const noApproval = evaluateClinicStagingApplyGuard({
  approvalFlag: undefined,
  targetEnvironment: "staging",
  projectRef: CLINIC_STAGING_PROJECT_REF,
  operations,
});
assert.equal(noApproval.allowed, false);
assert(noApproval.reasonCodes.includes("explicit_approval_flag_missing"));

const production = evaluateClinicStagingApplyGuard({
  approvalFlag: "1",
  targetEnvironment: "production",
  projectRef: CLINIC_PRODUCTION_PROJECT_REF,
  operations,
});
assert.equal(production.allowed, false);
assert(production.reasonCodes.includes("production_project_ref_blocked"));
assert(production.reasonCodes.includes("target_environment_not_staging"));

const invalidPlan = evaluateClinicStagingApplyGuard({
  approvalFlag: "1",
  targetEnvironment: "staging",
  projectRef: CLINIC_STAGING_PROJECT_REF,
  operations: [{ ...operations[0], sourceHash: "" }],
});
assert.equal(invalidPlan.allowed, false);
assert(invalidPlan.reasonCodes.includes("audit:missing_source_hash"));

console.log("clinic staging apply guard self-test passed");
