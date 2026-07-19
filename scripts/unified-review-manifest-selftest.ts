import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

async function main() {
  const dir = await mkdtemp(join(tmpdir(), "unified-review-"));
  const catalogDue = join(dir, "catalog-due.json");
  const catalogException = join(dir, "catalog-exception.json");
  const clinicPlan = join(dir, "clinic-plan.json");
  const usageMedia = join(dir, "usage-media.json");
  const output = join(dir, "manifest.json");

  await writeFile(
    catalogDue,
    JSON.stringify({
      productionTouched: false,
      databaseTouched: false,
      queue: [{ id: "p1", productName: "테스트 세럼", priority: "high" }],
    }),
  );
  await writeFile(
    catalogException,
    JSON.stringify({
      productionTouched: false,
      databaseTouched: false,
      queue: [{ id: "p2", reason: "이미지 출처 확인", severity: "critical" }],
    }),
  );
  await writeFile(
    clinicPlan,
    JSON.stringify({
      productionTouched: false,
      publishAllowed: false,
      reviewQueue: [
        { id: "c1", clinicName: "테스트 피부과", priority: "medium" },
      ],
    }),
  );
  await writeFile(
    usageMedia,
    JSON.stringify({
      productionTouched: false,
      databaseTouched: false,
      publishAllowed: false,
      reviewQueue: [
        {
          id: "usage-media-v1",
          mediaId: "v1",
          productId: "p1",
          priority: "critical",
          action: "unpublish",
          reasons: ["rights_expired"],
          rightsExpiresAt: "2026-07-18T00:00:00Z",
          sourceUrl: "https://brand.example/video.mp4",
        },
      ],
    }),
  );

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
      usageMedia,
    ],
    { encoding: "utf8" },
  );
  if (run.status !== 0) {
    throw new Error(run.stderr || run.stdout || "manifest builder failed");
  }

  const result = JSON.parse(await readFile(output, "utf8")) as {
    mode: string;
    publishAllowed: boolean;
    databaseTouched: boolean;
    productionTouched: boolean;
    total: number;
    sourcePresence: { usageMedia?: boolean };
    items: Array<{
      source: string;
      priority: string;
      title: string;
      payload: Record<string, unknown>;
    }>;
  };

  if (result.mode !== "artifact_only") throw new Error("mode mismatch");
  if (
    result.publishAllowed !== false ||
    result.databaseTouched !== false ||
    result.productionTouched !== false
  ) {
    throw new Error("unsafe manifest flags");
  }
  if (result.total !== 4) {
    throw new Error(`expected 4 items, got ${result.total}`);
  }
  if (result.items[0]?.priority !== "critical") {
    throw new Error("priority ordering failed");
  }
  if (!result.items.some((item) => item.source === "clinic_review")) {
    throw new Error("clinic item missing");
  }
  const mediaItem = result.items.find(
    (item) => item.payload.reviewCategory === "usage_media",
  );
  if (!mediaItem) throw new Error("usage media item missing");
  if (!mediaItem.title.includes("제품 사용 영상 권리 검수")) {
    throw new Error("usage media title missing");
  }
  if (mediaItem.payload.recommendedAction !== "unpublish") {
    throw new Error("usage media action missing");
  }
  if (result.sourcePresence.usageMedia !== true) {
    throw new Error("usage media source presence missing");
  }

  await writeFile(
    usageMedia,
    JSON.stringify({
      productionTouched: false,
      databaseTouched: false,
      publishAllowed: true,
      reviewQueue: [],
    }),
  );
  const unsafeRun = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/build-unified-review-manifest.ts",
      catalogDue,
      catalogException,
      clinicPlan,
      output,
      usageMedia,
    ],
    { encoding: "utf8" },
  );
  if (unsafeRun.status === 0) {
    throw new Error("unsafe usage media publish flag was not rejected");
  }

  console.log("unified review manifest selftest passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});