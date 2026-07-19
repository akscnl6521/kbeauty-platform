import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { auditClinicStagingPlan } from "@/lib/clinic/clinicPlanAudit";
import { buildClinicReviewQueue } from "@/lib/clinic/clinicReviewQueue";
import { buildClinicStagingSyncPlan } from "@/lib/clinic/clinicStagingSyncPlan";
import type { ClinicSourceSnapshot } from "@/lib/clinic/clinicSyncDecision";
import type { ClinicCandidate } from "@/lib/clinic/referralRankingPolicy";

const snapshotsFile = process.argv[2] ?? "data/clinic/source-snapshots.json";
const existingFile = process.argv[3] ?? "data/clinic/existing-clinics.json";
const outputFile = process.argv[4] ?? "data/clinic/clinic-staging-sync-plan.json";

async function readArray<T>(path: string): Promise<T[]> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as unknown;
    if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
    return value as T[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function main() {
  const snapshots = await readArray<ClinicSourceSnapshot>(snapshotsFile);
  const existing = await readArray<ClinicCandidate>(existingFile);
  const operations = buildClinicStagingSyncPlan({ snapshots, existing });
  const audit = auditClinicStagingPlan(operations);

  if (!audit.valid) {
    throw new Error(
      `Clinic staging plan audit failed: ${audit.issues
        .map((issue) => issue.code)
        .join(", ")}`
    );
  }

  const reviewQueue = buildClinicReviewQueue(operations);
  const summary = Object.fromEntries(
    ["insert_candidate", "update_candidate", "manual_review", "block_listing", "no_change"].map((action) => [
      action,
      operations.filter((item) => item.action === action).length,
    ])
  );
  const reviewSummary = Object.fromEntries(
    ["critical", "high", "medium", "low"].map((priority) => [
      priority,
      reviewQueue.filter((item) => item.priority === priority).length,
    ])
  );
  const result = {
    generatedAt: new Date().toISOString(),
    mode: "dry_run",
    publishAllowed: false,
    productionTouched: false,
    audit: {
      valid: audit.valid,
      issueCount: audit.issues.length,
      issues: audit.issues,
    },
    summary,
    reviewSummary,
    reviewQueue,
    operations,
  };
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        outputFile,
        summary,
        reviewSummary,
        reviewQueueCount: reviewQueue.length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
