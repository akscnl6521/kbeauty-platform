import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { buildClinicStagingSyncPlan } from "@/lib/clinic/clinicStagingSyncPlan";
import type { ClinicSourceSnapshot } from "@/lib/clinic/clinicSyncDecision";
import type { ClinicCandidate } from "@/lib/clinic/referralRankingPolicy";

const snapshotsFile = process.argv[2] ?? "data/clinic/source-snapshots.json";
const existingFile = process.argv[3] ?? "data/clinic/existing-clinics.json";
const outputFile = process.argv[4] ?? "data/clinic/clinic-staging-sync-plan.json";

async function readArray<T>(path: string): Promise<T[]> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as unknown;
    if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
    return value as T[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function main() {
  const snapshots = await readArray<ClinicSourceSnapshot>(snapshotsFile);
  const existing = await readArray<ClinicCandidate>(existingFile);
  const operations = buildClinicStagingSyncPlan({ snapshots, existing });
  const summary = Object.fromEntries(
    ["insert_candidate", "update_candidate", "manual_review", "block_listing", "no_change"].map((action) => [
      action,
      operations.filter((item) => item.action === action).length,
    ])
  );
  const result = {
    generatedAt: new Date().toISOString(),
    mode: "dry_run",
    publishAllowed: false,
    summary,
    operations,
  };
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputFile, summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
