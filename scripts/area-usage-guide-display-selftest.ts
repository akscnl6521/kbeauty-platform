import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  analyzeBodyAreasToApplicationTokens,
  faceExplorerZoneApplicationAreas,
  usageGuideMatchesSelectedAreas,
} from "../src/lib/media/usageGuideApplicationArea";
import { parseVerifiedUsageGuide } from "../src/components/usage/ProductUsageGuide";
import { rankProducts } from "../src/lib/recommend/rankProducts";
import type { RankableProduct, Recommendation } from "../src/lib/recommend/types";

async function main() {
  const faceTokens = faceExplorerZoneApplicationAreas("forehead");
  assert.ok(faceTokens.includes("이마"));
  assert.ok(faceTokens.includes("얼굴"));

  assert.equal(
    usageGuideMatchesSelectedAreas(["얼굴"], faceTokens),
    true
  );
  assert.equal(
    usageGuideMatchesSelectedAreas(["입술"], faceTokens),
    false
  );
  assert.equal(
    usageGuideMatchesSelectedAreas(["입술"], faceExplorerZoneApplicationAreas("lips")),
    true
  );
  assert.equal(
    usageGuideMatchesSelectedAreas(["두피"], faceExplorerZoneApplicationAreas("hair")),
    true
  );
  assert.equal(usageGuideMatchesSelectedAreas(["얼굴"], []), false);

  const analyzeTokens = analyzeBodyAreasToApplicationTokens(["cheek", "cheeks"]);
  assert.ok(analyzeTokens.includes("볼"));
  assert.ok(analyzeTokens.includes("얼굴"));

  const verified = parseVerifiedUsageGuide(
    {
      productId: "p1",
      amountLabel: "완두콩 크기",
      orderIndex: 1,
      frequency: "evening",
      applicationArea: ["얼굴"],
      methodSteps: ["세안 후 바릅니다."],
      cautionText: [],
      verifiedAt: "2026-07-18T00:00:00.000Z",
      media: {
        mediaType: "video",
        sourceUrl: "https://cdn.example.com/a.mp4",
      },
    },
    "p1"
  );
  assert.ok(verified);
  assert.equal(
    usageGuideMatchesSelectedAreas(
      verified!.applicationArea,
      faceExplorerZoneApplicationAreas("nose")
    ),
    true
  );
  assert.equal(
    usageGuideMatchesSelectedAreas(
      verified!.applicationArea,
      faceExplorerZoneApplicationAreas("hair")
    ),
    false
  );

  const httpRejected = parseVerifiedUsageGuide(
    {
      ...verified!,
      media: { mediaType: "video", sourceUrl: "http://cdn.example.com/a.mp4" },
    },
    "p1"
  );
  assert.equal(httpRejected?.media ?? null, null);

  const facePage = await readFile("src/app/face-explorer/page.tsx", "utf8");
  assert.match(facePage, /FaceZoneVerifiedUsageGuides/);
  assert.match(facePage, /area=\$\{displayZone\}/);

  const zoneComp = await readFile(
    "src/components/usage/FaceZoneVerifiedUsageGuides.tsx",
    "utf8"
  );
  assert.match(zoneComp, /emptyMode=["']hidden["']/);
  assert.match(zoneComp, /applicationAreas/);
  assert.doesNotMatch(zoneComp, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(zoneComp, /autoPlay|autoplay/);

  const shared = await readFile(
    "src/components/usage/ProductUsageGuide.tsx",
    "utf8"
  );
  assert.match(shared, /applicationAreas/);
  assert.match(shared, /usageGuideMatchesSelectedAreas/);

  const results = await readFile("src/app/results/page.tsx", "utf8");
  assert.match(results, /usageGuideApplicationAreas/);
  assert.match(results, /applicationAreas=\{usageGuideApplicationAreas\}/);

  const guidance = await readFile("src/app/my/guidance/page.tsx", "utf8");
  assert.match(guidance, /ProductUsageGuide/);
  assert.match(guidance, /applicationAreas=\{applicationAreas\}/);

  const rankSrc = await readFile("src/lib/recommend/rankProducts.ts", "utf8");
  assert.doesNotMatch(
    rankSrc,
    /usageGuideMatchesSelectedAreas|FaceZoneVerifiedUsageGuides|applicationAreas/
  );

  const rec: Recommendation = {
    skinConcerns: ["Dryness"],
    recommendedIngredients: ["Panthenol"],
    ingredientsToAvoid: [],
    confidenceScore: 1,
  };
  const p1: RankableProduct = {
    id: "1",
    brand: "COSRX",
    key_ingredients: ["Panthenol"],
  };
  const p2 = {
    ...p1,
    id: "2",
    matched_application_area: true,
  } as RankableProduct & { matched_application_area: boolean };
  const ranked = rankProducts(rec, [p1, p2]);
  assert.equal(ranked[0]!.score, ranked[1]!.score);

  console.log("area usage guide display self-test: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
