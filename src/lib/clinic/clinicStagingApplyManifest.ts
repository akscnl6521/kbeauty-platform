import type { ClinicStagingOperation } from "@/lib/clinic/clinicStagingSyncPlan";
import {
  evaluateClinicStagingApplyGuard,
  type ClinicApplyGuardInput,
} from "@/lib/clinic/clinicStagingApplyGuard";

export type ClinicApplyCommand = {
  sequence: number;
  action: Exclude<ClinicStagingOperation["action"], "no_change">;
  clinicId: string | null;
  sourceHash: string;
  reasonCodes: string[];
  forcePublish: false;
};

export type ClinicStagingApplyManifest = {
  schemaVersion: "1.0";
  generatedAt: string;
  targetEnvironment: "staging";
  productionTouched: false;
  executionAllowed: boolean;
  guardReasonCodes: string[];
  commands: ClinicApplyCommand[];
  skippedNoChangeCount: number;
};

export function buildClinicStagingApplyManifest(
  input: ClinicApplyGuardInput & { generatedAt?: string }
): ClinicStagingApplyManifest {
  const guard = evaluateClinicStagingApplyGuard(input);
  const commands: ClinicApplyCommand[] = guard.allowed
    ? input.operations
        .filter((operation) => operation.action !== "no_change")
        .map((operation, index) => ({
          sequence: index + 1,
          action: operation.action as ClinicApplyCommand["action"],
          clinicId: operation.clinicId,
          sourceHash: operation.sourceHash,
          reasonCodes: operation.reasonCodes,
          forcePublish: false,
        }))
    : [];

  return {
    schemaVersion: "1.0",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    targetEnvironment: "staging",
    productionTouched: false,
    executionAllowed: guard.allowed,
    guardReasonCodes: guard.reasonCodes,
    commands,
    skippedNoChangeCount: input.operations.filter(
      (operation) => operation.action === "no_change"
    ).length,
  };
}
