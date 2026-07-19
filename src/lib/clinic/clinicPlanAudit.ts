import type { ClinicStagingOperation } from "@/lib/clinic/clinicStagingSyncPlan";

export type ClinicPlanAuditIssue = {
  code:
    | "missing_source_hash"
    | "duplicate_source_hash"
    | "conflicting_clinic_actions"
    | "publish_allowed_must_be_false"
    | "update_without_clinic_id"
    | "no_change_without_clinic_id";
  operationIndexes: number[];
  clinicId: string | null;
  sourceHash: string | null;
};

export type ClinicPlanAuditResult = {
  valid: boolean;
  issues: ClinicPlanAuditIssue[];
};

const WRITE_ACTIONS = new Set(["insert_candidate", "update_candidate", "block_listing"]);

export function auditClinicStagingPlan(
  operations: ClinicStagingOperation[]
): ClinicPlanAuditResult {
  const issues: ClinicPlanAuditIssue[] = [];
  const sourceHashIndexes = new Map<string, number[]>();
  const clinicActions = new Map<string, { actions: Set<string>; indexes: number[] }>();

  operations.forEach((operation, index) => {
    const sourceHash = operation.sourceHash.trim();
    if (!sourceHash) {
      issues.push({
        code: "missing_source_hash",
        operationIndexes: [index],
        clinicId: operation.clinicId,
        sourceHash: null,
      });
    } else {
      const indexes = sourceHashIndexes.get(sourceHash) ?? [];
      indexes.push(index);
      sourceHashIndexes.set(sourceHash, indexes);
    }

    if (operation.publishAllowed !== false) {
      issues.push({
        code: "publish_allowed_must_be_false",
        operationIndexes: [index],
        clinicId: operation.clinicId,
        sourceHash: sourceHash || null,
      });
    }

    if (operation.action === "update_candidate" && !operation.clinicId) {
      issues.push({
        code: "update_without_clinic_id",
        operationIndexes: [index],
        clinicId: null,
        sourceHash: sourceHash || null,
      });
    }

    if (operation.action === "no_change" && !operation.clinicId) {
      issues.push({
        code: "no_change_without_clinic_id",
        operationIndexes: [index],
        clinicId: null,
        sourceHash: sourceHash || null,
      });
    }

    if (operation.clinicId) {
      const entry = clinicActions.get(operation.clinicId) ?? {
        actions: new Set<string>(),
        indexes: [],
      };
      entry.actions.add(operation.action);
      entry.indexes.push(index);
      clinicActions.set(operation.clinicId, entry);
    }
  });

  for (const [sourceHash, indexes] of sourceHashIndexes) {
    if (indexes.length > 1) {
      issues.push({
        code: "duplicate_source_hash",
        operationIndexes: indexes,
        clinicId: null,
        sourceHash,
      });
    }
  }

  for (const [clinicId, entry] of clinicActions) {
    const mutatingActions = [...entry.actions].filter((action) => WRITE_ACTIONS.has(action));
    if (mutatingActions.length > 1 || (mutatingActions.length > 0 && entry.actions.has("no_change"))) {
      issues.push({
        code: "conflicting_clinic_actions",
        operationIndexes: entry.indexes,
        clinicId,
        sourceHash: null,
      });
    }
  }

  return { valid: issues.length === 0, issues };
}
