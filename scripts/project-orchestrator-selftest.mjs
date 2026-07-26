#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  parseWorkQueue,
  setTaskStatus,
  getActiveTask,
  getNextQueuedTask,
} from "./lib/work-queue.mjs";
import { evaluateCommandOrSql } from "./safe-command-gate.mjs";
import { buildProjectStateSummary } from "./project-state-summary.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fes-"));
const wq = `# tmp queue
### TASK WQ-X-one
id: WQ-X-one
priority: 1
status: active
deps:
tests:

### TASK WQ-X-two
id: WQ-X-two
priority: 2
status: queued
deps: WQ-X-one
tests:
`;
fs.writeFileSync(path.join(tmp, "WORK_QUEUE.md"), wq, "utf8");

process.chdir(tmp);
const tasks = parseWorkQueue(wq);
assert.equal(getActiveTask(tasks).id, "WQ-X-one");

setTaskStatus(tmp, "WQ-X-one", "completed", { result_commit: "abc123" });
const updated = fs.readFileSync(path.join(tmp, "WORK_QUEUE.md"), "utf8");
assert.match(updated, /status: completed/);
assert.match(updated, /result_commit: abc123/);

const after = parseWorkQueue(updated).map((t) =>
  t.id === "WQ-X-one" ? { ...t, status: "completed" } : t
);
assert.equal(getNextQueuedTask(after).id, "WQ-X-two");

const gate = evaluateCommandOrSql("SELECT 1");
assert.equal(gate.ok, true);

const summary = buildProjectStateSummary(path.resolve(import.meta.dirname, ".."));
assert.ok(summary.protection.productionWritesBlocked);

console.log("project-orchestrator-selftest OK");
