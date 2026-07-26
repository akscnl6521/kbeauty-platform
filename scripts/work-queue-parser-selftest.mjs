#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  parseWorkQueue,
  getActiveTask,
  getNextQueuedTask,
} from "./lib/work-queue.mjs";

const SAMPLE = `
### TASK WQ-A-checkin-email-queue-staging
id: WQ-A-checkin-email-queue-staging
priority: 10
status: active
deps:
tests:
  - npm run test:checkin-email-queue

### TASK WQ-B-photo-compare-consent
id: WQ-B-photo-compare-consent
priority: 20
status: queued
deps: WQ-A-checkin-email-queue-staging
tests:
  - npm run test:care-data
`;

const tasks = parseWorkQueue(SAMPLE);
assert.equal(tasks.length, 2);
assert.equal(getActiveTask(tasks).id, "WQ-A-checkin-email-queue-staging");

const pending = tasks.map((t) =>
  t.id === "WQ-A-checkin-email-queue-staging"
    ? { ...t, status: "completed" }
    : t
);
const next = getNextQueuedTask(pending);
assert.equal(next.id, "WQ-B-photo-compare-consent");

console.log("work-queue-parser-selftest OK");
