/**
 * T07-05 dry-run runner — writes JSON/CSV audit under artifacts/.
 * Default: fixture mode. Never publishes. Never writes Production DB.
 *
 * Usage:
 *   npx tsx scripts/run-admin-dry-run-publishable-gate.ts
 *   npx tsx scripts/run-admin-dry-run-publishable-gate.ts --mode=fixture
 *   npx tsx scripts/run-admin-dry-run-publishable-gate.ts --mode=dry_run
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  getFixtureGateCandidates,
  runAdminDryRunPublishableGate,
} from "../src/lib/publicData/adminDryRunPublishableGate";
import type { AdminDryRunMode } from "../src/lib/publicData/adminDryRunPublishableGate";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const modeRaw = argValue("mode") ?? "fixture";
  const mode = modeRaw as AdminDryRunMode;
  if (mode !== "fixture" && mode !== "dry_run" && mode !== "live_blocked") {
    throw new Error(`unsupported mode: ${modeRaw}`);
  }

  const result = await runAdminDryRunPublishableGate({
    mode,
    candidates: getFixtureGateCandidates(),
    runUpstreamStages: true,
  });

  const outDir = path.join(
    process.cwd(),
    "artifacts",
    "admin-dry-run-publishable-gate",
  );
  mkdirSync(outDir, { recursive: true });
  const stamp = result.generatedAt.replace(/[:.]/g, "-");
  const auditFile = path.join(outDir, `audit-${stamp}.json`);
  const recordsFile = path.join(outDir, `records-${stamp}.json`);
  const csvFile = path.join(outDir, `summary-${stamp}.csv`);
  const humanFile = path.join(outDir, `human-actions-${stamp}.json`);

  writeFileSync(auditFile, JSON.stringify(result.audit, null, 2), "utf8");
  writeFileSync(
    recordsFile,
    JSON.stringify(
      {
        taskId: result.taskId,
        mode: result.mode,
        runId: result.runId,
        publishAllowed: false,
        databaseTouched: false,
        writeAttempted: false,
        productionTouched: false,
        records: result.records.map((r) => ({
          recordId: r.recordId,
          institutionId: r.institutionId,
          name: r.name,
          status: r.status,
          blockReasons: r.blockReasons,
          structurallyPublishable: r.structurallyPublishable,
          adminReviewEligible: r.adminReviewEligible,
          publicVisible: r.publicVisible,
          publishAllowed: r.publishAllowed,
          isFixture: r.isFixture,
          commercialRelationship: r.commercialRelationship,
          organicScore: r.organicScore,
          clinicalFitScore: r.clinicalFitScore,
        })),
      },
      null,
      2,
    ),
    "utf8",
  );
  writeFileSync(csvFile, result.csvSummary, "utf8");
  writeFileSync(
    humanFile,
    JSON.stringify(
      {
        taskId: result.taskId,
        productionForbidden: true,
        actions: result.humanActions,
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
        recordsFile,
        csvFile,
        humanFile,
        totals: result.totals,
        statusReasonCounts: result.statusReasonCounts,
        stageSummaries: result.stageSummaries.map((s) => ({
          stage: s.stage,
          taskId: s.taskId,
          ok: s.ok,
          recordCount: s.recordCount,
        })),
        commercialIndependence: {
          organicOrderUnchanged:
            result.commercialIndependence.organicOrderUnchanged,
          clinicalFitOrderUnchanged:
            result.commercialIndependence.clinicalFitOrderUnchanged,
        },
        humanActionIds: result.humanActions.map((a) => a.id),
        publishAllowed: false,
        databaseTouched: false,
        secretsPresent: false,
      },
      null,
      2,
    ),
  );

  if (!result.audit.ok) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
