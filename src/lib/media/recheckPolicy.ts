/**
 * §41 re-check policy for the media library and usage guides.
 * Pure — no network, no DB.
 *
 * The schemas already carry expiry and liveness columns, but nothing acted on
 * them: a rights window could lapse and the asset stayed publishable, which made
 * the fail-closed design fail open in practice. This decides what a scheduled
 * re-check should do with what it found.
 *
 * The rules only ever downgrade. Nothing here can approve, re-approve, or extend
 * a right — a machine may notice that permission ran out, never that it exists.
 */

export type RecheckKind = "media_asset" | "usage_guide";

/**
 * §41 asks for video URLs to be re-checked every 1–7 days. A usage guide is
 * extracted text on a product page, which changes far more slowly, so it is
 * checked monthly rather than weekly.
 */
export const RECHECK_INTERVAL_DAYS: Record<RecheckKind, number> = {
  media_asset: 7,
  usage_guide: 30,
};

/** How far ahead a lapsing right is worth warning about. */
export const RIGHTS_WARNING_DAYS = 30;

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A row with no due date has never been checked, so it is due now. */
export function isDue(
  nextCheckDueAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  const due = parseDate(nextCheckDueAt);
  if (!due) return true;
  return due.getTime() <= now.getTime();
}

export function nextCheckDueAt(kind: RecheckKind, now: Date = new Date()): Date {
  return new Date(
    now.getTime() + RECHECK_INTERVAL_DAYS[kind] * 24 * 60 * 60 * 1000
  );
}

export type RightsState =
  | "active"
  | "expiring_soon"
  | "expired"
  | "not_started"
  | "unusable"
  | "none";

export type RightsInput = {
  rightsStatus: string;
  rightsStartAt: string | null;
  rightsEndAt: string | null;
};

const DEAD_RIGHTS = new Set(["unknown", "expired", "revoked"]);

/**
 * The state of the best grant an asset holds. An asset with several grants is
 * only as expired as its most permissive one — one live grant is enough.
 */
export function summarizeRights(
  rights: readonly RightsInput[],
  now: Date = new Date(),
  warningDays: number = RIGHTS_WARNING_DAYS
): RightsState {
  if (rights.length === 0) return "none";

  const states = rights.map((grant): RightsState => {
    if (DEAD_RIGHTS.has(grant.rightsStatus)) return "unusable";
    const start = parseDate(grant.rightsStartAt);
    const end = parseDate(grant.rightsEndAt);
    if (grant.rightsStartAt && !start) return "unusable";
    if (grant.rightsEndAt && !end) return "unusable";
    if (start && start.getTime() > now.getTime()) return "not_started";
    if (end && end.getTime() <= now.getTime()) return "expired";
    if (
      end &&
      end.getTime() - now.getTime() <= warningDays * 24 * 60 * 60 * 1000
    ) {
      return "expiring_soon";
    }
    return "active";
  });

  // most permissive wins
  for (const preferred of [
    "active",
    "expiring_soon",
    "not_started",
    "expired",
    "unusable",
  ] as const) {
    if (states.includes(preferred)) return preferred;
  }
  return "none";
}

/** What a fetch of the source URL told us. */
export type Reachability =
  | { kind: "ok" }
  /** 404 / 410 — the source is gone, not merely unwell. */
  | { kind: "gone"; httpStatus: number }
  /** 5xx, timeout, throttling — says nothing about the asset. */
  | { kind: "transient"; httpStatus: number | null }
  /** not checked this run */
  | { kind: "skipped" };

/**
 * When a check could not reach the source at all, the row has not actually been
 * verified — giving it the full interval would mean a bot-blocked page counts as
 * "checked" for a month. It retries at a quarter of the interval, never sooner
 * than a day, so a site that throttles us is not hammered either.
 */
export function retryDueAt(kind: RecheckKind, now: Date = new Date()): Date {
  const days = Math.max(1, Math.floor(RECHECK_INTERVAL_DAYS[kind] / 4));
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/** A check that never reached the source has not confirmed anything. */
export function isInconclusive(reachability: Reachability): boolean {
  return reachability.kind === "transient" || reachability.kind === "skipped";
}

export type RecheckAction =
  | "keep"
  | "expire"
  | "mark_unreachable"
  | "reopen_review";

export type RecheckDecision = {
  action: RecheckAction;
  reasonCodes: string[];
  /** Only ever true when the decision is based on a definite finding. */
  statusChanges: boolean;
};

export type RecheckInput = {
  kind: RecheckKind;
  /** current verification_status */
  status: string;
  reachability: Reachability;
  rightsState: RightsState;
  /** usage guides only: did the source page text change since extraction? */
  contentChanged?: boolean;
};

/**
 * Decide what to do with one row.
 *
 * A transient failure never changes a status — a 503 or a rate limit says
 * nothing about whether we still have permission, and downgrading on one would
 * make the worker itself the cause of assets disappearing.
 */
export function decideRecheck(
  input: RecheckInput,
  _now: Date = new Date()
): RecheckDecision {
  const reasons: string[] = [];
  const approved = input.status === "approved";

  // rights outrank everything: no permission, no publication
  if (input.rightsState === "expired") {
    reasons.push("rights_expired");
    return {
      action: approved ? "expire" : "keep",
      reasonCodes: reasons,
      statusChanges: approved,
    };
  }
  if (input.rightsState === "unusable") {
    reasons.push("rights_not_publishable");
    return {
      action: approved ? "expire" : "keep",
      reasonCodes: reasons,
      statusChanges: approved,
    };
  }

  if (input.reachability.kind === "gone") {
    reasons.push("source_gone");
    if (input.kind === "media_asset") {
      // the publishable view already requires is_accessible, so clearing that
      // flag removes it without overwriting the review decision
      return {
        action: approved ? "mark_unreachable" : "keep",
        reasonCodes: reasons,
        statusChanges: approved,
      };
    }
    // a usage guide whose source page is gone can no longer be verified
    return {
      action: approved ? "expire" : "keep",
      reasonCodes: reasons,
      statusChanges: approved,
    };
  }

  if (input.reachability.kind === "transient") {
    reasons.push("source_check_failed_transient");
    return { action: "keep", reasonCodes: reasons, statusChanges: false };
  }

  if (input.contentChanged) {
    reasons.push("source_content_changed");
    return {
      action: approved ? "reopen_review" : "keep",
      reasonCodes: reasons,
      statusChanges: approved,
    };
  }

  if (input.rightsState === "expiring_soon") {
    reasons.push("rights_expiring_soon");
    return { action: "keep", reasonCodes: reasons, statusChanges: false };
  }

  return { action: "keep", reasonCodes: reasons, statusChanges: false };
}

/** Statuses a scheduled re-check should even look at. */
export const RECHECKABLE_STATUSES = ["approved", "needs_review"] as const;

export function isRecheckable(status: string): boolean {
  return (RECHECKABLE_STATUSES as readonly string[]).includes(status);
}
