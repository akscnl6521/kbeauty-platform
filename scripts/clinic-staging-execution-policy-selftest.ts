import assert from "node:assert/strict";
import {
  buildClinicExecutionReceipt,
  evaluateClinicExecutionPolicy,
  hashClinicStagingManifest,
} from "../src/lib/clinic/clinicStagingExecutionPolicy";
import type { ClinicStagingApplyManifest } from "../src/lib/clinic/clinicStagingApplyManifest";

const manifest: ClinicStagingApplyManifest = {
  schemaVersion: "1.0",
  generatedAt: "2026-07-19T04:00:00.000Z",
  targetEnvironment: "staging",
  productionTouched: false,
  executionAllowed: true,
  guardReasonCodes: [],
  commands: [
    {
      sequence: 1,
      action: "insert_candidate",
      clinicId: null,
      sourceHash: "source-001",
      reasonCodes: ["new_verified_candidate"],
      forcePublish: false,
    },
  ],
  skippedNoChangeCount: 0,
};

const expectedHash = hashClinicStagingManifest(manifest);
const allowed = evaluateClinicExecutionPolicy({
  manifest,
  expectedManifestHash: expectedHash,
  priorReceipts: [],
});
assert.equal(allowed.allowed, true);
assert.equal(allowed.productionTouched, false);

const tampered = evaluateClinicExecutionPolicy({
  manifest: {
    ...manifest,
    commands: [{ ...manifest.commands[0], sourceHash: "changed-source" }],
  },
  expectedManifestHash: expectedHash,
  priorReceipts: [],
});
assert.equal(tampered.allowed, false);
assert.ok(tampered.reasonCodes.includes("manifest_hash_mismatch"));

const receipt = buildClinicExecutionReceipt({
  manifestHash: expectedHash,
  executedAt: "2026-07-19T04:05:00.000Z",
});
const replay = evaluateClinicExecutionPolicy({
  manifest,
  expectedManifestHash: expectedHash,
  priorReceipts: [receipt],
});
assert.equal(replay.allowed, false);
assert.ok(replay.reasonCodes.includes("manifest_already_executed"));

const missingHash = evaluateClinicExecutionPolicy({
  manifest,
  expectedManifestHash: undefined,
  priorReceipts: [],
});
assert.equal(missingHash.allowed, false);
assert.ok(missingHash.reasonCodes.includes("expected_manifest_hash_missing"));

const blockedManifest = evaluateClinicExecutionPolicy({
  manifest: { ...manifest, executionAllowed: false },
  expectedManifestHash: hashClinicStagingManifest({
    ...manifest,
    executionAllowed: false,
  }),
  priorReceipts: [],
});
assert.equal(blockedManifest.allowed, false);
assert.ok(blockedManifest.reasonCodes.includes("manifest_execution_not_allowed"));

console.log("clinic staging execution policy selftest passed");
