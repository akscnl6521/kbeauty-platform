/**
 * Offline catalog gap analysis against backup JSON (no network / DB writes).
 * Run: npx --yes tsx scripts/analyze-scenario-catalog-gap.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  analyzeScenarioCatalogGaps,
  type BackupProductRow,
} from "../src/lib/recommend/scenarios/gapAnalysis";

const ROOT = path.resolve(__dirname, "..");
const BACKUP_DIR = path.join(ROOT, "data", "backups", "2026-07-14-catalog");
const PRODUCTS_PATH = path.join(BACKUP_DIR, "products.json");
const OFFERS_PATH = path.join(BACKUP_DIR, "product-offers.json");

type BackupTableFile<T> = {
  rows?: T[];
};

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function buildOfferCounts(
  offers: Array<{ product_id?: number | string; active?: boolean | null }>
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

function main(): void {
  const productsFile = readJson<BackupTableFile<BackupProductRow>>(PRODUCTS_PATH);
  if (!productsFile?.rows?.length) {
    throw new Error(`No product rows at ${PRODUCTS_PATH}`);
  }

  const offersFile = readJson<BackupTableFile<{ product_id?: number | string; active?: boolean | null }>>(
    OFFERS_PATH
  );
  const offerCounts = offersFile?.rows
    ? buildOfferCounts(offersFile.rows)
    : {};

  const gaps = analyzeScenarioCatalogGaps(productsFile.rows, offerCounts);

  const summary = {
    productCount: productsFile.rows.length,
    offerRows: offersFile?.rows?.length ?? 0,
    scenarioCount: gaps.length,
    scenariosWithReadyProducts: gaps.filter((g) => g.recommendationReadyCount > 0)
      .length,
    gaps,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main();
