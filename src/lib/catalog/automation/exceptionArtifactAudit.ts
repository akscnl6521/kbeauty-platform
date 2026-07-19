import type { CatalogExceptionQueueItem } from "@/lib/catalog/automation/exceptionQueue";

export type CatalogExceptionArtifactSummary = {
  phase: "catalog_exception_queue";
  linked: string;
  productionTouched: false;
  writeMode: "artifact_only";
  productCount: number;
  exceptionCount: number;
  byPriority: Record<"critical" | "high" | "medium" | "low", number>;
  byGroup: Record<"identity" | "source" | "content" | "commerce", number>;
};

export type CatalogExceptionArtifact = {
  summary: CatalogExceptionArtifactSummary;
  queue: CatalogExceptionQueueItem[];
};

export type CatalogExceptionArtifactAuditIssue = {
  code:
    | "production_touched"
    | "invalid_write_mode"
    | "count_mismatch"
    | "duplicate_queue_item"
    | "priority_summary_mismatch"
    | "group_summary_mismatch";
  message: string;
};

export type CatalogExceptionArtifactAuditResult = {
  valid: boolean;
  issues: CatalogExceptionArtifactAuditIssue[];
};

const PRIORITIES = ["critical", "high", "medium", "low"] as const;
const GROUPS = ["identity", "source", "content", "commerce"] as const;

export function auditCatalogExceptionArtifact(
  artifact: CatalogExceptionArtifact
): CatalogExceptionArtifactAuditResult {
  const issues: CatalogExceptionArtifactAuditIssue[] = [];

  if (artifact.summary.productionTouched !== false) {
    issues.push({
      code: "production_touched",
      message: "Catalog exception artifacts must never report Production writes.",
    });
  }

  if (artifact.summary.writeMode !== "artifact_only") {
    issues.push({
      code: "invalid_write_mode",
      message: "Catalog exception artifacts must remain artifact-only.",
    });
  }

  if (artifact.summary.exceptionCount !== artifact.queue.length) {
    issues.push({
      code: "count_mismatch",
      message: "summary.exceptionCount must match queue length.",
    });
  }

  const seen = new Set<string>();
  for (const item of artifact.queue) {
    const key = `${item.externalProductId}:${item.kind}`;
    if (seen.has(key)) {
      issues.push({
        code: "duplicate_queue_item",
        message: `Duplicate exception queue item: ${key}`,
      });
      break;
    }
    seen.add(key);
  }

  for (const priority of PRIORITIES) {
    const actual = artifact.queue.filter((item) => item.priority === priority).length;
    if (artifact.summary.byPriority[priority] !== actual) {
      issues.push({
        code: "priority_summary_mismatch",
        message: `Priority summary mismatch for ${priority}.`,
      });
      break;
    }
  }

  for (const group of GROUPS) {
    const actual = artifact.queue.filter((item) => item.reviewGroup === group).length;
    if (artifact.summary.byGroup[group] !== actual) {
      issues.push({
        code: "group_summary_mismatch",
        message: `Review group summary mismatch for ${group}.`,
      });
      break;
    }
  }

  return { valid: issues.length === 0, issues };
}
