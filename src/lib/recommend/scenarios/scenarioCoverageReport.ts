/**
 * Read-only scenario coverage report for admin visibility.
 * Source: offline backup snapshot (data/backups/2026-07-14-catalog) — the
 * same fixture used by scripts/analyze-scenario-catalog-gap.ts. No DB reads,
 * no network, no auto-fill: a scenario is only "ready" when a real matched
 * product independently reached recommendation_ready.
 */
import productsFile from "../../../../data/backups/2026-07-14-catalog/products.json";
import offersFile from "../../../../data/backups/2026-07-14-catalog/product-offers.json";
import {
  analyzeScenarioCatalogGaps,
  summarizeScenarioCoverage,
  type BackupProductRow,
  type ScenarioCatalogGap,
  type ScenarioCoverageSummary,
} from "./gapAnalysis";

export type ScenarioCoverageReport = {
  generatedFrom: string;
  productCount: number;
  offerRows: number;
  summary: ScenarioCoverageSummary;
  gaps: ScenarioCatalogGap[];
};

function buildOfferCounts(
  offers: ReadonlyArray<{ product_id?: number | string; active?: boolean | null }>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const offer of offers) {
    if (offer.active === false) continue;
    const key = String(offer.product_id ?? "");
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function getScenarioCoverageReport(): ScenarioCoverageReport {
  const products = (productsFile.rows ?? []) as BackupProductRow[];
  const offers =
    (offersFile.rows ?? []) as Array<{
      product_id?: number | string;
      active?: boolean | null;
    }>;
  const offerCounts = buildOfferCounts(offers);
  const gaps = analyzeScenarioCatalogGaps(products, offerCounts);
  const summary = summarizeScenarioCoverage(gaps);

  return {
    generatedFrom: "data/backups/2026-07-14-catalog (offline snapshot)",
    productCount: products.length,
    offerRows: offers.length,
    summary,
    gaps,
  };
}
