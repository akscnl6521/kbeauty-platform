import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function main() {
  const shared = await readFile(
    "src/components/usage/ProductUsageGuide.tsx",
    "utf8"
  );
  const routinePage = await readFile("src/app/routine/page.tsx", "utf8");
  const card = await readFile(
    "src/components/recommendation/RecommendedProductCard.tsx",
    "utf8"
  );
  const reexport = await readFile(
    "src/app/routine/RoutineUsageGuide.tsx",
    "utf8"
  );

  assert.match(
    routinePage,
    /from ["']@\/components\/usage\/ProductUsageGuide["']/
  );
  assert.match(routinePage, /productId=\{p\.id\}/);
  assert.match(routinePage, /locale=\{locale\}/);
  assert.match(routinePage, /emptyMode=["']message["']/);

  assert.match(
    card,
    /from ["']@\/components\/usage\/ProductUsageGuide["']/
  );
  assert.match(card, /productId=\{product\.id\}/);
  assert.match(card, /locale=\{locale\}/);
  assert.match(card, /emptyMode=["']hidden["']/);

  assert.match(reexport, /@\/components\/usage\/ProductUsageGuide/);
  assert.doesNotMatch(reexport, /skinProductUsageGuides/);

  assert.match(shared, /skinProductUsageGuides/);
  assert.match(shared, /protocol === "https:"/);
  assert.match(shared, /검증된 사용 가이드가 아직 없습니다/);
  assert.match(shared, /amountLabel/);
  assert.match(shared, /applicationArea/);
  assert.match(shared, /methodSteps/);
  assert.match(shared, /verifiedAt/);
  assert.match(shared, /disclosureText/);
  assert.match(shared, /parseVerifiedUsageGuide/);
  assert.doesNotMatch(shared, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(shared, /http:\/\//);
  assert.doesNotMatch(shared, /autoPlay|autoplay/);

  // Parsing rejects HTTP media and mismatched productId (unit-style via source)
  assert.match(shared, /isHttpsUrl/);
  assert.match(shared, /row\.productId !== productId/);

  console.log("product usage guide display self-test: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
