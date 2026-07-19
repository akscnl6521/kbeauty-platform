import assert from "node:assert/strict";
import fs from "node:fs";

const patcher = fs.readFileSync("scripts/patch-analyze-concern-observations.ts", "utf8");

assert.match(patcher, /expected exactly one match/);
assert.match(patcher, /ConcernObservationPanel/);
assert.match(patcher, /buildAnalyzeConcernObservationPayload/);
assert.match(patcher, /concernObservations\?: Record<string, ConcernObservation>/);
assert.match(patcher, /ConcernObservationMap/);
assert.match(patcher, /No changes generated/);

console.log("analyze concern patcher self-test passed");
