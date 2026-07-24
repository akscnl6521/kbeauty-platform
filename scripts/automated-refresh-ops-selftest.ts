/**
 * P3-T03 Automated refresh + exception operations self-test.
 * Fixture / dry-run only — proves no auto-publish and no destructive update.
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  AUTOMATED_REFRESH_TASK_ID,
  CLINIC_TWICE_WEEKLY_CRON_UTC,
  PRODUCT_DAILY_CRON_UTC,
  RETRY_MAX_ATTEMPTS,
  advanceCheckpointDryRun,
  applyStaleStatus,
  assertNoAutoPublishOrDestructiveUpdate,
  assertSchedulerCommandsSafe,
  buildDueQueue,
  buildRetryBackoffPlan,
  buildSourceChangeDiff,
  computeBackoffDelayMs,
  createAutomatedRefreshFixtures,
  createEmptyRefreshCheckpoint,
  detectStale,
  listSchedulerReadyCommands,
  prioritizeExceptions,
  resolvePendingEntityIds,
  runAutomatedRefreshOps,
  runFixtureAutomatedRefreshOps,
} from "../src/lib/ops/automatedRefresh";

async function main() {
  assert.equal(AUTOMATED_REFRESH_TASK_ID, "P3-T03");
  assert.equal(PRODUCT_DAILY_CRON_UTC, "20 0 * * *");
  assert.equal(CLINIC_TWICE_WEEKLY_CRON_UTC, "40 0 * * 1,4");
  assert.equal(RETRY_MAX_ATTEMPTS, 5);

  const fixtures = createAutomatedRefreshFixtures();
  assert.ok(fixtures.length >= 10);
  assert.ok(fixtures.some((e) => e.entityKind === "product"));
  assert.ok(fixtures.some((e) => e.entityKind === "clinic"));
  assert.ok(fixtures.every((e) => e.isFixture && e.allowPublicSurface === false));

  const now = new Date("2026-07-24T12:00:00.000Z");

  // Stale detection
  const hardStale = fixtures.find((e) => e.entityId === "prod-hard-stale-005");
  assert.ok(hardStale);
  const stale = detectStale(hardStale, now);
  assert.equal(stale.isStale, true);
  assert.equal(stale.isHardStale, true);
  assert.equal(stale.suggestedStatus, "verification_required");

  const current = fixtures.find((e) => e.entityId === "prod-current-001");
  assert.ok(current);
  assert.equal(detectStale(current, now).isStale, false);
  assert.equal(applyStaleStatus(current, now).refreshStatus, "current");

  // Retry / backoff deterministic
  assert.equal(computeBackoffDelayMs(1), 60_000);
  assert.equal(computeBackoffDelayMs(2), 120_000);
  assert.equal(computeBackoffDelayMs(3), 240_000);
  const planOk = buildRetryBackoffPlan({ failureCount: 1, now });
  assert.equal(planOk.retryable, true);
  assert.equal(planOk.exhausted, false);
  assert.equal(planOk.delayMs, 120_000);
  const planExhausted = buildRetryBackoffPlan({ failureCount: 5, now });
  assert.equal(planExhausted.exhausted, true);
  assert.equal(planExhausted.retryable, false);

  // Source change diff
  const changed = fixtures.find((e) => e.entityId === "prod-changed-003");
  assert.ok(changed);
  const diff = buildSourceChangeDiff(changed);
  assert.equal(diff.changed, true);
  assert.ok(diff.changes.some((c) => c.field === "ingredientsFingerprint"));
  assert.equal(diff.requiresManualReview, true);

  // Due queue
  const due = buildDueQueue(fixtures, { now, entityKind: "unified" });
  assert.ok(due.totals.due >= 5);
  assert.ok(due.totals.byKind.product >= 1);
  assert.ok(due.totals.byKind.clinic >= 1);
  assert.ok(
    due.items.every(
      (item, i, arr) =>
        i === 0 ||
        item.priority === arr[i - 1].priority ||
        ["critical", "high", "medium", "low"].indexOf(item.priority) >=
          ["critical", "high", "medium", "low"].indexOf(arr[i - 1].priority),
    ),
  );

  // Exception prioritization
  const exceptions = prioritizeExceptions({
    entities: fixtures.map((e) => applyStaleStatus(e, now)),
    diffs: fixtures.map(buildSourceChangeDiff),
  });
  assert.ok(exceptions.length >= 4);
  assert.ok(exceptions.some((e) => e.kind === "source_changed"));
  assert.ok(exceptions[0].priority === "critical" || exceptions[0].priority === "high");

  // Checkpoint resume
  const ids = fixtures.map((e) => e.entityId);
  let checkpoint = createEmptyRefreshCheckpoint({
    runId: "p3-t03-test-ckpt",
    mode: "fixture",
    schedule: "unified",
    nowIso: now.toISOString(),
    pendingEntityIds: ids,
  });
  checkpoint = advanceCheckpointDryRun({
    checkpoint,
    nowIso: now.toISOString(),
    failureOutcomeMap: {
      "prod-failed-004": "retryable",
      "clinic-unavailable-004": "terminal",
    },
  });
  assert.equal(checkpoint.status, "completed");
  assert.ok(checkpoint.failedRetryableIds.includes("prod-failed-004"));
  assert.ok(checkpoint.failedTerminalIds.includes("clinic-unavailable-004"));
  assert.deepEqual(resolvePendingEntityIds(ids, checkpoint), []);

  // Resume: prior checkpoint with partial progress
  const partial = createEmptyRefreshCheckpoint({
    runId: "p3-t03-partial",
    mode: "fixture",
    schedule: "product_daily",
    nowIso: now.toISOString(),
    pendingEntityIds: ["prod-due-002", "prod-changed-003"],
  });
  const afterPartial = advanceCheckpointDryRun({
    checkpoint: {
      ...partial,
      processedEntityIds: ["prod-current-001"],
      pendingEntityIds: ["prod-due-002", "prod-changed-003"],
    },
    nowIso: now.toISOString(),
  });
  assert.ok(afterPartial.processedEntityIds.includes("prod-due-002"));
  assert.equal(afterPartial.pendingEntityIds.length, 0);

  // Full fixture pipeline
  const full = runFixtureAutomatedRefreshOps({ now });
  assert.equal(full.taskId, "P3-T03");
  assert.equal(full.mode, "fixture");
  assertNoAutoPublishOrDestructiveUpdate(full);
  assert.equal(full.audit.ok, true);
  assert.equal(full.audit.publishAllowed, false);
  assert.equal(full.audit.autoPublishAttempted, false);
  assert.equal(full.audit.destructiveUpdateAllowed, false);
  assert.equal(full.audit.externalScheduleCreated, false);
  assert.equal(full.audit.paidApiUsed, false);
  assert.ok(full.dueQueue.totals.due >= 5);
  assert.ok(full.exceptions.length >= 4);
  assert.ok(full.adminManifest.items.length >= 4);
  assert.equal(full.adminManifest.publishAllowed, false);
  assert.equal(full.adminManifest.destructiveUpdateAllowed, false);
  assert.equal(full.checkpoint.status, "completed");

  // Product-only / clinic-only scopes
  const products = runAutomatedRefreshOps({
    mode: "fixture",
    now,
    entityKind: "product",
  });
  assert.ok(products.entities.every((e) => e.entityKind === "product"));
  assert.equal(products.dueQueue.entityKind, "product");
  assertNoAutoPublishOrDestructiveUpdate(products);

  const clinics = runAutomatedRefreshOps({
    mode: "dry_run",
    now,
    entityKind: "clinic",
  });
  assert.ok(clinics.entities.every((e) => e.entityKind === "clinic"));
  assert.equal(clinics.dueQueue.entityKind, "clinic");
  assertNoAutoPublishOrDestructiveUpdate(clinics);

  // Scheduler-ready commands (no paid infra / no Production schedule)
  const cmds = listSchedulerReadyCommands();
  assert.equal(cmds.length, 2);
  assert.equal(cmds[0].id, "product_daily");
  assert.equal(cmds[1].id, "clinic_twice_weekly");
  assertSchedulerCommandsSafe(cmds);
  assert.equal(cmds[0].npmScript, "refresh:product-daily");
  assert.equal(cmds[1].npmScript, "refresh:clinic-twice-weekly");

  // live_blocked rejected
  assert.throws(
    () => runAutomatedRefreshOps({ mode: "live_blocked", now }),
    /live_blocked/,
  );

  // Artifact snapshot for local evidence
  const outDir = path.join(process.cwd(), "artifacts", "automated-refresh-ops");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "selftest-latest.json"),
    JSON.stringify(
      {
        ok: true,
        taskId: full.taskId,
        totals: full.audit.totals,
        publishAllowed: false,
        autoPublishAttempted: false,
        destructiveUpdateAllowed: false,
        databaseTouched: false,
        writeAttempted: false,
        productionTouched: false,
        externalScheduleCreated: false,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        taskId: full.taskId,
        due: full.dueQueue.totals.due,
        exceptions: full.exceptions.length,
        adminItems: full.adminManifest.items.length,
        publishAllowed: false,
        autoPublishAttempted: false,
        destructiveUpdateAllowed: false,
      },
      null,
      2,
    ),
  );
  console.log("automated-refresh-ops selftest: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
