/**
 * Operations alert rule registry (pure evaluation).
 */

import { getAlertGuidance } from "@/lib/admin/operations/recommendations";
import type {
  AlertSeverity,
  MonitoringConfig,
  OperationsAlert,
  OperationsAlertCode,
  OperationsMetrics,
} from "@/lib/admin/operations/types";

export type RuleEvaluation = {
  code: OperationsAlertCode;
  fired: boolean;
  severity: AlertSeverity;
  title: string;
  message: string;
  affectedCount: number;
  threshold: number | string;
  currentValue: number | string;
  entityType: string;
  safeEntityReference: string | null;
  autoRecoverable: boolean;
};

type RuleDef = {
  code: OperationsAlertCode;
  title: string;
  entityType: string;
  evaluate: (
    m: OperationsMetrics,
    cfg: MonitoringConfig
  ) => Omit<
    RuleEvaluation,
    "code" | "title" | "entityType" | "autoRecoverable"
  > & { fired: boolean; autoRecoverable?: boolean };
};

function rate(n: number, d: number): number {
  if (d <= 0) return 0;
  return n / d;
}

export function alertFingerprint(
  code: OperationsAlertCode,
  scope: string,
  safeRef: string | null
): string {
  return `${code}|${scope}|${safeRef ?? "global"}`;
}

const RULES: RuleDef[] = [
  {
    code: "WORKER_NO_RECENT_RUN",
    title: "최근 worker 실행 없음",
    entityType: "worker",
    evaluate: (m, cfg) => {
      const ageMin = m.worker.lastBatchAt
        ? (Date.now() - Date.parse(m.worker.lastBatchAt)) / 60_000
        : Number.POSITIVE_INFINITY;
      const fired = !Number.isFinite(ageMin) || ageMin > cfg.noRecentRunMinutes;
      return {
        fired,
        severity: ageMin > cfg.noRecentRunMinutes * 2 ? "critical" : "warning",
        message: fired
          ? `마지막 배치가 ${cfg.noRecentRunMinutes}분 기준을 초과했습니다.`
          : "최근 실행 정상",
        affectedCount: fired ? 1 : 0,
        threshold: cfg.noRecentRunMinutes,
        currentValue: Number.isFinite(ageMin) ? Math.round(ageMin) : "never",
        safeEntityReference: null,
        autoRecoverable: true,
      };
    },
  },
  {
    code: "WORKER_HEARTBEAT_STALE",
    title: "Heartbeat stale",
    entityType: "worker",
    evaluate: (m, cfg) => {
      if (m.worker.runningBatches < 1) {
        return {
          fired: false,
          severity: "info",
          message: "실행 중 배치 없음",
          affectedCount: 0,
          threshold: cfg.staleHeartbeatMinutes,
          currentValue: 0,
          safeEntityReference: null,
        };
      }
      const ageMin = m.worker.lastHeartbeatAt
        ? (Date.now() - Date.parse(m.worker.lastHeartbeatAt)) / 60_000
        : Number.POSITIVE_INFINITY;
      const fired =
        m.worker.staleRunningBatches > 0 ||
        ageMin > cfg.staleHeartbeatMinutes;
      return {
        fired,
        severity: "critical",
        message: fired
          ? "running 배치 heartbeat가 오래되었습니다."
          : "heartbeat 정상",
        affectedCount: m.worker.staleRunningBatches || (fired ? 1 : 0),
        threshold: cfg.staleHeartbeatMinutes,
        currentValue: Number.isFinite(ageMin) ? Math.round(ageMin) : "missing",
        safeEntityReference: null,
        autoRecoverable: true,
      };
    },
  },
  {
    code: "BATCH_FAILURE_RATE_HIGH",
    title: "배치 실패율 높음",
    entityType: "batch",
    evaluate: (m, cfg) => {
      const r = m.worker.recentFailureRate;
      const fired = m.worker.recentBatchCount >= 3 && r >= cfg.batchFailureRateWarning;
      const severity: AlertSeverity =
        r >= cfg.batchFailureRateCritical ? "critical" : "warning";
      return {
        fired,
        severity,
        message: fired
          ? `최근 배치 실패율 ${(r * 100).toFixed(0)}%`
          : "실패율 정상",
        affectedCount: m.worker.recentFailedBatches,
        threshold: cfg.batchFailureRateWarning,
        currentValue: Number(r.toFixed(3)),
        safeEntityReference: null,
        autoRecoverable: true,
      };
    },
  },
  {
    code: "JOBS_RETRY_BACKLOG",
    title: "retry backlog",
    entityType: "job",
    evaluate: (m, cfg) => {
      const n = m.worker.retryWaitJobs;
      const fired = n >= cfg.retryBacklogWarning;
      return {
        fired,
        severity: n >= cfg.retryBacklogCritical ? "critical" : "warning",
        message: fired ? `retry_wait ${n}건` : "retry backlog 정상",
        affectedCount: n,
        threshold: cfg.retryBacklogWarning,
        currentValue: n,
        safeEntityReference: null,
        autoRecoverable: true,
      };
    },
  },
  {
    code: "JOBS_STUCK",
    title: "Stuck jobs",
    entityType: "job",
    evaluate: (m, cfg) => {
      const n = m.worker.stuckQueuedJobs + m.worker.stuckRunningJobs;
      const fired = n > 0;
      return {
        fired,
        severity: n >= 5 ? "critical" : "warning",
        message: fired ? `stuck job ${n}건 (>${cfg.stuckJobMinutes}분)` : "stuck 없음",
        affectedCount: n,
        threshold: cfg.stuckJobMinutes,
        currentValue: n,
        safeEntityReference: null,
        autoRecoverable: true,
      };
    },
  },
  {
    code: "OFFICIAL_SITE_RESOLUTION_LOW",
    title: "공식 사이트 확인률 낮음",
    entityType: "brand",
    evaluate: (m, cfg) => {
      const r = rate(
        m.collection.officialSitesVerified,
        m.collection.brandSitesTotal
      );
      const fired =
        m.collection.brandSitesTotal >= 5 &&
        r < cfg.officialSiteResolutionMinimum;
      return {
        fired,
        severity: "warning",
        message: fired
          ? `공식 사이트 확인률 ${(r * 100).toFixed(0)}%`
          : "공식 사이트 확인률 정상",
        affectedCount: m.collection.officialSitesNeedsReview,
        threshold: cfg.officialSiteResolutionMinimum,
        currentValue: Number(r.toFixed(3)),
        safeEntityReference: null,
      };
    },
  },
  {
    code: "CRAWL_BLOCKED_HIGH",
    title: "Blocked 브랜드 비율 높음",
    entityType: "brand",
    evaluate: (m) => {
      const r = rate(m.collection.blockedBrands, m.collection.brandSitesTotal);
      const fired = m.collection.brandSitesTotal >= 5 && r >= 0.4;
      return {
        fired,
        severity: r >= 0.6 ? "critical" : "warning",
        message: fired ? `blocked 비율 ${(r * 100).toFixed(0)}%` : "blocked 정상",
        affectedCount: m.collection.blockedBrands,
        threshold: 0.4,
        currentValue: Number(r.toFixed(3)),
        safeEntityReference: null,
      };
    },
  },
  {
    code: "CANDIDATE_CREATION_ZERO",
    title: "후보 생성 정체",
    entityType: "candidate",
    evaluate: (m) => {
      const fired =
        m.collection.urlsDiscovered24h >= 5 && m.collection.candidates24h === 0;
      return {
        fired,
        severity: "warning",
        message: fired
          ? "URL 발견은 있으나 후보 생성 0"
          : "후보 생성 정상/해당 없음",
        affectedCount: m.collection.urlsDiscovered24h,
        threshold: 0,
        currentValue: m.collection.candidates24h,
        safeEntityReference: null,
      };
    },
  },
  {
    code: "DRAFT_CREATION_ZERO",
    title: "draft 생성 정체",
    entityType: "product",
    evaluate: (m) => {
      const fired =
        m.collection.candidates24h >= 3 && m.collection.drafts24h === 0;
      return {
        fired,
        severity: "warning",
        message: fired ? "후보는 있으나 draft 0" : "draft 정상/해당 없음",
        affectedCount: m.collection.candidates24h,
        threshold: 0,
        currentValue: m.collection.drafts24h,
        safeEntityReference: null,
      };
    },
  },
  {
    code: "INGREDIENT_EXTRACTION_LOW",
    title: "전성분 확보율 낮음",
    entityType: "ingredient",
    evaluate: (m) => {
      const total =
        m.quality.verifiedActiveProducts + m.quality.draftProducts;
      const missing = m.quality.productsMissingIngredients;
      const coverage = total > 0 ? 1 - missing / total : 1;
      const fired = total >= 10 && coverage < 0.4;
      return {
        fired,
        severity: "warning",
        message: fired
          ? `전성분 확보율 ${(coverage * 100).toFixed(0)}%`
          : "전성분 확보 정상",
        affectedCount: missing,
        threshold: 0.4,
        currentValue: Number(coverage.toFixed(3)),
        safeEntityReference: null,
      };
    },
  },
  {
    code: "INGREDIENT_MATCH_LOW",
    title: "INCI 매칭률 낮음",
    entityType: "ingredient",
    evaluate: (m, cfg) => {
      const r = m.quality.ingredientMatchRate;
      const fired = r > 0 && r < cfg.ingredientMatchMinimum;
      return {
        fired,
        severity: "warning",
        message: fired
          ? `성분 매칭률 ${(r * 100).toFixed(0)}%`
          : "성분 매칭 정상/데이터 부족",
        affectedCount: m.quality.unmatchedIngredientHints,
        threshold: cfg.ingredientMatchMinimum,
        currentValue: Number(r.toFixed(3)),
        safeEntityReference: null,
      };
    },
  },
  {
    code: "UNMATCHED_INGREDIENTS_HIGH",
    title: "Unmatched 성분 과다",
    entityType: "ingredient",
    evaluate: (m) => {
      const fired = m.quality.unmatchedIngredientHints >= 20;
      return {
        fired,
        severity: fired && m.quality.unmatchedIngredientHints >= 50
          ? "critical"
          : "warning",
        message: fired
          ? `unmatched/ambiguous 힌트 ${m.quality.unmatchedIngredientHints}`
          : "unmatched 정상",
        affectedCount: m.quality.unmatchedIngredientHints,
        threshold: 20,
        currentValue: m.quality.unmatchedIngredientHints,
        safeEntityReference: null,
      };
    },
  },
  {
    code: "VERIFIED_OFFER_LOW",
    title: "Verified offer 부족",
    entityType: "offer",
    evaluate: (m, cfg) => {
      const n = m.quality.verifiedOffers;
      const fired = n < cfg.verifiedOfferMinimum;
      return {
        fired,
        severity: n === 0 ? "critical" : "warning",
        message: fired ? `verified offer ${n}건` : "verified offer 충분",
        affectedCount: n,
        threshold: cfg.verifiedOfferMinimum,
        currentValue: n,
        safeEntityReference: null,
      };
    },
  },
  {
    code: "OFFERS_STALE_HIGH",
    title: "Stale offer 과다",
    entityType: "offer",
    evaluate: (m) => {
      const total = m.quality.verifiedOffers + m.quality.staleOffers;
      const r = rate(m.quality.staleOffers, Math.max(total, 1));
      const fired = total >= 5 && r >= 0.5;
      return {
        fired,
        severity: "warning",
        message: fired
          ? `stale offer 비율 ${(r * 100).toFixed(0)}%`
          : "stale offer 정상",
        affectedCount: m.quality.staleOffers,
        threshold: 0.5,
        currentValue: Number(r.toFixed(3)),
        safeEntityReference: null,
        autoRecoverable: true,
      };
    },
  },
  {
    code: "SHIPPING_COVERAGE_LOW",
    title: "배송 커버리지 부족",
    entityType: "offer",
    evaluate: (m, cfg) => {
      const total = m.quality.verifiedOffers;
      const missing = m.quality.offersMissingShipping;
      const coverage = total > 0 ? 1 - missing / total : 1;
      const fired = total >= 3 && coverage < cfg.shippingCoverageMinimum;
      return {
        fired,
        severity: "warning",
        message: fired
          ? `배송 확인률 ${(coverage * 100).toFixed(0)}%`
          : "배송 커버리지 정상",
        affectedCount: missing,
        threshold: cfg.shippingCoverageMinimum,
        currentValue: Number(coverage.toFixed(3)),
        safeEntityReference: null,
      };
    },
  },
  {
    code: "RECOMMENDATION_CATALOG_LOW",
    title: "추천 가능 제품 부족",
    entityType: "recommendation",
    evaluate: (m, cfg) => {
      const n = m.recommendation.eligibleKr;
      const fired = n < cfg.recommendationEligibleMinimum;
      return {
        fired,
        severity: n === 0 ? "critical" : "warning",
        message: fired
          ? `KR recommendation eligible ${n} (Top5 패딩 없음)`
          : "추천 카탈로그 충분",
        affectedCount: n,
        threshold: cfg.recommendationEligibleMinimum,
        currentValue: n,
        safeEntityReference: "KR",
      };
    },
  },
  {
    code: "CATEGORY_COVERAGE_LOW",
    title: "카테고리 커버리지 부족",
    entityType: "recommendation",
    evaluate: (m) => {
      const gaps = m.recommendation.categoryCoverageGaps;
      const fired = gaps >= 3 && m.recommendation.eligibleTotal < 20;
      return {
        fired,
        severity: "info",
        message: fired
          ? `카테고리 공백 ${gaps}`
          : "카테고리 커버리지 정상/해당 없음",
        affectedCount: gaps,
        threshold: 3,
        currentValue: gaps,
        safeEntityReference: null,
      };
    },
  },
  {
    code: "REVIEW_BACKLOG_HIGH",
    title: "검토 적체",
    entityType: "review",
    evaluate: (m, cfg) => {
      const n = m.review.pending + m.review.needsReview;
      const fired = n >= cfg.reviewBacklogWarning;
      return {
        fired,
        severity: n >= cfg.reviewBacklogCritical ? "critical" : "warning",
        message: fired ? `검토 적체 ${n}건` : "검토 적체 정상",
        affectedCount: n,
        threshold: cfg.reviewBacklogWarning,
        currentValue: n,
        safeEntityReference: null,
      };
    },
  },
  {
    code: "REVIEW_ITEM_TOO_OLD",
    title: "오래된 검토 항목",
    entityType: "review",
    evaluate: (m, cfg) => {
      const age = m.review.oldestPendingAgeHours;
      const fired =
        age != null && age >= cfg.reviewAgeWarningHours;
      return {
        fired,
        severity:
          age != null && age >= cfg.reviewAgeCriticalHours
            ? "critical"
            : "warning",
        message: fired
          ? `가장 오래된 pending ${Math.round(age ?? 0)}시간`
          : "검토 연령 정상",
        affectedCount: fired ? 1 : 0,
        threshold: cfg.reviewAgeWarningHours,
        currentValue: age ?? 0,
        safeEntityReference: null,
      };
    },
  },
  {
    code: "SAFETY_REVIEW_PENDING",
    title: "Safety 검토 대기",
    entityType: "review",
    evaluate: (m) => {
      const n = m.review.safetyPending;
      const fired = n > 0;
      return {
        fired,
        severity: n >= 3 ? "critical" : "warning",
        message: fired ? `safety pending ${n}` : "safety 대기 없음",
        affectedCount: n,
        threshold: 0,
        currentValue: n,
        safeEntityReference: "safety",
      };
    },
  },
  {
    code: "PIPELINE_DATA_WRITE_STOPPED",
    title: "파이프라인 데이터 쓰기 정체",
    entityType: "pipeline",
    evaluate: (m) => {
      const fired =
        m.worker.recentBatchCount >= 2 &&
        m.collection.candidates24h === 0 &&
        m.collection.drafts24h === 0 &&
        m.today.failures === 0;
      return {
        fired,
        severity: "warning",
        message: fired
          ? "배치는 있으나 candidate/draft 결과가 없음"
          : "데이터 쓰기 정상/해당 없음",
        affectedCount: m.worker.recentBatchCount,
        threshold: 0,
        currentValue: m.collection.candidates24h,
        safeEntityReference: null,
      };
    },
  },
];

export function listAlertRules(): ReadonlyArray<{
  code: OperationsAlertCode;
  title: string;
  entityType: string;
}> {
  return RULES.map((r) => ({
    code: r.code,
    title: r.title,
    entityType: r.entityType,
  }));
}

/**
 * Evaluate all rules against metrics (pure).
 */
export function evaluateAlertRules(
  metrics: OperationsMetrics,
  cfg: MonitoringConfig,
  nowIso: string = new Date().toISOString()
): RuleEvaluation[] {
  if (!cfg.enabled) return [];
  return RULES.map((rule) => {
    const out = rule.evaluate(metrics, cfg);
    const guidance = getAlertGuidance(rule.code);
    return {
      code: rule.code,
      title: rule.title,
      entityType: rule.entityType,
      autoRecoverable: out.autoRecoverable ?? guidance.autoRetry,
      ...out,
    };
  }).map((r) => ({
    ...r,
    // ensure detected timing fields are applied by caller
  }));
}

export function buildAlertFromEvaluation(
  ev: RuleEvaluation,
  nowIso: string,
  prior?: {
    firstDetectedAt: string;
    occurrenceCount: number;
    status: OperationsAlert["status"];
    resolvedAt: string | null;
  }
): OperationsAlert | null {
  if (!ev.fired) return null;
  const guidance = getAlertGuidance(ev.code);
  const fingerprint = alertFingerprint(
    ev.code,
    ev.entityType,
    ev.safeEntityReference
  );
  return {
    code: ev.code,
    severity: ev.severity,
    title: ev.title,
    message: ev.message,
    detectedAt: nowIso,
    firstDetectedAt: prior?.firstDetectedAt ?? nowIso,
    lastDetectedAt: nowIso,
    affectedCount: ev.affectedCount,
    threshold: ev.threshold,
    currentValue: ev.currentValue,
    entityType: ev.entityType,
    safeEntityReference: ev.safeEntityReference,
    recommendedAction: guidance.operatorSteps.join(" · "),
    status:
      prior?.status === "resolved"
        ? "reopened"
        : prior?.status === "acknowledged"
          ? "acknowledged"
          : prior?.status === "reopened"
            ? "reopened"
            : "open",
    fingerprint,
    occurrenceCount: (prior?.occurrenceCount ?? 0) + 1,
    resolvedAt: null,
    autoRecoverable: ev.autoRecoverable,
    adminLinks: guidance.adminLinks,
  };
}

export function severityRank(s: AlertSeverity): number {
  if (s === "critical") return 0;
  if (s === "warning") return 1;
  return 2;
}
