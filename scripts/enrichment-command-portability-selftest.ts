import assert from "node:assert/strict";
import {
  buildPortableSource,
  resolveNpxCommand,
} from "./run-discovery-enrichment-portable";

assert.equal(resolveNpxCommand("win32"), "npx.cmd");
assert.equal(resolveNpxCommand("linux"), "npx");
assert.equal(resolveNpxCommand("darwin"), "npx");

const original = [
  "const r = spawnSync(",
  '    "npx.cmd",',
  '    ["supabase", "db", "query"],',
  ");",
  "",
].join("\n");

const portable = buildPortableSource(original);
assert.match(
  portable,
  /process\.platform === "win32" \? "npx\.cmd" : "npx"/
);
assert.doesNotMatch(portable, /\n    "npx\.cmd",\n/);

assert.throws(
  () => buildPortableSource("const noTarget = true;\n"),
  /PORTABILITY_PATCH_TARGET_COUNT:0/
);

assert.throws(
  () => buildPortableSource(original + original),
  /PORTABILITY_PATCH_TARGET_COUNT:2/
);

console.log("enrichment-command-portability-selftest: ok");
