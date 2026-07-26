/**
 * In-memory store + dry-run transitions for T05 admin ops.
 * Local / Staging dry-run only — never writes remote DB.
 */

import {
  canTransition,
  evidenceReviewSummary,
  nextStatusForTransition,
  planDuplicateMerge,
  shouldRetry,
  buildStaleRefreshQueue,
  type AdminOpsAuditEvent,
  type AdminOpsCandidate,
  type AdminOpsDryRunMode,
  type AdminOpsDryRunResult,
  type AdminOpsEvidenceItem,
  type AdminOpsTransition,
  type DuplicateMergeResult,
  type StaleRefreshQueueItem,
} from "./types";

const candidates = new Map<string, AdminOpsCandidate>();
const audit: AdminOpsAuditEvent[] = [];
let auditSeq = 0;

function nowIso(now: Date): string {
  return now.toISOString();
}

function pushAudit(
  partial: Omit<AdminOpsAuditEvent, "id" | "productionTouched" | "databaseTouched">,
): AdminOpsAuditEvent {
  auditSeq += 1;
  const event: AdminOpsAuditEvent = {
    ...partial,
    id: `audit-${auditSeq}`,
    productionTouched: false,
    databaseTouched: false,
  };
  audit.push(event);
  return event;
}

export function resetAdminOpsStore(): void {
  candidates.clear();
  audit.length = 0;
  auditSeq = 0;
}

export function listAdminOpsCandidates(): AdminOpsCandidate[] {
  return [...candidates.values()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function getAdminOpsCandidate(id: string): AdminOpsCandidate | null {
  return candidates.get(id) ?? null;
}

export function listAdminOpsAuditTrail(limit = 100): AdminOpsAuditEvent[] {
  return audit.slice(-limit).reverse();
}

export function upsertAdminOpsCandidate(
  input: Omit<
    AdminOpsCandidate,
    | "stagingWriteAllowed"
    | "productionWriteAllowed"
    | "createdAt"
    | "updatedAt"
  > & {
    createdAt?: string;
    updatedAt?: string;
  },
  now = new Date(),
): AdminOpsCandidate {
  const existing = candidates.get(input.id);
  const row: AdminOpsCandidate = {
    ...input,
    stagingWriteAllowed: false,
    productionWriteAllowed: false,
    createdAt: existing?.createdAt ?? input.createdAt ?? nowIso(now),
    updatedAt: nowIso(now),
  };
  candidates.set(row.id, row);
  return row;
}

export function reviewEvidence(
  candidateId: string,
  evidenceId: string,
  verified: boolean,
  now = new Date(),
): AdminOpsDryRunResult {
  const current = candidates.get(candidateId);
  if (!current) {
    return {
      mode: "local",
      ok: false,
      applied: false,
      reasons: ["candidate_not_found"],
      candidate: null,
      auditEvent: null,
      stagingWritePerformed: false,
      productionWritePerformed: false,
    };
  }
  const evidence = current.evidence.map((item) =>
    item.id === evidenceId
      ? {
          ...item,
          verified,
          reviewedAt: nowIso(now),
        }
      : item,
  );
  if (!current.evidence.some((e) => e.id === evidenceId)) {
    return {
      mode: "local",
      ok: false,
      applied: false,
      reasons: ["evidence_not_found"],
      candidate: current,
      auditEvent: null,
      stagingWritePerformed: false,
      productionWritePerformed: false,
    };
  }
  const next: AdminOpsCandidate = {
    ...current,
    evidence,
    updatedAt: nowIso(now),
  };
  candidates.set(next.id, next);
  const event = pushAudit({
    at: nowIso(now),
    actor: "admin_dry_run",
    candidateId,
    action: verified ? "evidence_verified" : "evidence_unverified",
    fromStatus: current.reviewStatus,
    toStatus: current.reviewStatus,
    detail: { evidenceId, verified },
  });
  return {
    mode: "local",
    ok: true,
    applied: true,
    reasons: [],
    candidate: next,
    auditEvent: event,
    stagingWritePerformed: false,
    productionWritePerformed: false,
  };
}

export function applyAdminOpsTransition(
  candidateId: string,
  transition: AdminOpsTransition,
  options?: {
    mode?: AdminOpsDryRunMode;
    now?: Date;
    requireEvidenceForApprove?: boolean;
  },
): AdminOpsDryRunResult {
  const mode = options?.mode ?? "local";
  const now = options?.now ?? new Date();
  const current = candidates.get(candidateId);
  if (!current) {
    return {
      mode,
      ok: false,
      applied: false,
      reasons: ["candidate_not_found"],
      candidate: null,
      auditEvent: null,
      stagingWritePerformed: false,
      productionWritePerformed: false,
    };
  }

  if (!canTransition(current.reviewStatus, transition)) {
    return {
      mode,
      ok: false,
      applied: false,
      reasons: ["transition_not_allowed"],
      candidate: current,
      auditEvent: null,
      stagingWritePerformed: false,
      productionWritePerformed: false,
    };
  }

  if (transition === "approve_staging" && options?.requireEvidenceForApprove !== false) {
    const summary = evidenceReviewSummary(current);
    if (summary.incomplete) {
      return {
        mode,
        ok: false,
        applied: false,
        reasons: summary.reasons,
        candidate: current,
        auditEvent: null,
        stagingWritePerformed: false,
        productionWritePerformed: false,
      };
    }
  }

  if (transition === "queue_retry") {
    const retry = shouldRetry(current);
    if (!retry.ok) {
      return {
        mode,
        ok: false,
        applied: false,
        reasons: retry.reasons,
        candidate: current,
        auditEvent: null,
        stagingWritePerformed: false,
        productionWritePerformed: false,
      };
    }
  }

  const toStatus = nextStatusForTransition(transition);
  const next: AdminOpsCandidate = {
    ...current,
    reviewStatus: toStatus,
    retryCount:
      transition === "queue_retry" ? current.retryCount + 1 : current.retryCount,
    lastError: transition === "clear_retry" ? null : current.lastError,
    updatedAt: nowIso(now),
  };
  candidates.set(next.id, next);

  const event = pushAudit({
    at: nowIso(now),
    actor: "admin_dry_run",
    candidateId,
    action: transition,
    fromStatus: current.reviewStatus,
    toStatus,
    detail: { mode },
  });

  return {
    mode,
    ok: true,
    applied: true,
    reasons: [],
    candidate: next,
    auditEvent: event,
    stagingWritePerformed: false,
    productionWritePerformed: false,
  };
}

export function applyDuplicateMerge(
  keepId: string,
  mergeIds: string[],
  now = new Date(),
): DuplicateMergeResult & { auditEvents: AdminOpsAuditEvent[] } {
  const plan = planDuplicateMerge({
    candidates: listAdminOpsCandidates(),
    keepId,
    mergeIds,
  });
  if (!plan.ok || !plan.keptId || !plan.groupId) {
    return { ...plan, auditEvents: [] };
  }

  const keep = candidates.get(plan.keptId)!;
  const updatedKeep: AdminOpsCandidate = {
    ...keep,
    duplicateGroupId: plan.groupId,
    updatedAt: nowIso(now),
  };
  candidates.set(updatedKeep.id, updatedKeep);

  const events: AdminOpsAuditEvent[] = [];
  for (const id of plan.mergedIds) {
    const row = candidates.get(id)!;
    const merged: AdminOpsCandidate = {
      ...row,
      reviewStatus: "merged_away",
      duplicateGroupId: plan.groupId,
      mergedIntoId: plan.keptId,
      updatedAt: nowIso(now),
    };
    candidates.set(id, merged);
    events.push(
      pushAudit({
        at: nowIso(now),
        actor: "admin_dry_run",
        candidateId: id,
        action: "duplicate_merge",
        fromStatus: row.reviewStatus,
        toStatus: "merged_away",
        detail: { keptId: plan.keptId, groupId: plan.groupId },
      }),
    );
  }

  events.push(
    pushAudit({
      at: nowIso(now),
      actor: "admin_dry_run",
      candidateId: plan.keptId,
      action: "duplicate_keep",
      fromStatus: keep.reviewStatus,
      toStatus: keep.reviewStatus,
      detail: { mergedIds: plan.mergedIds, groupId: plan.groupId },
    }),
  );

  return { ...plan, auditEvents: events };
}

export function getStaleRefreshQueue(now = new Date()): StaleRefreshQueueItem[] {
  return buildStaleRefreshQueue(listAdminOpsCandidates(), now);
}

export function buildAdminOpsSummary() {
  const rows = listAdminOpsCandidates();
  const byStatus: Record<string, number> = {};
  for (const row of rows) {
    byStatus[row.reviewStatus] = (byStatus[row.reviewStatus] ?? 0) + 1;
  }
  return {
    total: rows.length,
    byStatus,
    staleQueue: getStaleRefreshQueue().length,
    auditEvents: audit.length,
    productionTouched: false as const,
    databaseTouched: false as const,
    stagingWriteAllowed: false as const,
  };
}

export function seedAdminOpsFixtures(now = new Date()): AdminOpsCandidate[] {
  resetAdminOpsStore();
  const evidenceOk: AdminOpsEvidenceItem[] = [
    {
      id: "ev-1",
      kind: "official_page",
      sourceUrl: "https://brand.example/product",
      verified: true,
      note: "fixture official page",
      reviewedAt: nowIso(now),
    },
  ];
  const evidencePending: AdminOpsEvidenceItem[] = [
    {
      id: "ev-2",
      kind: "usage_media_rights",
      sourceUrl: "https://brand.example/rights",
      verified: false,
      note: "rights pending",
      reviewedAt: null,
    },
  ];

  const seeded = [
    upsertAdminOpsCandidate(
      {
        id: "cand-usage-1",
        kind: "usage_instruction",
        productId: "p-1",
        title: "Serum usage guide KO",
        locale: "ko",
        countryCode: "KR",
        reviewStatus: "candidate",
        duplicateGroupId: null,
        mergedIntoId: null,
        evidence: evidenceOk,
        refreshDueAt: new Date(now.getTime() + 7 * 86400000).toISOString(),
        retryCount: 0,
        lastError: null,
        isFixture: true,
      },
      now,
    ),
    upsertAdminOpsCandidate(
      {
        id: "cand-media-1",
        kind: "usage_media",
        productId: "p-1",
        title: "Application video",
        locale: "ko",
        countryCode: "KR",
        reviewStatus: "in_review",
        duplicateGroupId: "dup-p1",
        mergedIntoId: null,
        evidence: evidencePending,
        refreshDueAt: new Date(now.getTime() - 2 * 86400000).toISOString(),
        retryCount: 1,
        lastError: "rights_check_timeout",
        isFixture: true,
      },
      now,
    ),
    upsertAdminOpsCandidate(
      {
        id: "cand-media-dup",
        kind: "usage_media",
        productId: "p-1",
        title: "Application video duplicate",
        locale: "ko",
        countryCode: "KR",
        reviewStatus: "duplicate_watch",
        duplicateGroupId: "dup-p1",
        mergedIntoId: null,
        evidence: [],
        refreshDueAt: null,
        retryCount: 0,
        lastError: null,
        isFixture: true,
      },
      now,
    ),
    upsertAdminOpsCandidate(
      {
        id: "cand-offer-jp",
        kind: "offer",
        productId: "p-2",
        title: "JP offer candidate",
        locale: "ja",
        countryCode: "JP",
        reviewStatus: "stale",
        duplicateGroupId: null,
        mergedIntoId: null,
        evidence: evidenceOk,
        refreshDueAt: new Date(now.getTime() - 40 * 86400000).toISOString(),
        retryCount: 2,
        lastError: "stale_price_check",
        isFixture: true,
      },
      now,
    ),
  ];
  pushAudit({
    at: nowIso(now),
    actor: "system",
    candidateId: "seed",
    action: "seed_fixtures",
    fromStatus: null,
    toStatus: null,
    detail: { count: seeded.length },
  });
  return seeded;
}
