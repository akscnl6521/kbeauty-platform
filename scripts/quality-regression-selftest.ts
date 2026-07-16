/**
 * Quality regression entry — Evidence + KR recommend.
 * Run: npx tsx scripts/quality-regression-selftest.ts
 * or: npm run test:quality
 */
import { runRecommendQualityRegressionSelftests } from "../src/lib/recommend/quality-regression-selftest";

try {
  const result = runRecommendQualityRegressionSelftests();
  console.log(
    JSON.stringify({
      phase: "quality_regression_ok",
      ...result,
    })
  );
} catch (err) {
  console.error(err);
  process.exit(1);
}
