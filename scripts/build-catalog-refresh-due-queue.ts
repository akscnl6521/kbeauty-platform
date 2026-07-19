import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildCatalogRefreshDueQueue,
  type CatalogRefreshPlanItem,
} from "@/lib/catalog/refreshDueQueue";

const root = process.cwd();
const sourcePath = path.join(
  root,
  "data",
  "catalog",
  "refresh-plans",
  "latest.json"
);
const outDir = path.join(root, "data", "catalog", "refresh-due-queues");
const cutoff = process.env.CATALOG_REFRESH_CUTOFF
  ? new Date(process.env.CATALOG_REFRESH_CUTOFF)
  : new Date();

if (!existsSync(sourcePath)) {
  throw new Error(
    "MISSING_REFRESH_PLAN: run npm run catalog:refresh-plan before building the due queue"
  );
}

const source = JSON.parse(readFileSync(sourcePath, "utf8")) as {
  productionTouched?: boolean;
  databaseTouched?: boolean;
  items?: CatalogRefreshPlanItem[];
};

if (source.productionTouched !== false || source.databaseTouched !== false) {
  throw new Error("UNSAFE_REFRESH_PLAN_ARTIFACT");
}
if (!Array.isArray(source.items)) throw new Error("INVALID_REFRESH_PLAN_ITEMS");

const queue = buildCatalogRefreshDueQueue(source.items, cutoff);
const stamp = queue.generatedAt.replace(/[:.]/g, "-").slice(0, 19);
const datedPath = path.join(outDir, `${stamp}.json`);
const latestPath = path.join(outDir, "latest.json");
const serialized = JSON.stringify(queue, null, 2);

mkdirSync(outDir, { recursive: true });
writeFileSync(datedPath, serialized, "utf8");
writeFileSync(latestPath, serialized, "utf8");

console.log(
  JSON.stringify({
    ok: true,
    cutoffAt: queue.cutoffAt,
    totalDue: queue.summary.totalDue,
    byPriority: queue.summary.byPriority,
    datedPath: path.relative(root, datedPath),
    latestPath: path.relative(root, latestPath),
    productionTouched: queue.productionTouched,
    databaseTouched: queue.databaseTouched,
    writeMode: queue.writeMode,
  })
);
