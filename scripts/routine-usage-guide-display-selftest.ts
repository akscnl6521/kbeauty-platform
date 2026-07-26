import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const page = await readFile("src/app/routine/page.tsx", "utf8");
  const shared = await readFile(
    "src/components/usage/ProductUsageGuide.tsx",
    "utf8"
  );
  const reexport = await readFile(
    "src/app/routine/RoutineUsageGuide.tsx",
    "utf8"
  );

  assert.match(page, /ProductUsageGuide/);
  assert.match(page, /productId=\{p\.id\}/);
  assert.match(shared, /skinProductUsageGuides/);
  assert.match(shared, /protocol === "https:"/);
  assert.match(shared, /검증된 사용 가이드가 아직 없습니다/);
  assert.match(shared, /amountLabel/);
  assert.match(shared, /applicationArea/);
  assert.match(shared, /methodSteps/);
  assert.match(shared, /verifiedAt/);
  assert.match(shared, /disclosureText/);
  assert.doesNotMatch(shared, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(shared, /http:\/\//);
  assert.match(reexport, /ProductUsageGuide/);

  console.log("routine usage guide display self-test: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
