import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

async function main() {
  const dir = await mkdtemp(join(tmpdir(), "unified-review-"));
  const catalogDue = join(dir, "catalog-due.json");
  const catalogException = join(dir, "catalog-exception.json");
  const clinicPlan = join(dir, "clinic-plan.json");
  const output = join(dir, "manifest.json");

  await writeFile(catalogDue, JSON.stringify({
    productionTouched: false,
    databaseTouched: false,
    queue: [{ id: "p1", productName: "테스트 세럼", priority: "high" }],
  }));
  await writeFile(catalogException, JSON.stringify({
    productionTouched: false,
    databaseTouched: false,
    queue: [{ id: "p2", reason: "이미지 출처 확인", severity: "critical" }],
  }));
  await writeFile(clinicPlan, JSON.stringify({
    productionTouched: false,
    publishAllowed: false,
    reviewQueue: [{ id: "c1", clinicName: "테스트 피부과", priority: "medium" }],
  }));

  const run = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/build-unified-review-manifest.ts",
      catalogDue,
      catalogException,
      clinicPlan,
      output,
    ],
    { encoding: "utf8" }
  );
  if (run.status !== 0) throw new Error(run.stderr || run.stdout || "manifest builder failed");

  const result = JSON.parse(await readFile(output, "utf8")) as {
    mode: string;
    publishAllowed: boolean;
    databaseTouched: boolean;
    productionTouched: boolean;
    total: number;
    items: Array<{ source: string; priority: string }>;
  };

  if (result.mode !== "artifact_only") throw new Error("mode mismatch");
  if (result.publishAllowed !== false || result.databaseTouched !== false || result.productionTouched !== false) {
    throw new Error("unsafe manifest flags");
  }
  if (result.total !== 3) throw new Error(`expected 3 items, got ${result.total}`);
  if (result.items[0]?.priority !== "critical") throw new Error("priority ordering failed");
  if (!result.items.some((item) => item.source === "clinic_review")) throw new Error("clinic item missing");

  await writeFile(catalogDue, JSON.stringify({ productionTouched: true, databaseTouched: false, queue: [] }));
  const unsafeRun = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/build-unified-review-manifest.ts", catalogDue, catalogException, clinicPlan, output],
    { encoding: "utf8" }
  );
  if (unsafeRun.status === 0) throw new Error("unsafe production flag was not rejected");

  console.log("unified review manifest selftest passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
