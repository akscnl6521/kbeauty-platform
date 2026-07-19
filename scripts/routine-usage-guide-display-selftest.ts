import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const component = await readFile("src/app/routine/RoutineUsageGuide.tsx", "utf8");
  const page = await readFile("src/app/routine/page.tsx", "utf8");

  assert.match(page, /RoutineUsageGuide/);
  assert.match(page, /productId=\{p\.id\}/);
  assert.match(component, /skinProductUsageGuides/);
  assert.match(component, /protocol === "https:"/);
  assert.match(component, /검증된 사용 가이드가 아직 없습니다/);
  assert.match(component, /amountLabel/);
  assert.match(component, /applicationArea/);
  assert.match(component, /methodSteps/);
  assert.match(component, /verifiedAt/);
  assert.match(component, /disclosureText/);
  assert.doesNotMatch(component, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(component, /http:\/\//);

  console.log("routine usage guide display self-test: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
