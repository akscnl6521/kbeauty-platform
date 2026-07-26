/**
 * P3-T05 constants — safety endpoints and branch expectation.
 */

export const STAGING_IMPORT_BRANCH_EXPECTED =
  "feature/recommendation-usage-guide-display-20260720" as const;

export const STAGING_IMPORT_ARTIFACT_DIR = "artifacts/staging-import-package";

export const SAFE_ENDPOINT_NOTE =
  "P3-T05 integrated Staging import package is fixture/dry-run only. Never writes Staging/Production DB, never executes import, never merges main, never deploys Production.";

export const UPSTREAM_TASK_IDS = [
  "P2-T03",
  "P2-T04",
  "P3-T01",
  "P3-T02",
  "P3-T03",
  "P3-T04",
  "T07-02",
  "T07-03",
  "T07-04",
  "T07-05",
] as const;
