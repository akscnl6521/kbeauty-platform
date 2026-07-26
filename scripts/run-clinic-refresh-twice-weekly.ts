/**
 * Scheduler-ready: twice-weekly clinic refresh artifacts (P3-T03).
 * Artifact-only · no Production schedule · no paid infra · no auto-publish.
 *
 * Intended cadence: cron `40 0 * * 1,4` (09:40 KST Mon/Thu) — operator wires
 * this outside the agent; this script never registers cloud/paid schedulers.
 *
 * Usage: npm run refresh:clinic-twice-weekly
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  CLINIC_TWICE_WEEKLY_SCHEDULER_COMMAND,
  assertNoAutoPublishOrDestructiveUpdate,
  assertSchedulerCommandsSafe,
  runAutomatedRefreshOps,
} from "../src/lib/ops/automatedRefresh";

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function main() {
  assertSchedulerCommandsSafe([CLINIC_TWICE_WEEKLY_SCHEDULER_COMMAND]);

  const result = runAutomatedRefreshOps({
    mode: "fixture",
    entityKind: "clinic",
  });
  assertNoAutoPublishOrDestructiveUpdate(result);

  const outDir = path.join(
    process.cwd(),
    "artifacts",
    "automated-refresh-ops",
    "clinic-twice-weekly",
  );
  mkdirSync(outDir, { recursive: true });

  writeJson(path.join(outDir, "due-queue.json"), result.dueQueue);
  writeJson(path.join(outDir, "exceptions.json"), {
    items: result.exceptions,
    publishAllowed: false,
    destructiveUpdateAllowed: false,
  });
  writeJson(path.join(outDir, "admin-review-manifest.json"), result.adminManifest);
  writeJson(path.join(outDir, "checkpoint.json"), result.checkpoint);
  writeJson(path.join(outDir, "audit.json"), result.audit);
  writeJson(
    path.join(outDir, "scheduler-command.json"),
    CLINIC_TWICE_WEEKLY_SCHEDULER_COMMAND,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        schedule: "clinic_twice_weekly",
        cronUtc: CLINIC_TWICE_WEEKLY_SCHEDULER_COMMAND.cronUtc,
        cronNoteKo: CLINIC_TWICE_WEEKLY_SCHEDULER_COMMAND.cronNoteKo,
        due: result.dueQueue.totals.due,
        exceptions: result.exceptions.length,
        outDir: path.relative(process.cwd(), outDir),
        publishAllowed: false,
        destructiveUpdateAllowed: false,
        productionScheduleCreated: false,
        externalPaidInfra: false,
        databaseTouched: false,
        writeAttempted: false,
      },
      null,
      2,
    ),
  );
}

main();
