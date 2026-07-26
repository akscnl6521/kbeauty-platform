/**
 * T07-04 dry-run runner — writes machine-readable audit under artifacts/.
 * Default: fixture mode. Never crawls. Never publishes. Never writes Production DB.
 *
 * Usage:
 *   npx tsx scripts/run-symptom-evidence-review.ts
 *   npx tsx scripts/run-symptom-evidence-review.ts --mode=fixture
 *   npx tsx scripts/run-symptom-evidence-review.ts --mode=dry_run
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  getFixtureSymptomEvidenceInputs,
  runSymptomEvidenceReview,
} from "../src/lib/publicData/symptomEvidenceReview";
import type { SymptomEvidenceReviewMode } from "../src/lib/publicData/symptomEvidenceReview";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const modeRaw = argValue("mode") ?? "fixture";
  const mode = modeRaw as SymptomEvidenceReviewMode;
  if (mode !== "fixture" && mode !== "dry_run" && mode !== "live_blocked") {
    throw new Error(`unsupported mode: ${modeRaw}`);
  }

  const result = runSymptomEvidenceReview({
    mode,
    rows: getFixtureSymptomEvidenceInputs(),
  });

  const outDir = path.join(
    process.cwd(),
    "artifacts",
    "symptom-evidence-review",
  );
  mkdirSync(outDir, { recursive: true });
  const stamp = result.generatedAt.replace(/[:.]/g, "-");
  const auditFile = path.join(outDir, `audit-${stamp}.json`);
  const queueFile = path.join(outDir, `queue-${stamp}.json`);
  const recordsFile = path.join(outDir, `records-${stamp}.json`);

  writeFileSync(auditFile, JSON.stringify(result.audit, null, 2), "utf8");
  writeFileSync(
    queueFile,
    JSON.stringify(
      {
        taskId: result.taskId,
        mode: result.mode,
        runId: result.runId,
        publishAllowed: false,
        crawlAttempted: false,
        organicReview: result.queue.organicReview.map((r) => ({
          evidenceId: r.evidenceId,
          claimCategory: r.claimCategory,
          evidenceUrl: r.evidenceUrl,
          pageTitle: r.pageTitle,
          reviewerStatus: r.reviewerStatus,
          organicEligibility: r.organicEligibility,
          verifiedAt: r.verifiedAt,
          staleAt: r.staleAt,
        })),
        paidRelationshipReview: result.queue.paidRelationshipReview.map((r) => ({
          evidenceId: r.evidenceId,
          claimCategory: r.claimCategory,
          evidenceUrl: r.evidenceUrl,
          commercialRelationship: r.commercialRelationship,
          commercialDisclosureKo: r.commercialDisclosureKo,
          organicEligibility: r.organicEligibility,
          reviewerStatus: r.reviewerStatus,
        })),
        pending: result.queue.pending.map((r) => ({
          evidenceId: r.evidenceId,
          claimCategory: r.claimCategory,
          reviewerStatus: r.reviewerStatus,
          rejectionCodes: r.rejectionCodes,
        })),
        rejected: result.queue.rejected.map((r) => ({
          evidenceId: r.evidenceId,
          claimCategory: r.claimCategory,
          rejectionReasonCode: r.rejectionReasonCode,
          rejectionReasonKo: r.rejectionReasonKo,
          rejectionCodes: r.rejectionCodes,
        })),
      },
      null,
      2,
    ),
    "utf8",
  );
  writeFileSync(
    recordsFile,
    JSON.stringify(
      {
        taskId: result.taskId,
        mode: result.mode,
        runId: result.runId,
        publishAllowed: false,
        databaseTouched: false,
        records: result.records,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        ok: result.audit.ok,
        taskId: result.taskId,
        mode: result.mode,
        auditFile,
        queueFile,
        recordsFile,
        totals: result.totals,
        queueSummary: result.audit.queueSummary,
        publishAllowed: false,
        crawlAttempted: false,
        databaseTouched: false,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
