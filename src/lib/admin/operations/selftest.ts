/**
 * Pure operations monitoring self-tests (no DB).
 */

import {
  alertFingerprint,
  buildAlertFromEvaluation,
  evaluateAlertRules,
  severityRank,
} from "@/lib/admin/operations/rules";
import { gradeFromAlerts } from "@/lib/admin/operations/alerts";
import {
  isRecoveryAllowed,
  listForbiddenRecoveryActions,
} from "@/lib/admin/operations/recovery-policy";
import {
  DEFAULT_MONITORING_CONFIG,
  type OperationsAlert,
  type OperationsMetrics,
} from "@/lib/admin/operations/types";
import {
  DEFAULT_PIPELINE_OPERATION,
  validatePipelineOperationConfig,
} from "@/lib/pipeline/operation-config";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function baseMetrics(
  overrides: Partial<OperationsMetrics> = {}
): OperationsMetrics {
  const checkedAt = new Date().toISOString();
  return {
    checkedAt,
    worker: {
      lastBatchAt: checkedAt,
      lastHeartbeatAt: checkedAt,
      runningBatches: 0,
      staleRunningBatches: 0,
      retryWaitJobs: 0,
      stuckQueuedJobs: 0,
      stuckRunningJobs: 0,
      recentBatchCount: 5,
      recentFailedBatches: 0,
      recentFailureRate: 0,
    },
    collection: {
      urlsDiscovered24h: 10,
      candidates24h: 5,
      drafts24h: 3,
      activated24h: 1,
      officialSitesVerified: 8,
      officialSitesNeedsReview: 1,
      blockedBrands: 0,
      brandSitesTotal: 10,
      crawlFailureRate: 0,
    },
    quality: {
      productsMissingIngredients: 0,
      ingredientMatchRate: 0.8,
      unmatchedIngredientHints: 0,
      qualityLowCount: 0,
      verifiedOffers: 10,
      staleOffers: 0,
      outOfStockOffers: 0,
      offersMissingShipping: 0,
      recommendationEligible: 10,
      verifiedActiveProducts: 10,
      draftProducts: 2,
    },
    review: {
      pending: 2,
      inReview: 0,
      needsReview: 0,
      oldestPendingAgeHours: 2,
      byType: { sale: 1, ingredients: 1 },
      safetyPending: 0,
    },
    recommendation: {
      eligibleTotal: 10,
      eligibleKr: 10,
      categoryCoverageGaps: 0,
      mockBlockedInProduction: true,
      top5BlockReasons: [],
    },
    today: {
      brandsProcessed: 3,
      urlsDiscovered: 10,
      candidates: 5,
      drafts: 3,
      activated: 1,
      verifiedOffers: 10,
      recommendationEligible: 10,
      needsReview: 2,
      failures: 0,
    },
    last7d: {
      successRate: 0.9,
      avgThroughput: 2,
      officialSiteResolutionRate: 0.8,
      ingredientCoverageRate: 0.8,
      ingredientMatchRate: 0.8,
      offerVerificationRate: 0.7,
      eligibleDelta: 1,
      reviewBacklogDelta: 2,
    },
    ...overrides,
  };
}

export function runOperationsSelftests(): { ok: true; checks: number } {
  let checks = 0;
  const cfg = { ...DEFAULT_MONITORING_CONFIG };

  const healthyEvals = evaluateAlertRules(baseMetrics(), cfg);
  assert(
    healthyEvals.filter((e) => e.fired).length === 0,
    "healthy no fires"
  );
  checks += 1;

  const noRun = evaluateAlertRules(
    baseMetrics({
      worker: {
        ...baseMetrics().worker,
        lastBatchAt: new Date(Date.now() - 999 * 60 * 60_000).toISOString(),
      },
    }),
    cfg
  );
  assert(
    noRun.some((e) => e.code === "WORKER_NO_RECENT_RUN" && e.fired),
    "no recent run"
  );
  checks += 1;

  const staleHb = evaluateAlertRules(
    baseMetrics({
      worker: {
        ...baseMetrics().worker,
        runningBatches: 1,
        staleRunningBatches: 1,
        lastHeartbeatAt: new Date(Date.now() - 200 * 60_000).toISOString(),
      },
    }),
    cfg
  );
  assert(
    staleHb.some((e) => e.code === "WORKER_HEARTBEAT_STALE" && e.fired),
    "stale heartbeat"
  );
  checks += 1;

  const failRate = evaluateAlertRules(
    baseMetrics({
      worker: {
        ...baseMetrics().worker,
        recentBatchCount: 10,
        recentFailedBatches: 7,
        recentFailureRate: 0.7,
      },
    }),
    cfg
  );
  assert(
    failRate.some((e) => e.code === "BATCH_FAILURE_RATE_HIGH" && e.fired),
    "failure rate"
  );
  checks += 1;

  const retry = evaluateAlertRules(
    baseMetrics({
      worker: { ...baseMetrics().worker, retryWaitJobs: 55 },
    }),
    cfg
  );
  assert(
    retry.some((e) => e.code === "JOBS_RETRY_BACKLOG" && e.fired),
    "retry backlog"
  );
  checks += 1;

  const stuck = evaluateAlertRules(
    baseMetrics({
      worker: {
        ...baseMetrics().worker,
        stuckQueuedJobs: 2,
        stuckRunningJobs: 1,
      },
    }),
    cfg
  );
  assert(stuck.some((e) => e.code === "JOBS_STUCK" && e.fired), "stuck jobs");
  checks += 1;

  const review = evaluateAlertRules(
    baseMetrics({
      review: {
        ...baseMetrics().review,
        pending: 40,
        needsReview: 10,
        oldestPendingAgeHours: 200,
        safetyPending: 2,
      },
    }),
    cfg
  );
  assert(
    review.some((e) => e.code === "REVIEW_BACKLOG_HIGH" && e.fired),
    "review backlog"
  );
  assert(
    review.some((e) => e.code === "REVIEW_ITEM_TOO_OLD" && e.fired),
    "old review"
  );
  assert(
    review.some((e) => e.code === "SAFETY_REVIEW_PENDING" && e.fired),
    "safety pending"
  );
  checks += 1;

  const ing = evaluateAlertRules(
    baseMetrics({
      quality: {
        ...baseMetrics().quality,
        ingredientMatchRate: 0.2,
        unmatchedIngredientHints: 40,
        verifiedOffers: 0,
        recommendationEligible: 0,
      },
      recommendation: {
        ...baseMetrics().recommendation,
        eligibleKr: 0,
        eligibleTotal: 0,
      },
    }),
    cfg
  );
  assert(
    ing.some((e) => e.code === "INGREDIENT_MATCH_LOW" && e.fired),
    "ingredient match low"
  );
  assert(
    ing.some((e) => e.code === "VERIFIED_OFFER_LOW" && e.fired),
    "offer low"
  );
  assert(
    ing.some((e) => e.code === "RECOMMENDATION_CATALOG_LOW" && e.fired),
    "catalog low"
  );
  checks += 1;

  const fp1 = alertFingerprint("VERIFIED_OFFER_LOW", "offer", null);
  const fp2 = alertFingerprint("VERIFIED_OFFER_LOW", "offer", null);
  assert(fp1 === fp2, "fingerprint stable");
  const ev = ing.find((e) => e.code === "VERIFIED_OFFER_LOW" && e.fired)!;
  const a1 = buildAlertFromEvaluation(ev, new Date().toISOString());
  const a2 = buildAlertFromEvaluation(ev, new Date().toISOString(), {
    firstDetectedAt: a1!.firstDetectedAt,
    occurrenceCount: 3,
    status: "open",
    resolvedAt: null,
  });
  assert(a1!.fingerprint === a2!.fingerprint, "dedupe fingerprint");
  assert(a2!.occurrenceCount === 4, "occurrence bump");
  const reopened = buildAlertFromEvaluation(ev, new Date().toISOString(), {
    firstDetectedAt: a1!.firstDetectedAt,
    occurrenceCount: 4,
    status: "resolved",
    resolvedAt: new Date().toISOString(),
  });
  assert(reopened!.status === "reopened", "reopened");
  checks += 1;

  const sampleAlerts: OperationsAlert[] = [
    {
      ...a1!,
      severity: "warning",
    },
    {
      ...a1!,
      code: "WORKER_HEARTBEAT_STALE",
      severity: "critical",
      fingerprint: "x",
    },
  ];
  assert(gradeFromAlerts(sampleAlerts) === "critical", "critical grade");
  assert(
    severityRank("critical") < severityRank("warning"),
    "severity sort"
  );
  assert(!JSON.stringify(a1).includes("@"), "no email in alert");
  assert(!JSON.stringify(a1).includes("password"), "no password");
  checks += 1;

  assert(isRecoveryAllowed("requeue_stale_running_jobs"), "recovery allow");
  assert(!isRecoveryAllowed("delete_products"), "recovery deny delete");
  assert(
    listForbiddenRecoveryActions().includes("publish_products"),
    "forbid publish"
  );
  checks += 1;

  const cfgOk = validatePipelineOperationConfig({
    ...DEFAULT_PIPELINE_OPERATION,
    version: 5,
    monitoring: DEFAULT_MONITORING_CONFIG,
  });
  assert(cfgOk.ok === true, "monitoring config ok");
  checks += 1;

  return { ok: true, checks };
}
