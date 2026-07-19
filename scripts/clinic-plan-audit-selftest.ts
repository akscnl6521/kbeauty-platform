import assert from "node:assert/strict";
import { auditClinicStagingPlan } from "@/lib/clinic/clinicPlanAudit";
import type { ClinicStagingOperation } from "@/lib/clinic/clinicStagingSyncPlan";

const valid: ClinicStagingOperation[] = [
  {
    action: "insert_candidate",
    clinicId: null,
    sourceHash: "hash-new",
    reasonCodes: ["new_verified_candidate"],
    publishAllowed: false,
  },
  {
    action: "update_candidate",
    clinicId: "clinic-1",
    sourceHash: "hash-update",
    reasonCodes: ["verified_fields_changed"],
    publishAllowed: false,
  },
];

assert.equal(auditClinicStagingPlan(valid).valid, true);

const duplicateHash = auditClinicStagingPlan([
  valid[0],
  { ...valid[1], sourceHash: "hash-new" },
]);
assert.equal(duplicateHash.valid, false);
assert.ok(duplicateHash.issues.some((issue) => issue.code === "duplicate_source_hash"));

const conflict = auditClinicStagingPlan([
  valid[1],
  {
    action: "block_listing",
    clinicId: "clinic-1",
    sourceHash: "hash-block",
    reasonCodes: ["inactive_or_closed"],
    publishAllowed: false,
  },
]);
assert.ok(conflict.issues.some((issue) => issue.code === "conflicting_clinic_actions"));

const missingId = auditClinicStagingPlan([
  { ...valid[1], clinicId: null, sourceHash: "hash-missing-id" },
]);
assert.ok(missingId.issues.some((issue) => issue.code === "update_without_clinic_id"));

console.log("clinic-plan-audit-selftest: ok");
