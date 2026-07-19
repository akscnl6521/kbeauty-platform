export type CatalogRefreshPriority = "urgent" | "high" | "normal" | "low";

export type CatalogRefreshPlanItem = {
  canonicalKey: string;
  slug: string;
  brand: string;
  nameKo: string;
  officialUrl: string | null;
  refresh: {
    priority: CatalogRefreshPriority;
    nextCheckAt: string;
    checks: string[];
  };
};

export type CatalogRefreshDueQueue = {
  generatedAt: string;
  cutoffAt: string;
  productionTouched: false;
  databaseTouched: false;
  writeMode: "artifact_only";
  summary: {
    totalDue: number;
    byPriority: Record<CatalogRefreshPriority, number>;
    byCheck: Record<string, number>;
  };
  items: CatalogRefreshPlanItem[];
};

const priorityRank: Record<CatalogRefreshPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export function buildCatalogRefreshDueQueue(
  items: CatalogRefreshPlanItem[],
  cutoff = new Date()
): CatalogRefreshDueQueue {
  const cutoffMs = cutoff.getTime();
  if (!Number.isFinite(cutoffMs)) throw new Error("INVALID_REFRESH_CUTOFF");

  const due = items
    .filter((item) => {
      const nextCheckMs = Date.parse(item.refresh.nextCheckAt);
      if (!Number.isFinite(nextCheckMs)) {
        throw new Error(`INVALID_NEXT_CHECK_AT:${item.canonicalKey}`);
      }
      return nextCheckMs <= cutoffMs;
    })
    .sort((a, b) => {
      const priorityDiff =
        priorityRank[a.refresh.priority] - priorityRank[b.refresh.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.refresh.nextCheckAt.localeCompare(b.refresh.nextCheckAt);
    });

  const byPriority: Record<CatalogRefreshPriority, number> = {
    urgent: 0,
    high: 0,
    normal: 0,
    low: 0,
  };
  const byCheck: Record<string, number> = {};

  for (const item of due) {
    byPriority[item.refresh.priority] += 1;
    for (const check of item.refresh.checks) {
      byCheck[check] = (byCheck[check] ?? 0) + 1;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    cutoffAt: cutoff.toISOString(),
    productionTouched: false,
    databaseTouched: false,
    writeMode: "artifact_only",
    summary: {
      totalDue: due.length,
      byPriority,
      byCheck,
    },
    items: due,
  };
}
