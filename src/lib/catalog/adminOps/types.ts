/**
 * T05 — Catalog / usage-media admin operations (in-memory dry-run).
 * Candidate review · duplicate merge · evidence · transitions · stale refresh ·
 * retry · audit trail. No Production / Staging DB writes from this module.
 */

export type AdminOpsReviewStatus =
  | "candidate"
  | "in_review"
  | "evidence_pending"
  | "duplicate_watch"
  | "approved_staging"
  | "rejected"
  | "merged_away"
  | "stale"
  | "retry_queued";

export type AdminOpsEntityKind =
  | "product_candidate"
  | "usage_media"
  | "usage_instruction"
  | "offer"
  | "evidence";

export type AdminOpsEvidenceItem = {
  id: string;
  kind: "official_page" | "inci_label" | "retailer" | "usage_media_rights" | "other";
  sourceUrl: string | null;
  verified: boolean;
  note: string | null;
  reviewedAt: string | null;
};

export type AdminOpsCandidate = {
  id: string;
  kind: AdminOpsEntityKind;
  productId: string | null;
  title: string;
  locale: string | null;
  countryCode: string | null;
  reviewStatus: AdminOpsReviewStatus;
  duplicateGroupId: string | null;
  mergedIntoId: string | null;
  evidence: AdminOpsEvidenceItem[];
  refreshDueAt: string | null;
  retryCount: number;
  lastError: string | null;
  isFixture: boolean;
  stagingWriteAllowed: false;
  productionWriteAllowed: false;
  updatedAt: string;
  createdAt: string;
};

export type AdminOpsTransition =
  | "start_review"
  | "request_evidence"
  | "approve_staging"
  | "reject"
  | "mark_duplicate"
  | "mark_stale"
  | "queue_retry"
  | "clear_retry";

export type AdminOpsAuditEvent = {
  id: string;
  at: string;
  actor: "system" | "admin_dry_run";
  candidateId: string;
  action: string;
  fromStatus: AdminOpsReviewStatus | null;
  toStatus: AdminOpsReviewStatus | null;
  detail: Record<string, unknown>;
  productionTouched: false;
  databaseTouched: false;
};

export type AdminOpsDryRunMode = "local" | "staging_dry_run";

export type AdminOpsDryRunResult = {
  mode: AdminOpsDryRunMode;
  ok: boolean;
  applied: boolean;
  reasons: string[];
  candidate: AdminOpsCandidate | null;
  auditEvent: AdminOpsAuditEvent | null;
  stagingWritePerformed: false;
  productionWritePerformed: false;
};

export const ADMIN_OPS_ALLOWED_TRANSITIONS: Record<
  AdminOpsReviewStatus,
  readonly AdminOpsTransition[]
> = {
  candidate: ["start_review", "mark_duplicate", "mark_stale", "reject"],
  in_review: [
    "request_evidence",
    "approve_staging",
    "reject",
    "mark_duplicate",
    "mark_stale",
  ],
  evidence_pending: [
    "start_review",
    "approve_staging",
    "reject",
    "mark_stale",
    "queue_retry",
  ],
  duplicate_watch: ["mark_duplicate", "start_review", "reject"],
  approved_staging: ["mark_stale", "reject"],
  rejected: ["queue_retry", "start_review"],
  merged_away: [],
  stale: ["queue_retry", "start_review", "reject"],
  retry_queued: ["clear_retry", "start_review", "reject", "mark_stale"],
};

export function nextStatusForTransition(
  transition: AdminOpsTransition,
): AdminOpsReviewStatus {
  switch (transition) {
    case "start_review":
      return "in_review";
    case "request_evidence":
      return "evidence_pending";
    case "approve_staging":
      return "approved_staging";
    case "reject":
      return "rejected";
    case "mark_duplicate":
      return "duplicate_watch";
    case "mark_stale":
      return "stale";
    case "queue_retry":
      return "retry_queued";
    case "clear_retry":
      return "in_review";
  }
}

export function canTransition(
  from: AdminOpsReviewStatus,
  transition: AdminOpsTransition,
): boolean {
  return ADMIN_OPS_ALLOWED_TRANSITIONS[from].includes(transition);
}

export function evidenceReviewSummary(candidate: AdminOpsCandidate): {
  total: number;
  verified: number;
  pending: number;
  incomplete: boolean;
  reasons: string[];
} {
  const total = candidate.evidence.length;
  const verified = candidate.evidence.filter((e) => e.verified).length;
  const pending = total - verified;
  const reasons: string[] = [];
  if (total === 0) reasons.push("evidence_missing");
  if (pending > 0) reasons.push("evidence_unverified");
  for (const item of candidate.evidence) {
    if (item.sourceUrl) {
      try {
        if (new URL(item.sourceUrl).protocol !== "https:") {
          reasons.push("evidence_insecure_url");
        }
      } catch {
        reasons.push("evidence_invalid_url");
      }
    }
  }
  return {
    total,
    verified,
    pending,
    incomplete: reasons.length > 0,
    reasons: [...new Set(reasons)],
  };
}

export type DuplicateMergeResult = {
  ok: boolean;
  keptId: string | null;
  mergedIds: string[];
  reasons: string[];
  groupId: string | null;
};

/**
 * Merge duplicate candidates into a keeper. Merged rows become merged_away.
 * Does not delete history; does not invent a survivor product.
 */
export function planDuplicateMerge(input: {
  candidates: AdminOpsCandidate[];
  keepId: string;
  mergeIds: string[];
  groupId?: string | null;
}): DuplicateMergeResult {
  const keep = input.candidates.find((c) => c.id === input.keepId);
  if (!keep) {
    return {
      ok: false,
      keptId: null,
      mergedIds: [],
      reasons: ["keep_candidate_not_found"],
      groupId: null,
    };
  }
  if (keep.reviewStatus === "merged_away") {
    return {
      ok: false,
      keptId: null,
      mergedIds: [],
      reasons: ["keep_already_merged"],
      groupId: null,
    };
  }

  const mergeIds = [...new Set(input.mergeIds.filter((id) => id !== input.keepId))];
  if (mergeIds.length === 0) {
    return {
      ok: false,
      keptId: input.keepId,
      mergedIds: [],
      reasons: ["merge_ids_empty"],
      groupId: keep.duplicateGroupId,
    };
  }

  const missing = mergeIds.filter(
    (id) => !input.candidates.some((c) => c.id === id),
  );
  if (missing.length > 0) {
    return {
      ok: false,
      keptId: input.keepId,
      mergedIds: [],
      reasons: ["merge_candidate_not_found"],
      groupId: null,
    };
  }

  return {
    ok: true,
    keptId: input.keepId,
    mergedIds: mergeIds,
    reasons: [],
    groupId: input.groupId ?? keep.duplicateGroupId ?? `dup-${input.keepId}`,
  };
}

export type StaleRefreshQueueItem = {
  candidateId: string;
  title: string;
  refreshDueAt: string;
  priority: "critical" | "high" | "medium" | "low";
  retryCount: number;
  lastError: string | null;
};

export function buildStaleRefreshQueue(
  candidates: AdminOpsCandidate[],
  now = new Date(),
): StaleRefreshQueueItem[] {
  const nowMs = now.getTime();
  return candidates
    .filter((c) => {
      if (c.reviewStatus === "merged_away") return false;
      if (c.reviewStatus === "stale" || c.reviewStatus === "retry_queued") return true;
      if (!c.refreshDueAt) return false;
      const due = Date.parse(c.refreshDueAt);
      return Number.isFinite(due) && due <= nowMs;
    })
    .map((c) => {
      const due = c.refreshDueAt ? Date.parse(c.refreshDueAt) : nowMs;
      const overdueDays = Math.max(0, Math.floor((nowMs - due) / (24 * 60 * 60 * 1000)));
      const priority: StaleRefreshQueueItem["priority"] =
        c.reviewStatus === "stale" || overdueDays >= 30
          ? "critical"
          : overdueDays >= 14
            ? "high"
            : c.retryCount > 0
              ? "medium"
              : "low";
      return {
        candidateId: c.id,
        title: c.title,
        refreshDueAt: c.refreshDueAt ?? new Date(nowMs).toISOString(),
        priority,
        retryCount: c.retryCount,
        lastError: c.lastError,
      };
    })
    .sort((a, b) => {
      const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
      return rank[a.priority] - rank[b.priority] || a.refreshDueAt.localeCompare(b.refreshDueAt);
    });
}

export function shouldRetry(candidate: AdminOpsCandidate, maxRetries = 3): {
  ok: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (candidate.reviewStatus === "merged_away") reasons.push("already_merged");
  if (candidate.retryCount >= maxRetries) reasons.push("max_retries_exceeded");
  const retryableStatus = (
    ["stale", "rejected", "evidence_pending", "retry_queued"] as const
  ).includes(candidate.reviewStatus as "stale" | "rejected" | "evidence_pending" | "retry_queued");
  if (!retryableStatus && !candidate.lastError) {
    reasons.push("no_retryable_error");
  }
  return { ok: reasons.length === 0, reasons };
}
