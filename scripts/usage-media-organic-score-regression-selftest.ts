import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { rankProducts } from "../src/lib/recommend/rankProducts";
import type { RankableProduct, Recommendation } from "../src/lib/recommend/types";

function baseProduct(
  id: string,
  overrides: Partial<RankableProduct> = {}
): RankableProduct {
  return {
    id,
    name: `Product ${id}`,
    brand: "COSRX",
    key_ingredients: ["Panthenol", "Glycerin"],
    key_ingredients_ja: null,
    price_usd: 20,
    ...overrides,
  };
}

async function main() {
  const rankSrc = await readFile("src/lib/recommend/rankProducts.ts", "utf8");
  const guideSrc = await readFile(
    "src/components/usage/ProductUsageGuide.tsx",
    "utf8"
  );
  const cardSrc = await readFile(
    "src/components/recommendation/RecommendedProductCard.tsx",
    "utf8"
  );

  assert.doesNotMatch(rankSrc, /skinProductUsageGuides/);
  assert.doesNotMatch(rankSrc, /usageGuide|UsageGuide|usage_media|usageMedia/i);
  assert.doesNotMatch(rankSrc, /ProductUsageGuide/);
  assert.doesNotMatch(guideSrc, /rankProducts|MATCH_WEIGHT|scoreOneProduct/);
  assert.doesNotMatch(cardSrc, /rankProducts\(/);

  const recommendation: Recommendation = {
    skinConcerns: ["Dryness"],
    recommendedIngredients: ["Panthenol", "Glycerin"],
    ingredientsToAvoid: [],
    confidenceScore: 1,
  };

  const withMediaMeta = baseProduct("p-with-media", {
    name: "With Media Meta",
  });
  const withoutMedia = baseProduct("p-without-media", {
    name: "Without Media",
  });

  const noisy = {
    ...withMediaMeta,
    usage_media_url: "https://example.com/video.mp4",
    has_usage_guide: true,
  } as RankableProduct & {
    usage_media_url: string;
    has_usage_guide: boolean;
  };

  const rankedA = rankProducts(recommendation, [noisy, withoutMedia]);
  const rankedB = rankProducts(recommendation, [withoutMedia, withMediaMeta]);

  assert.equal(rankedA.length, 2);
  assert.equal(rankedB.length, 2);

  const scoreA0 = rankedA[0]!.score;
  const scoreA1 = rankedA[1]!.score;
  const scoreBForA0 = rankedB.find((r) => r.product.id === rankedA[0]!.product.id)!
    .score;
  const scoreBForA1 = rankedB.find((r) => r.product.id === rankedA[1]!.product.id)!
    .score;

  assert.equal(scoreA0, scoreBForA0);
  assert.equal(scoreA1, scoreBForA1);
  // Same ingredient profile → equal score regardless of media-shaped extras
  assert.equal(scoreA0, scoreA1);

  console.log("usage-media organic score regression self-test: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
