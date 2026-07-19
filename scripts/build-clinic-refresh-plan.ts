import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildClinicRefreshPlan } from "../src/lib/clinic/clinicRefreshPolicy";
import type { ClinicCandidate } from "../src/lib/clinic/referralRankingPolicy";

async function readCandidates(path: string): Promise<ClinicCandidate[]> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ClinicCandidate[]) : [];
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw error;
  }
}

async function main() {
  const inputPath = resolve(process.argv[2] ?? "data/clinic-candidates.json");
  const outputPath = resolve(process.argv[3] ?? "artifacts/clinic-refresh-plan.json");
  const now = process.env.CLINIC_REFRESH_NOW
    ? new Date(process.env.CLINIC_REFRESH_NOW)
    : new Date();
  if (Number.isNaN(now.getTime())) throw new Error("Invalid CLINIC_REFRESH_NOW");

  const candidates = await readCandidates(inputPath);
  const plan = buildClinicRefreshPlan(candidates, now);
  const payload = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    inputPath,
    candidateCount: candidates.length,
    blockedFromPublicRecommendation: plan.filter((item) => !item.allowPublicRecommendation).length,
    counts: {
      urgent: plan.filter((item) => item.priority === "urgent").length,
      high: plan.filter((item) => item.priority === "high").length,
      normal: plan.filter((item) => item.priority === "normal").length,
      low: plan.filter((item) => item.priority === "low").length,
    },
    plan,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`[clinic-refresh-plan] ${plan.length} items -> ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
