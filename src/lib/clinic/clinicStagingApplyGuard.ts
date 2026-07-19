import type { ClinicStagingOperation } from "@/lib/clinic/clinicStagingSyncPlan";
import { auditClinicStagingPlan } from "@/lib/clinic/clinicPlanAudit";

export const CLINIC_STAGING_PROJECT_REF = "jfnjufmldiqlgvgyugfd";
export const CLINIC_PRODUCTION_PROJECT_REF = "rhfrmvkjsummaylpzmns";

export type ClinicApplyGuardInput = {
  approvalFlag: string | undefined;
  targetEnvironment: string | undefined;
  projectRef: string | undefined;
  operations: ClinicStagingOperation[];
};

export type ClinicApplyGuardResult = {
  allowed: boolean;
  reasonCodes: string[];
  targetEnvironment: "staging";
  productionTouched: false;
};

export function evaluateClinicStagingApplyGuard(
  input: ClinicApplyGuardInput
): ClinicApplyGuardResult {
  const reasonCodes: string[] = [];

  if (input.approvalFlag !== "1") reasonCodes.push("explicit_approval_flag_missing");
  if (input.targetEnvironment !== "staging") reasonCodes.push("target_environment_not_staging");
  if (input.projectRef === CLINIC_PRODUCTION_PROJECT_REF) {
    reasonCodes.push("production_project_ref_blocked");
  }
  if (input.projectRef !== CLINIC_STAGING_PROJECT_REF) {
    reasonCodes.push("staging_project_ref_mismatch");
  }

  const audit = auditClinicStagingPlan(input.operations);
  if (!audit.valid) reasonCodes.push(...audit.issueCodes.map((code) => `audit:${code}`));

  if (input.operations.some((operation) => operation.publishAllowed !== false)) {
    reasonCodes.push("publish_allowed_operation_blocked");
  }

  return {
    allowed: reasonCodes.length === 0,
    reasonCodes: [...new Set(reasonCodes)],
    targetEnvironment: "staging",
    productionTouched: false,
  };
}
