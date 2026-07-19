import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  generateBulkKrSeedCatalog,
  processBulkKrCatalog,
} from "@/lib/catalog/bulkKr";
import { getCatalogRefreshPlan } from "@/lib/catalog/refreshPolicy";

const root = process.cwd();
const now = new Date();
const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(root, "data", "catalog", "refresh-plans");

const raw = generateBulkKrSeedCatalog(500);
const { products, stats } = processBulkKrCatalog(raw);

const items = products.map((product) => {
  const officialSourceConfirmed = !product.cautionHints.includes(
    "official_pdp_not_confirmed"
  );
  const hasRetailer = Boolean(
    product.retailerHint && product.retailerHint !== "none"
  );
  const refresh = getCatalogRefreshPlan(
    {
      disposition: product.disposition,
      officialSourceConfirmed,
      hasFullInci: product.hasFullInci,
      hasImage: Boolean(product.imageRemoteUrl),
      hasRetailer,
    },
    now
  );

  return {
    canonicalKey: product.canonicalKey,
    slug: product.slug,
    brand: product.brand,
    nameKo: product.nameKo,
    officialUrl: product.officialUrl,
    disposition: product.disposition,
    confidenceScore: product.confidenceScore,
    refresh,
  };
});

items.sort((a, b) => {
  const priorityRank = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
  const priorityDiff =
    priorityRank[a.refresh.priority] - priorityRank[b.refresh.priority];
  if (priorityDiff !== 0) return priorityDiff;
  return a.refresh.nextCheckAt.localeCompare(b.refresh.nextCheckAt);
});

const summary = items.reduce(
  (acc, item) => {
    acc[item.refresh.priority] += 1;
    for (const check of item.refresh.checks) {
      acc.byCheck[check] = (acc.byCheck[check] ?? 0) + 1;
    }
    return acc;
  },
  {
    urgent: 0,
    high: 0,
    normal: 0,
    low: 0,
    byCheck: {} as Record<string, number>,
  }
);

const output = {
  generatedAt: now.toISOString(),
  productionTouched: false,
  databaseTouched: false,
  source: "bulk-kr-seed-catalog",
  stats,
  summary,
  items,
};

mkdirSync(outDir, { recursive: true });
const datedPath = path.join(outDir, `${stamp}.json`);
const latestPath = path.join(outDir, "latest.json");
const serialized = JSON.stringify(output, null, 2);
writeFileSync(datedPath, serialized, "utf8");
writeFileSync(latestPath, serialized, "utf8");

console.log(
  JSON.stringify({
    ok: true,
    generatedAt: output.generatedAt,
    count: items.length,
    summary,
    datedPath: path.relative(root, datedPath),
    latestPath: path.relative(root, latestPath),
  })
);
