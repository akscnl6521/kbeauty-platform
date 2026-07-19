import { createHash } from "node:crypto";
import type { ClinicStagingApplyManifest } from "@/lib/clinic/clinicStagingApplyManifest";

export type ClinicExecutionReceipt = {
  manifestHash: string;
  executedAt: string;
  targetEnvironment: "staging";
  productionTouched: false;
};

export type ClinicExecutionPolicyResult = {
  allowed: boolean;
  manifestHash: string;
  reasonCodes: string[];
  productionTouched: false;
};

function canonicalManifestPayload(manifest: ClinicStagingApplyManifest): string {
  return JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    generatedAt: manifest.generatedAt,
    targetEnvironment: manifest.targetEnvironment,
    productionTouched: manifest.productionTouched,
    executionAllowed: manifest.executionAllowed,
    guardReasonCodes: [...manifest.guardReasonCodes].sort(),
    commands: manifest.commands.map((command) => ({
      sequence: command.sequence,
      action: command.action,
      clinicId: command.clinicId,
      sourceHash: command.sourceHash,
      reasonCodes: [...command.reasonCodes].sort(),
      forcePublish: command.forcePublish,
    })),
    skippedNoChangeCount: manifest.skippedNoChangeCount,
  });
}

export function hashClinicStagingManifest(
  manifest: ClinicStagingApplyManifest
): string {
  return createHash("sha256")
    .update(canonicalManifestPayload(manifest), "utf8")
    .digest("hex");
}

export function evaluateClinicExecutionPolicy(input: {
  manifest: ClinicStagingApplyManifest;
  expectedManifestHash: string | undefined;
  priorReceipts: ClinicExecutionReceipt[];
}): ClinicExecutionPolicyResult {
  const reasonCodes: string[] = [];
  const manifestHash = hashClinicStagingManifest(input.manifest);

  if (!input.manifest.executionAllowed) {
    reasonCodes.push("manifest_execution_not_allowed");
  }
  if (input.manifest.targetEnvironment !== "staging") {
    reasonCodes.push("manifest_target_not_staging");
  }
  if (input.manifest.productionTouched !== false) {
    reasonCodes.push("production_touch_flag_blocked");
  }
  if (!input.expectedManifestHash) {
    reasonCodes.push("expected_manifest_hash_missing");
  } else if (input.expectedManifestHash !== manifestHash) {
    reasonCodes.push("manifest_hash_mismatch");
  }
  if (input.manifest.commands.some((command) => command.forcePublish !== false)) {
    reasonCodes.push("force_publish_command_blocked");
  }
  if (input.priorReceipts.some((receipt) => receipt.manifestHash === manifestHash)) {
    reasonCodes.push("manifest_already_executed");
  }

  return {
    allowed: reasonCodes.length === 0,
    manifestHash,
    reasonCodes: [...new Set(reasonCodes)],
    productionTouched: false,
  };
}

export function buildClinicExecutionReceipt(input: {
  manifestHash: string;
  executedAt?: string;
}): ClinicExecutionReceipt {
  return {
    manifestHash: input.manifestHash,
    executedAt: input.executedAt ?? new Date().toISOString(),
    targetEnvironment: "staging",
    productionTouched: false,
  };
}
