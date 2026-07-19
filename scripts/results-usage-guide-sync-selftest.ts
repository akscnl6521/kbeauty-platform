import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const sync = await readFile("src/lib/recommend/syncUsageGuides.ts", "utf8");
  const loader = await readFile("src/lib/recommend/loadRankedProducts.ts", "utf8");

  assert.match(sync, /skinProductUsageGuides/);
  assert.match(sync, /usageGuide \?\? entry\.product\.usage_guide/);
  assert.match(sync, /protocol === "https:"/);
  assert.match(sync, /amountLabel/);
  assert.match(sync, /applicationArea/);
  assert.match(sync, /methodSteps/);
  assert.match(sync, /verifiedAt/);
  assert.match(sync, /localStorage\.setItem/);
  assert.match(sync, /localStorage\.removeItem/);
  assert.doesNotMatch(sync, /http:\/\//);
  assert.match(loader, /syncVerifiedUsageGuidesFromRankedProducts\(parsed\)/);
  assert.match(loader, /removeItem\("skinProductUsageGuides"\)/);

  console.log("results usage guide sync self-test: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
