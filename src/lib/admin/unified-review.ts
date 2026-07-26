import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export type ReviewSource =
  | "catalog_refresh"
  | "catalog_exception"
  | "clinic_review";

export type ReviewPriority = "critical" | "high" | "medium" | "low";
export type ManifestDeliverySource = "remote_preview" | "local_file" | "none";

export type UnifiedReviewItem = {
  id: string;
  source: ReviewSource;
  priority: ReviewPriority;
  title: string;
  payload: Record<string, unknown>;
};

export type UnifiedReviewManifest = {
  generatedAt: string | null;
  mode: "artifact_only";
  publishAllowed: false;
  databaseTouched: false;
  productionTouched: false;
  sourcePresence: {
    catalogRefresh: boolean;
    catalogException: boolean;
    clinicPlan: boolean;
  };
  total: number;
  countsBySource: Record<ReviewSource, number>;
  countsByPriority: Record<ReviewPriority, number>;
  items: UnifiedReviewItem[];
  available: boolean;
  deliverySource: ManifestDeliverySource;
};

const EMPTY_MANIFEST: UnifiedReviewManifest = {
  generatedAt: null,
  mode: "artifact_only",
  publishAllowed: false,
  databaseTouched: false,
  productionTouched: false,
  sourcePresence: {
    catalogRefresh: false,
    catalogException: false,
    clinicPlan: false,
  },
  total: 0,
  countsBySource: {
    catalog_refresh: 0,
    catalog_exception: 0,
    clinic_review: 0,
  },
  countsByPriority: {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  },
  items: [],
  available: false,
  deliverySource: "none",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSource(value: unknown): value is ReviewSource {
  return (
    value === "catalog_refresh" ||
    value === "catalog_exception" ||
    value === "clinic_review"
  );
}

function isPriority(value: unknown): value is ReviewPriority {
  return (
    value === "critical" ||
    value === "high" ||
    value === "medium" ||
    value === "low"
  );
}

function parseManifest(
  value: unknown,
  deliverySource: ManifestDeliverySource,
): UnifiedReviewManifest {
  if (!isRecord(value)) throw new Error("Unified review manifest must be an object");
  if (value.mode !== "artifact_only") throw new Error("Unified review manifest must be artifact_only");
  if (value.publishAllowed !== false) throw new Error("Unified review manifest must block publishing");
  if (value.databaseTouched !== false) throw new Error("Unified review manifest must not touch the database");
  if (value.productionTouched !== false) throw new Error("Unified review manifest must not touch Production");

  const rawItems = Array.isArray(value.items) ? value.items : [];
  const items = rawItems.flatMap<UnifiedReviewItem>((item) => {
    if (!isRecord(item)) return [];
    if (typeof item.id !== "string" || !item.id.trim()) return [];
    if (!isSource(item.source) || !isPriority(item.priority)) return [];
    return [
      {
        id: item.id,
        source: item.source,
        priority: item.priority,
        title:
          typeof item.title === "string" && item.title.trim()
            ? item.title.trim()
            : "검수 항목",
        payload: isRecord(item.payload) ? item.payload : {},
      },
    ];
  });

  const countSource = (source: ReviewSource) =>
    items.filter((item) => item.source === source).length;
  const countPriority = (priority: ReviewPriority) =>
    items.filter((item) => item.priority === priority).length;

  const sourcePresence = isRecord(value.sourcePresence)
    ? value.sourcePresence
    : {};

  return {
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : null,
    mode: "artifact_only",
    publishAllowed: false,
    databaseTouched: false,
    productionTouched: false,
    sourcePresence: {
      catalogRefresh: sourcePresence.catalogRefresh === true,
      catalogException: sourcePresence.catalogException === true,
      clinicPlan: sourcePresence.clinicPlan === true,
    },
    total: items.length,
    countsBySource: {
      catalog_refresh: countSource("catalog_refresh"),
      catalog_exception: countSource("catalog_exception"),
      clinic_review: countSource("clinic_review"),
    },
    countsByPriority: {
      critical: countPriority("critical"),
      high: countPriority("high"),
      medium: countPriority("medium"),
      low: countPriority("low"),
    },
    items,
    available: true,
    deliverySource,
  };
}

function getPreviewManifestUrl(): URL | null {
  if (process.env.VERCEL_ENV === "production" || process.env.APP_ENV === "production") {
    return null;
  }

  const raw = process.env.UNIFIED_REVIEW_MANIFEST_URL?.trim();
  if (raw) {
    const url = new URL(raw);
    if (url.protocol !== "https:") {
      throw new Error("UNIFIED_REVIEW_MANIFEST_URL must use HTTPS");
    }
    return url;
  }

  // Same-deployment Preview auto path (no dashboard env required for code path).
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (process.env.VERCEL_ENV === "preview" && vercelUrl) {
    const host = vercelUrl.replace(/^https?:\/\//, "");
    return new URL(`https://${host}/api/public/unified-review-manifest`);
  }

  return null;
}

async function readRemotePreviewManifest(url: URL): Promise<UnifiedReviewManifest> {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(5_000),
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Unified review manifest request failed: ${response.status}`);
  }
  return parseManifest((await response.json()) as unknown, "remote_preview");
}

export async function getUnifiedReviewManifest(): Promise<UnifiedReviewManifest> {
  const previewUrl = getPreviewManifestUrl();
  if (previewUrl) {
    try {
      return await readRemotePreviewManifest(previewUrl);
    } catch {
      // Remote path failed — fall back to local artifact for Preview resilience.
    }
  }

  const filePath = path.join(
    process.cwd(),
    "data",
    "review",
    "unified-review-manifest.json",
  );

  try {
    return parseManifest(
      JSON.parse(await readFile(filePath, "utf8")) as unknown,
      "local_file",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return EMPTY_MANIFEST;
    }
    throw error;
  }
}
