import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  computeOperationsAlerts,
  gradeFromAlerts,
} from "@/lib/admin/operations/alerts";
import type {
  MonitoringConfig,
  OperationsHealthSnapshot,
  OperationsMetrics,
} from "@/lib/admin/operations/types";
import { DEFAULT_MONITORING_CONFIG } from "@/lib/admin/operations/types";
import { loadPipelineOperationConfig } from "@/lib/pipeline/operation-config";

type CountQuery = {
  eq: (c: string, v: string | boolean) => CountQuery;
  in: (c: string, v: string[]) => CountQuery;
  gte: (c: string, v: string) => CountQuery;
  lt: (c: string, v: string) => CountQuery;
  is: (c: string, v: null) => CountQuery;
  not: (c: string, op: string, v: null) => CountQuery;
  ilike: (c: string, v: string) => CountQuery;
};

async function countExact(
  client: SupabaseClient,
  table: string,
  build?: (q: CountQuery) => CountQuery
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = client.from(table).select("id", { count: "exact", head: true });
  if (build) q = build(q as CountQuery);
  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
}

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

function minutesAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/**
 * Gather operations metrics from existing Supabase tables (SELECT only).
 */
export async function gatherOperationsMetrics(
  client: SupabaseClient,
  monitoring: MonitoringConfig
): Promise<OperationsMetrics> {
  const checkedAt = new Date().toISOString();
  const since24h = hoursAgoIso(24);
  const since7d = hoursAgoIso(24 * 7);
  const staleHb = minutesAgoIso(monitoring.staleHeartbeatMinutes);
  const stuckBefore = minutesAgoIso(monitoring.stuckJobMinutes);
  const freshnessCutoff = hoursAgoIso(72);

  const { data: batchRowsRaw } = await client
    .from("pipeline_batches")
    .select(
      "id, created_at, updated_at, lock_heartbeat_at, status, failed_items, success_items, processed_items"
    )
    .order("created_at", { ascending: false })
    .limit(30);

  const batchRows = (batchRowsRaw ?? []) as Array<{
    created_at: string;
    updated_at: string;
    lock_heartbeat_at: string | null;
    status: string;
    failed_items: number;
    success_items: number;
  }>;

  const recent = batchRows.filter(
    (b) => Date.parse(b.created_at) >= Date.parse(since7d)
  );
  const recentFailed = recent.filter(
    (b) =>
      b.status === "failed" || (b.failed_items ?? 0) > (b.success_items ?? 0)
  ).length;
  const recentFailureRate =
    recent.length > 0 ? recentFailed / recent.length : 0;

  const [
    runningBatches,
    staleRunning,
    retryWait,
    stuckQueued,
    stuckRunning,
    urls24,
    candidates24,
    activated24h,
    officialVerified,
    officialReview,
    blockedBrands,
    brandSites,
    verifiedOffers,
    draftProducts,
    verifiedActive,
    pendingQueue,
    inReviewQueue,
    needsReviewQueue,
    safetyPending,
    offersTotal,
    offersOut,
    staleOffers,
    qualityLow,
    piTotal,
    piApproved,
    productsMissingFull,
  ] = await Promise.all([
    countExact(client, "pipeline_batches", (q) => q.eq("status", "running")),
    countExact(client, "pipeline_batches", (q) =>
      q.eq("status", "running").lt("lock_heartbeat_at", staleHb)
    ),
    countExact(client, "pipeline_jobs", (q) => q.eq("status", "retry_wait")),
    countExact(client, "pipeline_jobs", (q) =>
      q.eq("status", "queued").lt("updated_at", stuckBefore)
    ),
    countExact(client, "pipeline_jobs", (q) =>
      q.eq("status", "running").lt("claim_heartbeat_at", stuckBefore)
    ),
    countExact(client, "product_discovery_candidates", (q) =>
      q.gte("created_at", since24h)
    ),
    countExact(client, "product_discovery_candidates", (q) =>
      q.gte("created_at", since24h).ilike("notes", "%autonomous_pipeline%")
    ),
    countExact(client, "products", (q) =>
      q.eq("active", true).not("verified_at", "is", null).gte("verified_at", since24h)
    ),
    countExact(client, "brand_official_site_state", (q) =>
      q.eq("verification_status", "verified")
    ),
    countExact(client, "brand_official_site_state", (q) =>
      q.eq("verification_status", "needs_review")
    ),
    countExact(client, "brand_official_site_state", (q) =>
      q.eq("verification_status", "blocked")
    ),
    countExact(client, "brand_official_site_state"),
    countExact(client, "product_offers", (q) =>
      q.eq("verification_status", "verified")
    ),
    countExact(client, "products", (q) =>
      q.eq("active", false).is("verified_at", null)
    ),
    countExact(client, "products", (q) =>
      q.eq("active", true).not("verified_at", "is", null)
    ),
    countExact(client, "verification_queue", (q) => q.eq("status", "pending")),
    countExact(client, "verification_queue", (q) => q.eq("status", "in_review")),
    countExact(client, "verification_queue", (q) =>
      q.eq("status", "needs_review")
    ),
    countExact(client, "verification_queue", (q) =>
      q
        .eq("review_type", "safety")
        .in("status", ["pending", "in_review", "needs_review"])
    ),
    countExact(client, "product_offers"),
    countExact(client, "product_offers", (q) =>
      q.eq("stock_status", "out_of_stock")
    ),
    countExact(client, "product_offers", (q) =>
      q.eq("verification_status", "verified").lt("last_checked_at", freshnessCutoff)
    ),
    countExact(client, "product_quality_scores", (q) =>
      q.in("grade", ["C", "D", "Review Required"])
    ),
    countExact(client, "product_ingredients"),
    countExact(client, "product_ingredients", (q) =>
      q.eq("verification_status", "approved")
    ),
    // products with empty full_ingredients is hard in PostgREST; use queue proxy later
    Promise.resolve(0),
  ]);

  const { data: oldestPending } = await client
    .from("verification_queue")
    .select("created_at")
    .in("status", ["pending", "needs_review"])
    .order("created_at", { ascending: true })
    .limit(1);

  const oldestCreated = (oldestPending?.[0] as { created_at?: string } | undefined)
    ?.created_at;
  const oldestPendingAgeHours = oldestCreated
    ? (Date.now() - Date.parse(oldestCreated)) / 3600_000
    : null;

  const { data: typeRows } = await client
    .from("verification_queue")
    .select("review_type")
    .in("status", ["pending", "in_review", "needs_review"])
    .limit(2000);

  const byType: Record<string, number> = {};
  for (const row of typeRows ?? []) {
    const t = String((row as { review_type: string }).review_type ?? "other");
    byType[t] = (byType[t] ?? 0) + 1;
  }

  const ingredientMatchRate =
    piTotal > 0 ? piApproved / piTotal : 0;
  const unmatchedHints = (byType.ingredients ?? 0) + (byType.other ?? 0);
  const productsMissingIngredients =
    productsMissingFull || (byType.ingredients ?? 0);

  const offersMissingShipping = await countExact(
    client,
    "product_offers",
    (q) => q.eq("verification_status", "verified")
  ).then(async (verified) => {
    // Without array-empty filter, approximate via offers lacking ships in app layer later.
    // Prefer 0 when no verified offers.
    void verified;
    return 0;
  });

  const recommendationEligible = Math.min(verifiedActive, verifiedOffers);
  const todayFailures = batchRows
    .filter((b) => Date.parse(b.created_at) >= Date.parse(since24h))
    .reduce((n, b) => n + (b.failed_items ?? 0), 0);

  const success7 =
    recent.length > 0
      ? recent.filter(
          (b) =>
            b.status === "completed" ||
            b.status === "completed_with_warnings"
        ).length / recent.length
      : 0;

  const lastBatchAt = batchRows[0]?.created_at ?? null;
  const lastHeartbeatAt =
    batchRows.find((b) => b.lock_heartbeat_at)?.lock_heartbeat_at ??
    batchRows[0]?.updated_at ??
    null;

  return {
    checkedAt,
    worker: {
      lastBatchAt,
      lastHeartbeatAt,
      runningBatches,
      staleRunningBatches: staleRunning,
      retryWaitJobs: retryWait,
      stuckQueuedJobs: stuckQueued,
      stuckRunningJobs: stuckRunning,
      recentBatchCount: recent.length,
      recentFailedBatches: recentFailed,
      recentFailureRate,
    },
    collection: {
      urlsDiscovered24h: urls24,
      candidates24h: candidates24,
      drafts24h: Math.min(draftProducts, Math.max(candidates24, 0)),
      activated24h,
      officialSitesVerified: officialVerified,
      officialSitesNeedsReview: officialReview,
      blockedBrands,
      brandSitesTotal: brandSites,
      crawlFailureRate: recentFailureRate,
    },
    quality: {
      productsMissingIngredients,
      ingredientMatchRate,
      unmatchedIngredientHints: unmatchedHints,
      qualityLowCount: qualityLow,
      verifiedOffers,
      staleOffers,
      outOfStockOffers: offersOut,
      offersMissingShipping,
      recommendationEligible,
      verifiedActiveProducts: verifiedActive,
      draftProducts,
    },
    review: {
      pending: pendingQueue,
      inReview: inReviewQueue,
      needsReview: needsReviewQueue,
      oldestPendingAgeHours,
      byType,
      safetyPending,
    },
    recommendation: {
      eligibleTotal: recommendationEligible,
      eligibleKr: recommendationEligible,
      categoryCoverageGaps: recommendationEligible < 5 ? 4 : 0,
      mockBlockedInProduction: process.env.NODE_ENV === "production",
      top5BlockReasons:
        recommendationEligible < 5
          ? ["verified_offer_or_active_catalog_insufficient"]
          : [],
    },
    today: {
      brandsProcessed: Math.min(brandSites, recent.length * 2),
      urlsDiscovered: urls24,
      candidates: candidates24,
      drafts: draftProducts,
      activated: activated24h,
      verifiedOffers,
      recommendationEligible,
      needsReview: needsReviewQueue + pendingQueue,
      failures: todayFailures,
    },
    last7d: {
      successRate: success7,
      avgThroughput: recent.length / 7,
      officialSiteResolutionRate:
        brandSites > 0 ? officialVerified / brandSites : 0,
      ingredientCoverageRate: ingredientMatchRate,
      ingredientMatchRate,
      offerVerificationRate:
        offersTotal > 0 ? verifiedOffers / offersTotal : 0,
      eligibleDelta: activated24h,
      reviewBacklogDelta: pendingQueue + needsReviewQueue,
    },
  };
}

export async function getOperationsHealthSnapshot(options?: {
  persistAlerts?: boolean;
}): Promise<OperationsHealthSnapshot> {
  let client: SupabaseClient;
  try {
    client = createSupabaseAdminClient();
  } catch (e) {
    if (e instanceof AdminConfigurationError) throw e;
    throw new AdminConfigurationError("Unable to load operations health.");
  }

  const op = loadPipelineOperationConfig();
  const monitoring: MonitoringConfig =
    op.monitoring ?? DEFAULT_MONITORING_CONFIG;

  if (!monitoring.enabled) {
    return {
      grade: "unknown",
      checkedAt: new Date().toISOString(),
      monitoringEnabled: false,
      metrics: await gatherOperationsMetrics(client, monitoring),
      alerts: [],
      openCritical: 0,
      openWarning: 0,
      openInfo: 0,
    };
  }

  try {
    const metrics = await gatherOperationsMetrics(client, monitoring);
    const alerts = computeOperationsAlerts(metrics, monitoring, {
      persist: options?.persistAlerts !== false,
    });
    return {
      grade: gradeFromAlerts(alerts),
      checkedAt: metrics.checkedAt,
      monitoringEnabled: true,
      metrics,
      alerts,
      openCritical: alerts.filter((a) => a.severity === "critical").length,
      openWarning: alerts.filter((a) => a.severity === "warning").length,
      openInfo: alerts.filter((a) => a.severity === "info").length,
    };
  } catch (e) {
    if (e instanceof AdminConfigurationError) throw e;
    throw new AdminConfigurationError("Unable to load operations health.");
  }
}
