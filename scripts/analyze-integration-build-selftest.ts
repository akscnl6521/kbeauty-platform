import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts?: Record<string, string>;
};

assert.equal(packageJson.scripts?.prebuild, "npm run patch:analyze-concerns");
assert.equal(
  packageJson.scripts?.["patch:analyze-concerns"],
  "npx --yes tsx scripts/patch-analyze-concern-observations.ts"
);

const patcher = readFileSync("scripts/patch-analyze-concern-observations.ts", "utf8");
assert.match(patcher, /ConcernObservationPanel/);
assert.match(patcher, /already present/i);
assert.match(patcher, /expected exactly one match/);

console.log("analyze integration build self-test passed");
