/**
 * Merge rule evaluations with file-based dedupe / resolve / reopen.
 */

import {
  loadAlertStateStore,
  resolveMissingAlerts,
  upsertOpenAlertState,
} from "@/lib/admin/operations/persistence";
import { getAlertGuidance } from "@/lib/admin/operations/recommendations";
import {
  alertFingerprint,
  buildAlertFromEvaluation,
  evaluateAlertRules,
  severityRank,
} from "@/lib/admin/operations/rules";
import type {
  MonitoringConfig,
  OperationsAlert,
  OperationsAlertCode,
  OperationsMetrics,
} from "@/lib/admin/operations/types";

export function computeOperationsAlerts(
  metrics: OperationsMetrics,
  cfg: MonitoringConfig,
  options?: { persist?: boolean; nowIso?: string }
): OperationsAlert[] {
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const persist = options?.persist !== false;
  const evaluations = evaluateAlertRules(metrics, cfg, nowIso);
  const store = loadAlertStateStore();
  const alerts: OperationsAlert[] = [];
  const active = new Set<string>();

  for (const ev of evaluations) {
    if (!ev.fired) continue;
    const fp = alertFingerprint(
      ev.code,
      ev.entityType,
      ev.safeEntityReference
    );
    active.add(fp);

    let prior = store.alerts[fp];
    if (persist) {
      prior = upsertOpenAlertState(fp, ev.code, nowIso);
    }

    const alert = buildAlertFromEvaluation(ev, nowIso, prior);
    if (alert) {
      if (prior) {
        alert.firstDetectedAt = prior.firstDetectedAt;
        alert.occurrenceCount = prior.occurrenceCount;
        alert.status = prior.status;
      }
      alerts.push(alert);
    }
  }

  if (persist) {
    resolveMissingAlerts(active, nowIso);
  }

  alerts.sort((a, b) => {
    const s = severityRank(a.severity) - severityRank(b.severity);
    if (s !== 0) return s;
    return Date.parse(b.lastDetectedAt) - Date.parse(a.lastDetectedAt);
  });

  return alerts;
}

export function getAlertDetail(
  code: OperationsAlertCode,
  alerts: OperationsAlert[]
): {
  alert: OperationsAlert | null;
  guidance: ReturnType<typeof getAlertGuidance>;
  historical: boolean;
} {
  const guidance = getAlertGuidance(code);
  const open = alerts.find((a) => a.code === code) ?? null;
  if (open) return { alert: open, guidance, historical: false };

  const store = loadAlertStateStore();
  const hist = Object.values(store.alerts).find((s) => s.code === code);
  if (!hist) return { alert: null, guidance, historical: false };

  return {
    alert: {
      code,
      severity: "info",
      title: guidance.definition.slice(0, 40),
      message: "현재는 해소됨(resolved) 또는 비활성",
      detectedAt: hist.lastDetectedAt,
      firstDetectedAt: hist.firstDetectedAt,
      lastDetectedAt: hist.lastDetectedAt,
      affectedCount: 0,
      threshold: "—",
      currentValue: "resolved",
      entityType: "history",
      safeEntityReference: null,
      recommendedAction: guidance.operatorSteps.join(" · "),
      status: hist.status,
      fingerprint: hist.fingerprint,
      occurrenceCount: hist.occurrenceCount,
      resolvedAt: hist.resolvedAt,
      autoRecoverable: guidance.autoRetry,
      adminLinks: guidance.adminLinks,
    },
    guidance,
    historical: true,
  };
}

export function gradeFromAlerts(
  alerts: OperationsAlert[]
): "healthy" | "attention" | "warning" | "critical" {
  if (alerts.some((a) => a.severity === "critical" && a.status !== "resolved")) {
    return "critical";
  }
  if (alerts.some((a) => a.severity === "warning" && a.status !== "resolved")) {
    return "warning";
  }
  if (alerts.some((a) => a.severity === "info" && a.status !== "resolved")) {
    return "attention";
  }
  return "healthy";
}
