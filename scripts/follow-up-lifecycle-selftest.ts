/**
 * T02 follow-up lifecycle self-test.
 * Covers opt-in, schedule, due, decisions, adjustment, red-flag,
 * delivery dry-run, resume/fallback, admin summary.
 */

import assert from "node:assert/strict";
import {
  buildFollowUpLifecycleAdminSummary,
  clearFollowUpLifecycleAdminMemory,
  upsertFollowUpLifecycleAdminMemory,
} from "../src/lib/admin/followUpLifecycleAdmin";
import { decideReminderDelivery } from "../src/lib/care/reminderDeliveryPolicy";
import { defaultCareUserSettings } from "../src/lib/care/settingsDefaults";
import type { CareCheckInAnswers, CareRoutine } from "../src/lib/care/types";
import {
  channelConsentAllows,
  createDryRunDeliveryAdapter,
  createLiveBlockedDeliveryAdapter,
  maskDestination,
  resolveFollowUpDeliveryMode,
} from "../src/lib/retention/followUpDelivery";
import {
  evaluateFollowUpCheckIn,
  evaluateProgressAdherenceIrritation,
  pauseFollowUpLifecycle,
  refreshFollowUpDueStates,
  resumeFollowUpLifecycle,
  runFollowUpDeliveryTick,
  startFollowUpLifecycle,
} from "../src/lib/retention/followUpLifecycle";
import {
  parseFollowUpLifecycleSnapshot,
  resumeFollowUpLifecycleWithFallback,
  serializeFollowUpLifecycleSnapshot,
} from "../src/lib/retention/followUpLifecyclePersistence";

let checks = 0;
function check(cond: boolean, msg: string) {
  assert.ok(cond, msg);
  checks += 1;
}

const startAt = "2026-07-01T01:00:00.000Z";
const nowScheduled = "2026-07-01T02:00:00.000Z";
const nowDueDay3 = "2026-07-04T12:00:00.000Z";

let idSeq = 0;
const idFactory = () => {
  idSeq += 1;
  return `ci_${idSeq}`;
};

const settings = {
  ...defaultCareUserSettings("Asia/Seoul"),
  careEmailChannelConsent: true,
  careSmsChannelConsent: true,
  carePushChannelConsent: true,
  notificationsEnabled: true,
};

async function main() {
// --- opt-in gate ---
const noConsent = startFollowUpLifecycle({
  analysisSessionId: "an_1",
  routineId: "rt_1",
  startAt,
  consentCareTracking: false,
  settings,
  idFactory,
  nowIso: nowScheduled,
});
check(noConsent.phase === "opt_in_required", "opt-in required without care consent");
check(noConsent.checkIns.length === 0, "no schedule without opt-in");

const started = startFollowUpLifecycle({
  analysisSessionId: "an_1",
  routineId: "rt_1",
  startAt,
  consentCareTracking: true,
  settings,
  idFactory,
  nowIso: nowScheduled,
});
check(started.phase === "scheduled", "scheduled after opt-in");
check(started.checkIns.length === 4, "3/7/15/30 four milestones");
check(
  started.checkIns.map((c) => c.day).join(",") === "3,7,15,30",
  "milestone days order"
);
check(started.realDeliveryClaimed === false, "no real delivery claim on start");

// --- due states ---
const dueSnap = refreshFollowUpDueStates(started, nowDueDay3);
check(dueSnap.phase === "due", "phase becomes due");
check(
  dueSnap.checkIns.filter((c) => c.status === "due").length >= 1,
  "at least day3 due"
);

// --- progress / adherence / irritation ---
const irritationAnswers: CareCheckInAnswers = {
  stillUsing: false,
  sting: 8,
  itch: 7,
  redness: 8,
  dryness: 4,
  oiliness: 2,
  breakouts: 3,
  swelling: 0,
  peeling: 0,
  satisfaction: 2,
  adherence: 8,
  photoAttached: false,
  freeMemo: null,
  overallResponse: "stopped",
  stoppedReason: "irritation",
  acuteSignals: { spreadingRash: true },
};
const flags = evaluateProgressAdherenceIrritation(irritationAnswers);
check(flags.irritationFlag === true, "irritation flagged");
check(flags.progressHint === "worsened", "progress worsened");
check(flags.adherenceBand === "high", "adherence high band");

const day3 = dueSnap.checkIns.find((c) => c.day === 3);
assert.ok(day3);

const routine: CareRoutine = {
  id: "rt_1",
  analysisSessionId: "an_1",
  version: 1,
  createdAt: startAt,
  updatedAt: startAt,
  timezone: "Asia/Seoul",
  conflictNotes: [],
  items: [
    {
      id: "item_serum",
      step: "serum",
      productId: "p1",
      customProductName: "serum",
      active: true,
      startedAt: startAt,
      stoppedAt: null,
      frequency: "daily",
      timeOfDay: "am",
      order: 1,
      usageNote: null,
      cautionNotes: [],
      allergyConflict: false,
    },
    {
      id: "item_sun",
      step: "sunscreen",
      productId: "p2",
      customProductName: "spf",
      active: true,
      startedAt: startAt,
      stoppedAt: null,
      frequency: "daily",
      timeOfDay: "am",
      order: 2,
      usageNote: null,
      cautionNotes: [],
      allergyConflict: false,
    },
  ],
};

const evaluated = evaluateFollowUpCheckIn({
  snapshot: dueSnap,
  checkInId: day3.id,
  answers: irritationAnswers,
  routine,
  nowIso: nowDueDay3,
});
check(evaluated.escalation.escalate === true, "red-flag escalation");
check(
  evaluated.snapshot.phase === "red_flag_escalated",
  "phase red_flag_escalated"
);
check(
  evaluated.adjustment.consultationFirst === true,
  "consultation-first adjustment"
);
check(evaluated.decision.prioritizeConsultation === true, "prioritize consult");

// --- delivery interfaces / dry-run / live_blocked ---
check(maskDestination("sms", "+821012345678").endsWith("5678"), "sms mask");
check(maskDestination("email", "user@example.com").includes("***"), "email mask");
check(resolveFollowUpDeliveryMode({ SMS_DELIVERY_MODE: "live" }, "sms") === "live_blocked", "live→blocked");

const smsGate = channelConsentAllows("sms", {
  careCheckinConsent: true,
  notificationsEnabled: true,
  careEmailChannelConsent: false,
  careSmsChannelConsent: false,
  carePushChannelConsent: false,
});
check(smsGate.allowed === false && smsGate.reasonCode === "sms_opt_out", "sms opt-out");

const liveBlocked = createLiveBlockedDeliveryAdapter("push");
const blockedResult = await liveBlocked.send({
  checkInId: day3.id,
  channel: "push",
  kind: "checkin_due",
  locale: "ko",
  idempotencyKey: "test-push-1",
  destination: "tok_abc",
  bodyPreview: "x",
});
check(blockedResult.ok === false, "push live blocked not ok");
check(
  blockedResult.status === "live_blocked",
  "push status live_blocked"
);

const consentedForDelivery = {
  ...evaluated.snapshot,
  consent: {
    ...evaluated.snapshot.consent,
    careCheckinConsent: true,
    notificationsEnabled: true,
    careEmailChannelConsent: true,
    careSmsChannelConsent: true,
    carePushChannelConsent: true,
  },
  checkIns: evaluated.snapshot.checkIns.map((c) =>
    c.day === 7
      ? { ...c, status: "due" as const, dueAt: nowDueDay3 }
      : c
  ),
  phase: "due" as const,
};

const tick = await runFollowUpDeliveryTick({
  snapshot: consentedForDelivery,
  userKey: "user_1",
  destinations: {
    in_app: "session",
    email: "a@b.co",
    sms: "+821011112222",
    push: "tok_xyz",
  },
  adapters: {
    in_app: createDryRunDeliveryAdapter("in_app"),
    email: createDryRunDeliveryAdapter("email"),
    sms: createDryRunDeliveryAdapter("sms"),
    push: createDryRunDeliveryAdapter("push"),
  },
  nowIso: nowDueDay3,
});
check(tick.recordsCreated.length >= 1, "delivery records created");
check(
  tick.recordsCreated.every((r) => r.realDeliveryClaimed === false),
  "records never claim real delivery"
);
check(
  tick.recordsCreated.some((r) => r.channel === "sms" && r.status === "dry_run_sent"),
  "sms dry-run sent"
);

// reminder policy sms/push
const smsOff = decideReminderDelivery({
  checkIn: {
    id: day3.id,
    day: 3,
    status: "due",
    dueAt: nowDueDay3,
    referralLevel: "none",
  },
  settings: { ...settings, careSmsChannelConsent: false },
  channel: "sms",
  existingNotifications: [],
  now: new Date(nowDueDay3),
});
check(smsOff.deliver === false && smsOff.reason === "sms_opt_out", "reminder sms opt-out");

// --- pause / resume ---
const paused = pauseFollowUpLifecycle(tick.snapshot, nowDueDay3);
check(paused.phase === "paused", "paused");
const resumed = resumeFollowUpLifecycle(paused, nowDueDay3);
check(resumed.phase !== "paused", "resumed leaves paused");
check(resumed.resumedAt === nowDueDay3, "resumedAt set");

// --- persistence fallback ---
const corrupt = parseFollowUpLifecycleSnapshot({ version: 99 }, {
  analysisSessionId: "an_1",
  nowIso: nowDueDay3,
});
check(corrupt.persistenceSource === "fallback_empty", "corrupt → fallback");

const serialized = JSON.parse(serializeFollowUpLifecycleSnapshot(tick.snapshot));
const resumedFb = resumeFollowUpLifecycleWithFallback({
  serverSnapshot: null,
  localSnapshot: serialized,
  analysisSessionId: "an_1",
  nowIso: nowDueDay3,
});
check(resumedFb.source === "local", "resume from local");
check(resumedFb.snapshot.checkIns.length === 4, "local check-ins preserved");

const emptyFb = resumeFollowUpLifecycleWithFallback({
  analysisSessionId: "an_missing",
  nowIso: nowDueDay3,
});
check(emptyFb.source === "fallback_empty", "missing → empty fallback");

// --- admin visibility ---
clearFollowUpLifecycleAdminMemory();
upsertFollowUpLifecycleAdminMemory(tick.snapshot);
const admin = buildFollowUpLifecycleAdminSummary([tick.snapshot]);
check(admin.analysisSessions === 1, "admin sessions");
check(admin.realDeliveryClaimed === false, "admin no real delivery claim");
check(admin.delivery.byChannel.sms >= 1 || admin.delivery.byChannel.email >= 1, "admin channel counts");
check(admin.note.includes("실발송"), "admin honest note");

console.log(`[follow-up-lifecycle] ${checks} checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
