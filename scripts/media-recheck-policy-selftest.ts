/**
 * Pure-logic assertions for the §41 re-check policy.
 * Offline: no network, no DB.
 */
import assert from "node:assert/strict";
import {
  RECHECK_INTERVAL_DAYS,
  decideRecheck,
  isDue,
  isRecheckable,
  nextCheckDueAt,
  summarizeRights,
  type Reachability,
  type RightsInput,
} from "../src/lib/media/recheckPolicy";

const NOW = new Date("2026-07-27T00:00:00.000Z");

// --- scheduling --------------------------------------------------------------
assert.equal(isDue(null, NOW), true, "never checked → due now");
assert.equal(isDue(undefined, NOW), true, "missing due date → due now");
assert.equal(isDue("2026-07-26T23:59:00.000Z", NOW), true, "past due");
assert.equal(isDue("2026-07-27T00:00:00.000Z", NOW), true, "due exactly now");
assert.equal(isDue("2026-08-26T00:00:00.000Z", NOW), false, "not yet due");

assert.equal(
  nextCheckDueAt("media_asset", NOW).toISOString(),
  "2026-08-03T00:00:00.000Z",
  "media re-checked weekly, inside §41's 1–7 day window"
);
assert.ok(
  RECHECK_INTERVAL_DAYS.media_asset >= 1 && RECHECK_INTERVAL_DAYS.media_asset <= 7,
  "§41 requires video URLs re-checked every 1–7 days"
);
assert.equal(
  nextCheckDueAt("usage_guide", NOW).toISOString(),
  "2026-08-26T00:00:00.000Z",
  "guides re-checked monthly"
);

// --- rights summary ----------------------------------------------------------
function grant(overrides: Partial<RightsInput> = {}): RightsInput {
  return {
    rightsStatus: "embed_only",
    rightsStartAt: "2026-07-01T00:00:00.000Z",
    rightsEndAt: "2027-07-01T00:00:00.000Z",
    ...overrides,
  };
}

assert.equal(summarizeRights([], NOW), "none", "no grants");
assert.equal(summarizeRights([grant()], NOW), "active", "in-window grant");
assert.equal(
  summarizeRights([grant({ rightsEndAt: "2026-07-26T00:00:00.000Z" })], NOW),
  "expired",
  "past end date"
);
assert.equal(
  summarizeRights([grant({ rightsEndAt: "2026-08-10T00:00:00.000Z" })], NOW),
  "expiring_soon",
  "inside the 30 day warning window"
);
assert.equal(
  summarizeRights([grant({ rightsEndAt: "2026-09-10T00:00:00.000Z" })], NOW),
  "active",
  "beyond the warning window"
);
assert.equal(
  summarizeRights([grant({ rightsStatus: "revoked" })], NOW),
  "unusable",
  "revoked"
);
assert.equal(
  summarizeRights([grant({ rightsStartAt: "2026-08-01T00:00:00.000Z" })], NOW),
  "not_started",
  "future start"
);
assert.equal(
  summarizeRights([grant({ rightsEndAt: "not-a-date" })], NOW),
  "unusable",
  "unparseable date fails closed"
);
assert.equal(
  summarizeRights(
    [grant({ rightsEndAt: "2026-07-01T00:00:00.000Z" }), grant()],
    NOW
  ),
  "active",
  "one live grant is enough even when another has lapsed"
);

// --- decisions ---------------------------------------------------------------
const OK: Reachability = { kind: "ok" };
const GONE: Reachability = { kind: "gone", httpStatus: 404 };
const TRANSIENT: Reachability = { kind: "transient", httpStatus: 503 };

// rights expiry removes an approved asset from publication
const expiredRights = decideRecheck(
  { kind: "media_asset", status: "approved", reachability: OK, rightsState: "expired" },
  NOW
);
assert.equal(expiredRights.action, "expire", "expired rights expire the asset");
assert.equal(expiredRights.statusChanges, true);
assert.ok(expiredRights.reasonCodes.includes("rights_expired"));

// the same asset awaiting review is not touched — it is not published anyway
const expiredPending = decideRecheck(
  { kind: "media_asset", status: "needs_review", reachability: OK, rightsState: "expired" },
  NOW
);
assert.equal(expiredPending.action, "keep", "a pending row is left for the reviewer");
assert.equal(expiredPending.statusChanges, false);

const revoked = decideRecheck(
  { kind: "media_asset", status: "approved", reachability: OK, rightsState: "unusable" },
  NOW
);
assert.equal(revoked.action, "expire", "revoked rights expire the asset");

// a dead video URL clears the accessibility flag rather than the review decision
const goneMedia = decideRecheck(
  { kind: "media_asset", status: "approved", reachability: GONE, rightsState: "active" },
  NOW
);
assert.equal(goneMedia.action, "mark_unreachable", "media uses the accessibility flag");
assert.ok(goneMedia.reasonCodes.includes("source_gone"));

// a guide whose source page is gone can no longer be verified
const goneGuide = decideRecheck(
  { kind: "usage_guide", status: "approved", reachability: GONE, rightsState: "none" },
  NOW
);
assert.equal(goneGuide.action, "expire", "guide expires when its source is gone");

// a transient failure must never change anything
for (const kind of ["media_asset", "usage_guide"] as const) {
  for (const status of ["approved", "needs_review"] as const) {
    const decision = decideRecheck(
      { kind, status, reachability: TRANSIENT, rightsState: "active" },
      NOW
    );
    assert.equal(
      decision.statusChanges,
      false,
      `${kind}/${status}: a 503 never changes a status`
    );
    assert.equal(decision.action, "keep");
    assert.ok(decision.reasonCodes.includes("source_check_failed_transient"));
  }
}

// changed source text reopens review rather than deleting the guidance
const changed = decideRecheck(
  {
    kind: "usage_guide",
    status: "approved",
    reachability: OK,
    rightsState: "none",
    contentChanged: true,
  },
  NOW
);
assert.equal(changed.action, "reopen_review", "changed source reopens the review");
assert.ok(changed.reasonCodes.includes("source_content_changed"));

// expiring soon warns without touching the row
const soon = decideRecheck(
  {
    kind: "media_asset",
    status: "approved",
    reachability: OK,
    rightsState: "expiring_soon",
  },
  NOW
);
assert.equal(soon.action, "keep", "a warning is not an action");
assert.equal(soon.statusChanges, false);
assert.ok(soon.reasonCodes.includes("rights_expiring_soon"));

// the healthy case does nothing
const healthy = decideRecheck(
  { kind: "media_asset", status: "approved", reachability: OK, rightsState: "active" },
  NOW
);
assert.equal(healthy.action, "keep");
assert.deepEqual(healthy.reasonCodes, []);

// --- the worker never promotes ----------------------------------------------
const ACTIONS = new Set<string>();
for (const kind of ["media_asset", "usage_guide"] as const) {
  for (const status of ["approved", "needs_review"] as const) {
    for (const reach of [OK, GONE, TRANSIENT]) {
      for (const rightsState of [
        "active",
        "expiring_soon",
        "expired",
        "not_started",
        "unusable",
        "none",
      ] as const) {
        for (const contentChanged of [true, false]) {
          ACTIONS.add(
            decideRecheck(
              { kind, status, reachability: reach, rightsState, contentChanged },
              NOW
            ).action
          );
        }
      }
    }
  }
}
assert.ok(
  !ACTIONS.has("approve" as never),
  "no input can make the worker approve anything"
);
assert.deepEqual(
  [...ACTIONS].sort(),
  ["expire", "keep", "mark_unreachable", "reopen_review"],
  "only downgrades are reachable"
);

// --- which rows are even looked at ------------------------------------------
assert.equal(isRecheckable("approved"), true);
assert.equal(isRecheckable("needs_review"), true);
assert.equal(isRecheckable("rejected"), false, "a rejected row is not re-checked");
assert.equal(isRecheckable("expired"), false, "already expired, nothing to do");
assert.equal(isRecheckable("superseded"), false);

console.log("[media-recheck-policy] self-test: ok");

// --- an unreachable check must not consume the whole interval ---------------
import {
  isInconclusive,
  retryDueAt,
} from "../src/lib/media/recheckPolicy";

assert.equal(
  retryDueAt("usage_guide", NOW).toISOString(),
  "2026-08-03T00:00:00.000Z",
  "a guide that could not be reached retries in a week, not a month"
);
assert.equal(
  retryDueAt("media_asset", NOW).toISOString(),
  "2026-07-28T00:00:00.000Z",
  "media retries the next day, never sooner"
);
assert.ok(
  retryDueAt("usage_guide", NOW) < nextCheckDueAt("usage_guide", NOW),
  "a failed check is always rescheduled sooner than a successful one"
);
assert.ok(
  retryDueAt("media_asset", NOW).getTime() - NOW.getTime() >= 24 * 60 * 60 * 1000,
  "retry never sooner than a day — a throttling site must not be hammered"
);

assert.equal(isInconclusive({ kind: "transient", httpStatus: 403 }), true);
assert.equal(isInconclusive({ kind: "skipped" }), true, "no url means nothing confirmed");
assert.equal(isInconclusive({ kind: "ok" }), false);
assert.equal(
  isInconclusive({ kind: "gone", httpStatus: 404 }),
  false,
  "a 404 is a conclusive finding, not an inconclusive one"
);

console.log("[media-recheck-policy] retry scheduling: ok");
