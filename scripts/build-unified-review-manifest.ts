import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const catalogDueFile = process.argv[2] ?? "data/catalog/refresh-due/latest.json";
const catalogExceptionFile = process.argv[3] ?? "data/catalog/exception-queue/latest.json";
const clinicPlanFile = process.argv[4] ?? "data/clinic/clinic-staging-sync-plan.json";
const outputFile = process.argv[5] ?? "data/review/unified-review-manifest.json";
const usageMediaFile = process.argv[6] ?? "data/media/usage-media-review-queue.json";

type JsonRecord = Record<string, unknown>;

type ReviewItem = {
  id: string;
  source: "catalog_refresh" | "catalog_exception" | "clinic_review";
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  payload: JsonRecord;
};

async function readOptional(path: string): Promise<JsonRecord | null> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${path} must contain a JSON object`);
    }
    return value as JsonRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function asRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonRecord =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function priorityOf(value: unknown): ReviewItem["priority"] {
  return value === "critical" ||
    value === "high" ||
    value === "medium" ||
    value === "low"
    ? value
    : "medium";
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safetyCheck(
  label: string,
  value: JsonRecord | null,
  requirePublishBlock = false,
): void {
  if (!value) return;
  if (value.productionTouched !== false) {
    throw new Error(`${label}: productionTouched must be false`);
  }
  if ("databaseTouched" in value && value.databaseTouched !== false) {
    throw new Error(`${label}: databaseTouched must be false`);
  }
  if (requirePublishBlock && value.publishAllowed !== false) {
    throw new Error(`${label}: publishAllowed must be false`);
  }
}

function catalogRefreshItems(value: JsonRecord | null): ReviewItem[] {
  if (!value) return [];
  const rows = asRecords(value.queue ?? value.items ?? value.operations);
  return rows.map((row, index) => ({
    id: `catalog-refresh-${text(row.id ?? row.productId, String(index + 1))}`,
    source: "catalog_refresh",
    priority: priorityOf(row.priority),
    title: text(row.productName ?? row.name ?? row.title, "제품 정보 갱신 검수"),
    payload: row,
  }));
}

function catalogExceptionItems(value: JsonRecord | null): ReviewItem[] {
  if (!value) return [];
  const rows = asRecords(value.queue ?? value.items ?? value.exceptions);
  return rows.map((row, index) => ({
    id: `catalog-exception-${text(row.id ?? row.productId, String(index + 1))}`,
    source: "catalog_exception",
    priority: priorityOf(row.priority ?? row.severity),
    title: text(row.productName ?? row.name ?? row.reason, "제품 예외 검수"),
    payload: row,
  }));
}

function clinicItems(value: JsonRecord | null): ReviewItem[] {
  if (!value) return [];
  const rows = asRecords(value.reviewQueue ?? value.operations);
  return rows.map((row, index) => ({
    id: `clinic-review-${text(row.id ?? row.clinicId, String(index + 1))}`,
    source: "clinic_review",
    priority: priorityOf(row.priority),
    title: text(row.clinicName ?? row.name ?? row.reason, "피부과 추천 후보 검수"),
    payload: row,
  }));
}

function usageMediaItems(value: JsonRecord | null): ReviewItem[] {
  if (!value) return [];
  const rows = asRecords(value.reviewQueue ?? value.queue ?? value.items);
  return rows.map((row, index) => {
    const mediaId = text(row.mediaId ?? row.id, String(index + 1));
    const productId = text(row.productId, "제품 미지정");
    const action = text(row.action, "review");
    return {
      id: `usage-media-review-${mediaId}`,
      source: "catalog_exception",
      priority: priorityOf(row.priority),
      title: `제품 사용 영상 권리 검수 · ${productId}`,
      payload: {
        ...row,
        reviewCategory: "usage_media",
        recommendedAction: action,
      },
    };
  });
}

const rank: Record<ReviewItem["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

async function main() {
  const [catalogDue, catalogException, clinicPlan, usageMedia] =
    await Promise.all([
      readOptional(catalogDueFile),
      readOptional(catalogExceptionFile),
      readOptional(clinicPlanFile),
      readOptional(usageMediaFile),
    ]);

  safetyCheck("catalog refresh", catalogDue);
  safetyCheck("catalog exception", catalogException);
  safetyCheck("clinic plan", clinicPlan, true);
  safetyCheck("usage media review", usageMedia, true);

  const items = [
    ...catalogRefreshItems(catalogDue),
    ...catalogExceptionItems(catalogException),
    ...clinicItems(clinicPlan),
    ...usageMediaItems(usageMedia),
  ].sort(
    (a, b) =>
      rank[a.priority] - rank[b.priority] ||
      a.source.localeCompare(b.source) ||
      a.id.localeCompare(b.id),
  );

  const countsBySource = Object.fromEntries(
    ["catalog_refresh", "catalog_exception", "clinic_review"].map((source) => [
      source,
      items.filter((item) => item.source === source).length,
    ]),
  );
  const countsByPriority = Object.fromEntries(
    ["critical", "high", "medium", "low"].map((priority) => [
      priority,
      items.filter((item) => item.priority === priority).length,
    ]),
  );

  const result = {
    generatedAt: new Date().toISOString(),
    mode: "artifact_only",
    publishAllowed: false,
    databaseTouched: false,
    productionTouched: false,
    sourcePresence: {
      catalogRefresh: Boolean(catalogDue),
      catalogException: Boolean(catalogException),
      clinicPlan: Boolean(clinicPlan),
      usageMedia: Boolean(usageMedia),
    },
    total: items.length,
    countsBySource,
    countsByPriority,
    items,
  };

  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        outputFile,
        total: items.length,
        countsBySource,
        countsByPriority,
        usageMediaIncluded: Boolean(usageMedia),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});