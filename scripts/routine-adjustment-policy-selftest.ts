import {
  applyRoutineAdjustment,
  proposeRoutineAdjustments,
  undoRoutineAdjustment,
  type RoutineAdjustmentProposal,
} from "../src/lib/retention/routineAdjustmentPolicy";
import type { CheckinDecision } from "../src/lib/retention/checkinPolicy";
import type { CareRoutine, CareRoutineItem } from "../src/lib/care/types";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function baseItems(): CareRoutineItem[] {
  return [
    {
      id: "i_clean",
      step: "cleanser",
      productId: "p1",
      customProductName: "Cleanser",
      timeOfDay: "am",
      frequency: "daily",
      order: 1,
      startedAt: "2026-06-01T00:00:00.000Z",
      stoppedAt: null,
      usageNote: null,
      cautionNotes: [],
      allergyConflict: false,
      active: true,
    },
    {
      id: "i_serum",
      step: "serum",
      productId: "p2",
      customProductName: "Serum",
      timeOfDay: "pm",
      frequency: "daily",
      order: 2,
      startedAt: "2026-07-15T00:00:00.000Z",
      stoppedAt: null,
      usageNote: null,
      cautionNotes: [],
      allergyConflict: false,
      active: true,
    },
    {
      id: "i_spf",
      step: "sunscreen",
      productId: "p3",
      customProductName: "SPF",
      timeOfDay: "am",
      frequency: "daily",
      order: 3,
      startedAt: "2026-07-15T00:00:00.000Z",
      stoppedAt: null,
      usageNote: null,
      cautionNotes: [],
      allergyConflict: false,
      active: true,
    },
    {
      id: "i_moist",
      step: "moisturizer",
      productId: "p4",
      customProductName: "Moist",
      timeOfDay: "both",
      frequency: "daily",
      order: 4,
      startedAt: "2026-06-01T00:00:00.000Z",
      stoppedAt: null,
      usageNote: null,
      cautionNotes: [],
      allergyConflict: false,
      active: true,
    },
  ];
}

function routine(): CareRoutine {
  return {
    id: "rt1",
    analysisSessionId: "an1",
    version: 1,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    timezone: "Asia/Seoul",
    items: baseItems(),
    conflictNotes: [],
  };
}

const checkIn = {
  id: "ci1",
  day: 7 as const,
  dueAt: "2026-07-20T10:00:00.000Z",
  scheduledFor: "2026-07-20T10:00:00.000Z",
};

function decision(
  response: CheckinDecision["response"],
  opts?: Partial<CheckinDecision>
): CheckinDecision {
  return {
    response,
    actions: [],
    prioritizeConsultation: false,
    urgentRisk: false,
    referralRecommended: false,
    summaryKey: response,
    ...opts,
  };
}

let checks = 0;

const improved = proposeRoutineAdjustments({
  decision: decision("improved"),
  checkIn,
  routine: routine(),
});
assert(improved.primary?.type === "keep_current", "improved → keep_current");
checks += 1;

const unchanged = proposeRoutineAdjustments({
  decision: decision("unchanged"),
  checkIn,
  routine: routine(),
});
assert(
  unchanged.proposals.some((p) => p.type === "keep_current") &&
    unchanged.proposals.some((p) => p.type === "simplify"),
  "unchanged → keep or simplify"
);
checks += 1;

const worsened = proposeRoutineAdjustments({
  decision: decision("worsened"),
  checkIn,
  routine: routine(),
  nowIso: "2026-07-20T12:00:00.000Z",
});
assert(
  worsened.proposals.some((p) => p.type === "pause_recent_product") &&
    worsened.proposals.some((p) => p.type === "simplify"),
  "worsened → pause/simplify"
);
checks += 1;

const risk = proposeRoutineAdjustments({
  decision: decision("worsened", {
    prioritizeConsultation: true,
    urgentRisk: true,
  }),
  checkIn,
  routine: routine(),
});
assert(risk.primary?.type === "consultation_first", "risk → consultation_first");
checks += 1;

const notStarted = proposeRoutineAdjustments({
  decision: decision("not_started"),
  checkIn,
  routine: routine(),
});
assert(notStarted.primary?.type === "restart_later", "not_started → restart_later");
checks += 1;

const stopped = proposeRoutineAdjustments({
  decision: decision("stopped"),
  checkIn,
  routine: routine(),
  stoppedReason: "purchase_failed",
});
assert(
  stopped.proposals.some((p) => p.type === "record_only") &&
    stopped.proposals.some((p) => p.type === "restart_later"),
  "stopped → record_only or restart_later"
);
checks += 1;

const unsure = proposeRoutineAdjustments({
  decision: decision("unsure"),
  checkIn,
  routine: routine(),
});
assert(unsure.primary?.type === "record_only", "unsure → record_only");
checks += 1;

const before = routine();
const pauseProp = worsened.proposals.find(
  (p) => p.type === "pause_recent_product"
) as RoutineAdjustmentProposal;
assert(before.items.every((i) => i.active), "user approval 전 루틴 불변");
checks += 1;

const applied = applyRoutineAdjustment({
  routine: before,
  proposal: pauseProp,
  selectedItemIds: ["i_serum"],
  history: [],
  nowIso: "2026-07-20T12:00:00.000Z",
});
assert(applied.ok === true, "apply ok");
if (!applied.ok) throw new Error("apply failed");
assert(
  applied.routine.items.find((i) => i.id === "i_serum")?.itemStatus === "paused",
  "apply 후 paused"
);
assert(
  applied.routine.items.find((i) => i.id === "i_serum")?.active === false,
  "paused inactive"
);
assert(
  applied.record.beforeRoutine.items.find((i) => i.id === "i_serum")?.active ===
    true,
  "기존 데이터 삭제 없음 (snapshot)"
);
assert(
  applied.routine.items.find((i) => i.id === "i_spf")?.active === true,
  "자외선 차단 자동 중단 금지"
);
checks += 1;

const dup = applyRoutineAdjustment({
  routine: applied.routine,
  proposal: pauseProp,
  selectedItemIds: ["i_serum"],
  history: [applied.record],
});
assert(dup.ok === false && dup.error === "duplicate_apply", "동일 checkinId 중복 적용 방지");
checks += 1;

const alreadyPaused = applyRoutineAdjustment({
  routine: applied.routine,
  proposal: {
    ...pauseProp,
    id: "adj_pause_all_new_products_ci_other",
    type: "pause_all_new_products",
    checkInId: "ci_other",
    requiresUserSelection: false,
    candidateItemIds: ["i_serum"],
  },
  selectedItemIds: ["i_serum"],
  history: [],
});
assert(
  alreadyPaused.ok === false && alreadyPaused.error === "nothing_to_change",
  "이미 paused 항목 중복 처리 방지"
);
checks += 1;

const riskApply = applyRoutineAdjustment({
  routine: before,
  proposal: risk.primary!,
  history: [],
});
assert(
  riskApply.ok === false && riskApply.error === "consultation_blocked",
  "위험 신호 시 제품 조정 적용 차단"
);
checks += 1;

const spfBan = applyRoutineAdjustment({
  routine: before,
  proposal: {
    ...pauseProp,
    checkInId: "ci_spf",
    id: "adj_pause_recent_product_ci_spf",
    requiresUserSelection: false,
    candidateItemIds: ["i_spf"],
  },
  selectedItemIds: ["i_spf"],
  history: [],
});
assert(
  spfBan.ok === false && spfBan.error === "nothing_to_change",
  "sunscreen never paused"
);
checks += 1;

const undone = undoRoutineAdjustment({
  currentRoutine: applied.routine,
  record: applied.record,
});
assert(undone.ok === true, "되돌리기 가능");
if (!undone.ok) throw new Error("undo failed");
assert(
  undone.routine.items.find((i) => i.id === "i_serum")?.active === true,
  "undo restores active"
);
checks += 1;

console.log(`[routine-adjustment] ${checks} checks passed`);
console.log("[routine-adjustment] organic/affiliate untouched (policy-only)");
