/**
 * P3-T03 dry-run runner — writes machine-readable audit under artifacts/.
 * Default: fixture mode. Never publishes. Never writes Production DB.
 *
 * Usage:
 *   npx tsx scripts/run-automated-refresh-ops.ts
 *   npx tsx scripts/run-automated-refresh-ops.ts --mode=fixture
 *   npx tsx scripts/run-automated-refresh-ops.ts --mode=dry_run --kind=product
 *   npx tsx scripts/run-automated-refresh-ops.ts --mode=dry_run --kind=clinic
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  assertNoAutoPublishOrDestructiveUpdate,
  runAutomatedRefreshOps,
} from "../src/lib/ops/automatedRefresh";
import type {
  AutomatedRefreshMode,
  RefreshEntityKind,
} from "../src/lib/ops/automatedRefresh";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function main() {
  const modeRaw = argValue("mode") ?? "fixture";
  const mode = modeRaw as AutomatedRefreshMode;
  if (mode !== "fixture" && mode !== "dry_run" && mode !== "live_blocked") {
    throw new Error(`unsupported mode: ${modeRaw}`);
  }
  if (mode === "live_blocked") {
    throw new Error(
      "live_blocked: 실 운영 갱신은 사람 승인 후. 이 러너는 fixture/dry_run만 허용.",
    );
  }

  const kindRaw = argValue("kind") ?? "unified";
  const entityKind =
    kindRaw === "product" || kindRaw === "clinic" || kindRaw === "unified"
      ? (kindRaw as RefreshEntityKind | "unified")
      : null;
  if (!entityKind) {
    throw new Error(`unsupported kind: ${kindRaw}`);
  }

  const result = runAutomatedRefreshOps({ mode, entityKind });
  assertNoAutoPublishOrDestructiveUpdate(result);

  const outDir = path.join(
    process.cwd(),
    "artifacts",
    "automated-refresh-ops",
  );
  mkdirSync(outDir, { recursive: true });
  const stamp = result.generatedAt.replace(/[:.]/g, "-");

  writeJson(path.join(outDir, `audit-${stamp}.json`), result.audit);
  writeJson(path.join(outDir, "audit-latest.json"), result.audit);
  writeJson(path.join(outDir, `due-queue-${stamp}.json`), result.dueQueue);
  writeJson(path.join(outDir, "due-queue-latest.json"), result.dueQueue);
  writeJson(path.join(outDir, `exceptions-${stamp}.json`), {
    runId: result.runId,
    items: result.exceptions,
    publishAllowed: false,
    destructiveUpdateAllowed: false,
  });
  writeJson(path.join(outDir, "exceptions-latest.json"), {
    runId: result.runId,
    items: result.exceptions,
    publishAllowed: false,
    destructiveUpdateAllowed: false,
  });
  writeJson(
    path.join(outDir, `admin-review-manifest-${stamp}.json`),
    result.adminManifest,
  );
  writeJson(
    path.join(outDir, "admin-review-manifest-latest.json"),
    result.adminManifest,
  );
  writeJson(path.join(outDir, `checkpoint-${stamp}.json`), result.checkpoint);
  writeJson(path.join(outDir, "checkpoint-latest.json"), result.checkpoint);
  writeJson(path.join(outDir, "scheduler-commands.json"), {
    commands: result.schedulerCommands,
    externalPaidInfra: false,
    productionScheduleCreated: false,
  });

  console.log(
    JSON.stringify(
      {
        ok: result.audit.ok,
        taskId: result.taskId,
        mode: result.mode,
        runId: result.runId,
        entityKind,
        totals: result.audit.totals,
        due: result.dueQueue.totals.due,
        exceptions: result.exceptions.length,
        adminItems: result.adminManifest.items.length,
        outDir: path.relative(process.cwd(), outDir),
        publishAllowed: false,
        autoPublishAttempted: false,
        destructiveUpdateAllowed: false,
        databaseTouched: false,
        writeAttempted: false,
        productionTouched: false,
        externalScheduleCreated: false,
        paidApiUsed: false,
      },
      null,
      2,
    ),
  );
}

main();
