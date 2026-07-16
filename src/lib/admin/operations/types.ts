/**
 * Operations monitoring types (safe for admin UI — no secrets/PII).
 */

export type HealthGrade =
  | "healthy"
  | "attention"
  | "warning"
  | "critical"
  | "unknown";

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertStatus =
  | "open"
  | "acknowledged"
  | "resolved"
  | "reopened";

export type OperationsAlertCode =
  | "WORKER_NO_RECENT_RUN"
  | "WORKER_HEARTBEAT_STALE"
  | "BATCH_FAILURE_RATE_HIGH"
  | "JOBS_RETRY_BACKLOG"
  | "JOBS_STUCK"
  | "OFFICIAL_SITE_RESOLUTION_LOW"
  | "CRAWL_BLOCKED_HIGH"
  | "CANDIDATE_CREATION_ZERO"
  | "DRAFT_CREATION_ZERO"
  | "INGREDIENT_EXTRACTION_LOW"
  | "INGREDIENT_MATCH_LOW"
  | "UNMATCHED_INGREDIENTS_HIGH"
  | "VERIFIED_OFFER_LOW"
  | "OFFERS_STALE_HIGH"
  | "SHIPPING_COVERAGE_LOW"
  | "RECOMMENDATION_CATALOG_LOW"
  | "CATEGORY_COVERAGE_LOW"
  | "REVIEW_BACKLOG_HIGH"
  | "REVIEW_ITEM_TOO_OLD"
  | "SAFETY_REVIEW_PENDING"
  | "PIPELINE_DATA_WRITE_STOPPED";

export type OperationsMetrics = {
  checkedAt: string;
  worker: {
    lastBatchAt: string | null;
    lastHeartbeatAt: string | null;
    runningBatches: number;
    staleRunningBatches: number;
    retryWaitJobs: number;
    stuckQueuedJobs: number;
    stuckRunningJobs: number;
    recentBatchCount: number;
    recentFailedBatches: number;
    recentFailureRate: number;
  };
  collection: {
    urlsDiscovered24h: number;
    candidates24h: number;
    drafts24h: number;
    activated24h: number;
    officialSitesVerified: number;
    officialSitesNeedsReview: number;
    blockedBrands: number;
    brandSitesTotal: number;
    crawlFailureRate: number;
  };
  quality: {
    productsMissingIngredients: number;
    ingredientMatchRate: number;
    unmatchedIngredientHints: number;
    qualityLowCount: number;
    verifiedOffers: number;
    staleOffers: number;
    outOfStockOffers: number;
    offersMissingShipping: number;
    recommendationEligible: number;
    verifiedActiveProducts: number;
    draftProducts: number;
  };
  review: {
    pending: number;
    inReview: number;
    needsReview: number;
    oldestPendingAgeHours: number | null;
    byType: Record<string, number>;
    safetyPending: number;
  };
  recommendation: {
    eligibleTotal: number;
    eligibleKr: number;
    categoryCoverageGaps: number;
    mockBlockedInProduction: boolean;
    top5BlockReasons: string[];
  };
  today: {
    brandsProcessed: number;
    urlsDiscovered: number;
    candidates: number;
    drafts: number;
    activated: number;
    verifiedOffers: number;
    recommendationEligible: number;
    needsReview: number;
    failures: number;
  };
  last7d: {
    successRate: number;
    avgThroughput: number;
    officialSiteResolutionRate: number;
    ingredientCoverageRate: number;
    ingredientMatchRate: number;
    offerVerificationRate: number;
    eligibleDelta: number;
    reviewBacklogDelta: number;
  };
};

export type OperationsAlert = {
  code: OperationsAlertCode;
  severity: AlertSeverity;
  title: string;
  message: string;
  detectedAt: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  affectedCount: number;
  threshold: number | string;
  currentValue: number | string;
  entityType: string;
  safeEntityReference: string | null;
  recommendedAction: string;
  status: AlertStatus;
  fingerprint: string;
  occurrenceCount: number;
  resolvedAt: string | null;
  autoRecoverable: boolean;
  adminLinks: Array<{ href: string; label: string }>;
};

export type OperationsHealthSnapshot = {
  grade: HealthGrade;
  checkedAt: string;
  monitoringEnabled: boolean;
  metrics: OperationsMetrics;
  alerts: OperationsAlert[];
  openCritical: number;
  openWarning: number;
  openInfo: number;
};

export type MonitoringConfig = {
  enabled: boolean;
  healthCheckIntervalMinutes: number;
  noRecentRunMinutes: number;
  staleHeartbeatMinutes: number;
  stuckJobMinutes: number;
  retryBacklogWarning: number;
  retryBacklogCritical: number;
  batchFailureRateWarning: number;
  batchFailureRateCritical: number;
  reviewBacklogWarning: number;
  reviewBacklogCritical: number;
  reviewAgeWarningHours: number;
  reviewAgeCriticalHours: number;
  recommendationEligibleMinimum: number;
  verifiedOfferMinimum: number;
  ingredientMatchMinimum: number;
  officialSiteResolutionMinimum: number;
  shippingCoverageMinimum: number;
  alertCooldownMinutes: number;
  autoRecoveryEnabled: boolean;
};

export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  enabled: true,
  healthCheckIntervalMinutes: 30,
  noRecentRunMinutes: 720,
  staleHeartbeatMinutes: 45,
  stuckJobMinutes: 180,
  retryBacklogWarning: 20,
  retryBacklogCritical: 50,
  batchFailureRateWarning: 0.35,
  batchFailureRateCritical: 0.6,
  reviewBacklogWarning: 30,
  reviewBacklogCritical: 80,
  reviewAgeWarningHours: 48,
  reviewAgeCriticalHours: 168,
  recommendationEligibleMinimum: 5,
  verifiedOfferMinimum: 3,
  ingredientMatchMinimum: 0.5,
  officialSiteResolutionMinimum: 0.4,
  shippingCoverageMinimum: 0.3,
  alertCooldownMinutes: 60,
  autoRecoveryEnabled: true,
};
