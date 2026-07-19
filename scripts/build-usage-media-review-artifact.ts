import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { buildUsageMediaReviewQueue } from "../src/lib/media/usageMediaReviewQueue";
import type { UsageMediaAsset } from "../src/lib/media/productUsageMediaPolicy";

const inputFile = process.argv[2] ?? "data/media/usage-assets.json";
const outputFile = process.argv[3] ?? "data/media/usage-media-review-queue.json";

async function readAssets(): Promise<UsageMediaAsset[]> {
  try {
    const parsed = JSON.parse(await readFile(inputFile, "utf8")) as unknown;
    if (!Array.isArray(parsed)) throw new Error("usage media input must be an array");
    return parsed as UsageMediaAsset[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function main() {
  const assets = await readAssets();
  const queue = buildUsageMediaReviewQueue(assets);
  const artifact = {
    generatedAt: new Date().toISOString(),
    mode: "artifact_only",
    publishAllowed: false,
    databaseTouched: false,
    productionTouched: false,
    inputAvailable: assets.length > 0,
    total: queue.length,
    queue,
  };
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, JSON.stringify(artifact, null, 2) + "\n", "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
