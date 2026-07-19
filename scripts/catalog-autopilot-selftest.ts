import assert from "node:assert/strict";

process.env.CATALOG_AUTOPILOT_SELFTEST = "1";
const { catalogAutopilotSteps, npmCommand } = await import("./run-catalog-autopilot");

assert.equal(npmCommand("win32"), "npm.cmd");
assert.equal(npmCommand("linux"), "npm");
assert.equal(npmCommand("darwin"), "npm");

assert.deepEqual(catalogAutopilotSteps(), [
  "catalog:full-beauty",
  "catalog:enrich",
  "catalog:dedupe-plan",
  "catalog:inci",
  "catalog:refresh-plan",
]);

assert.deepEqual(catalogAutopilotSteps({ includeCuratedLabels: true }), [
  "catalog:full-beauty",
  "catalog:enrich",
  "catalog:dedupe-plan",
  "catalog:inci",
  "catalog:labels:sync",
  "catalog:refresh-plan",
]);

console.log("catalog-autopilot-selftest: ok");
