/** Routine adjustment proposals from check-in responses. Pure; no auto-apply. */

import type {
  CareCheckIn,
  CareCheckInStoppedReason,
  CareRoutine,
  CareRoutineItem,
  CareRoutineAdjustmentRecord,
} from "@/lib/care/types";
import type {
  CheckinDecision,
  CheckinResponse,
} from "@/lib/retention/checkinPolicy";

export type RoutineAdjustmentType =
  | "keep_current"
  | "simplify"
  | "pause_recent_product"
  | "pause_all_new_products"
  | "restart_later"
  | "record_only"
  | "consultation_first";

export type RoutineAdjustmentReason =
  | "response_improved"
  | "response_unchanged"
  | "response_worsened"
  | "response_not_started"
  | "response_stopped"
  | "response_unsure"
  | "urgent_risk"
  | "stopped_irritation"
  | "stopped_complexity"
  | "recent_products_uncertain"
  | "no_routine";

export type RoutineAdjustmentTarget = {
  itemId: string;
  step: CareRoutineItem["step"];
  label: string;
  startedAt: string;
  currentlyActive: boolean;
  isProtected: boolean;
  isRecentCandidate: boolean;
};

export type RoutineAdjustmentProposal = {
  id: string;
  type: RoutineAdjustmentType;
  checkInId: string;
  reason: RoutineAdjustmentReason;
  candidateItemIds: string[];
  protectedItemIds: string[];
  requiresUserSelection: boolean;
  allowsApply: boolean;
  blocksProductAdjustments: boolean;
  deletesData: false;
};

export type RoutineAdjustmentPreview = {
  proposal: RoutineAdjustmentProposal;
  beforeItems: RoutineAdjustmentTarget[];
  afterItems: RoutineAdjustmentTarget[];
  pausedItemIds: string[];
  keptActiveItemIds: string[];
  skippedAlreadyPausedIds: string[];
  noteKeys: string[];
};

export type RoutineAdjustmentDecision = {
  proposals: RoutineAdjustmentProposal[];
  primary: RoutineAdjustmentProposal | null;
  consultationFirst: boolean;
  routineMissing: boolean;
};

export type ApplyRoutineAdjustmentInput = {
  routine: CareRoutine;
  proposal: RoutineAdjustmentProposal;
  selectedItemIds?: string[];
  newStartAt?: string | null;
  nowIso?: string;
  history?: CareRoutineAdjustmentRecord[];
};

export type ApplyRoutineAdjustmentResult =
  | {
      ok: true;
      routine: CareRoutine;
      record: CareRoutineAdjustmentRecord;
      preview: RoutineAdjustmentPreview;
    }
  | {
      ok: false;
      error:
        | "consultation_blocked"
        | "duplicate_apply"
        | "nothing_to_change"
        | "requires_selection"
        | "invalid_restart"
        | "keep_or_record_only";
    };

const SIMPLIFY_PAUSE_STEPS = new Set<CareRoutineItem["step"]>([
  "serum",
  "ampoule",
  "essence",
  "treatment",
  "exfoliant",
  "mask",
  "toner",
]);

const RECENT_MS = 7 * 24 * 3600_000;

function proposalId(type: RoutineAdjustmentType, checkInId: string): string {
  return `adj_${type}_${checkInId}`;
}

export function isProtectedRoutineStep(step: CareRoutineItem["step"]): boolean {
  return step === "sunscreen" || step === "cleanser" || step === "moisturizer";
}

export function itemDisplayLabel(item: CareRoutineItem): string {
  return (
    item.customProductName?.trim() ||
    (item.productId ? `#${item.productId}` : item.step)
  );
}

export function findRecentRoutineItemIds(
  routine: CareRoutine | null,
  checkIn: Pick<CareCheckIn, "day" | "dueAt" | "scheduledFor">,
  nowIso: string = new Date().toISOString()
): { recentIds: string[]; confident: boolean } {
  if (!routine) return { recentIds: [], confident: false };
  const now = Date.parse(nowIso);
  const due = Date.parse(checkIn.dueAt || checkIn.scheduledFor);
  const windowStart = Number.isFinite(due)
    ? due - checkIn.day * 24 * 3600_000
    : now - RECENT_MS;

  const recentIds: string[] = [];
  for (const item of routine.items) {
    if (!item.active) continue;
    if (item.step === "sunscreen") continue;
    const started = Date.parse(item.startedAt);
    if (!Number.isFinite(started)) continue;
    const within7d = now - started <= RECENT_MS && started <= now;
    const afterWindow = started >= windowStart;
    if (within7d || afterWindow) recentIds.push(item.id);
  }
  return { recentIds, confident: recentIds.length === 1 };
}

export function toAdjustmentTargets(
  routine: CareRoutine | null
): RoutineAdjustmentTarget[] {
  if (!routine) return [];
  return routine.items.map((item) => ({
    itemId: item.id,
    step: item.step,
    label: itemDisplayLabel(item),
    startedAt: item.startedAt,
    currentlyActive: item.active,
    isProtected: isProtectedRoutineStep(item.step),
    isRecentCandidate: false,
  }));
}

function makeProposal(
  type: RoutineAdjustmentType,
  checkInId: string,
  reason: RoutineAdjustmentReason,
  opts: Partial<RoutineAdjustmentProposal> & { protectedItemIds: string[] }
): RoutineAdjustmentProposal {
  return {
    id: proposalId(type, checkInId),
    type,
    checkInId,
    reason,
    candidateItemIds: opts.candidateItemIds ?? [],
    protectedItemIds: opts.protectedItemIds,
    requiresUserSelection: opts.requiresUserSelection ?? false,
    allowsApply: opts.allowsApply ?? true,
    blocksProductAdjustments: opts.blocksProductAdjustments ?? false,
    deletesData: false,
  };
}

export function proposeRoutineAdjustments(input: {
  decision: CheckinDecision;
  checkIn: Pick<CareCheckIn, "id" | "day" | "dueAt" | "scheduledFor">;
  routine: CareRoutine | null;
  stoppedReason?: CareCheckInStoppedReason | null;
  nowIso?: string;
}): RoutineAdjustmentDecision {
  const checkInId = input.checkIn.id;
  const consultationFirst =
    input.decision.prioritizeConsultation || input.decision.urgentRisk;

  if (consultationFirst) {
    const proposal = makeProposal(
      "consultation_first",
      checkInId,
      "urgent_risk",
      {
        protectedItemIds: (input.routine?.items ?? [])
          .filter((i) => i.step === "sunscreen")
          .map((i) => i.id),
        allowsApply: false,
        blocksProductAdjustments: true,
      }
    );
    return {
      proposals: [proposal],
      primary: proposal,
      consultationFirst: true,
      routineMissing: !input.routine,
    };
  }

  if (!input.routine) {
    const proposal = makeProposal("record_only", checkInId, "no_routine", {
      protectedItemIds: [],
      allowsApply: false,
    });
    return {
      proposals: [proposal],
      primary: proposal,
      consultationFirst: false,
      routineMissing: true,
    };
  }

  const response = input.decision.response;
  const { recentIds, confident } = findRecentRoutineItemIds(
    input.routine,
    input.checkIn,
    input.nowIso
  );
  const protectedItemIds = input.routine.items
    .filter((i) => i.step === "sunscreen")
    .map((i) => i.id);
  const simplifyCandidates = input.routine.items
    .filter((i) => i.active && SIMPLIFY_PAUSE_STEPS.has(i.step))
    .map((i) => i.id);

  const proposals: RoutineAdjustmentProposal[] = [];
  const push = (
    type: RoutineAdjustmentType,
    reason: RoutineAdjustmentReason,
    opts: Partial<RoutineAdjustmentProposal> = {}
  ) => {
    proposals.push(
      makeProposal(type, checkInId, reason, { protectedItemIds, ...opts })
    );
  };

  switch (response as CheckinResponse) {
    case "improved":
      push("keep_current", "response_improved", { allowsApply: false });
      break;
    case "unchanged":
      push("keep_current", "response_unchanged", { allowsApply: false });
      push("simplify", "response_unchanged", {
        candidateItemIds: simplifyCandidates,
        requiresUserSelection: true,
      });
      break;
    case "worsened": {
      const uncertain = recentIds.length === 0;
      const selectable = uncertain
        ? input.routine.items
            .filter((i) => i.active && i.step !== "sunscreen")
            .map((i) => i.id)
        : recentIds;
      push(
        "pause_recent_product",
        uncertain ? "recent_products_uncertain" : "response_worsened",
        {
          candidateItemIds: selectable,
          requiresUserSelection:
            !confident || uncertain || recentIds.length !== 1,
        }
      );
      push(
        "pause_all_new_products",
        uncertain ? "recent_products_uncertain" : "response_worsened",
        {
          candidateItemIds: selectable,
          requiresUserSelection: uncertain || selectable.length === 0,
        }
      );
      push("simplify", "response_worsened", {
        candidateItemIds: simplifyCandidates,
        requiresUserSelection: true,
      });
      break;
    }
    case "not_started":
      push("restart_later", "response_not_started");
      break;
    case "stopped":
      push("record_only", "response_stopped", { allowsApply: false });
      if (input.stoppedReason === "irritation") {
        push("simplify", "stopped_irritation", {
          candidateItemIds: simplifyCandidates,
          requiresUserSelection: true,
        });
      } else if (input.stoppedReason === "complexity") {
        push("simplify", "stopped_complexity", {
          candidateItemIds: simplifyCandidates,
          requiresUserSelection: true,
        });
      } else if (input.stoppedReason === "purchase_failed") {
        push("restart_later", "response_stopped");
      }
      break;
    case "unsure":
    default:
      push("record_only", "response_unsure", { allowsApply: false });
      break;
  }

  return {
    proposals,
    primary: proposals[0] ?? null,
    consultationFirst: false,
    routineMissing: false,
  };
}

function resolvePauseIds(
  proposal: RoutineAdjustmentProposal,
  routine: CareRoutine,
  selectedItemIds: string[] | undefined
): {
  pauseIds: string[];
  skippedAlreadyPausedIds: string[];
  error?: Extract<ApplyRoutineAdjustmentResult, { ok: false }>;
} {
  if (
    proposal.requiresUserSelection &&
    (!selectedItemIds || selectedItemIds.length === 0)
  ) {
    return {
      pauseIds: [],
      skippedAlreadyPausedIds: [],
      error: { ok: false, error: "requires_selection" },
    };
  }

  const ids =
    selectedItemIds && selectedItemIds.length > 0
      ? selectedItemIds
      : proposal.candidateItemIds;

  const skippedAlreadyPausedIds: string[] = [];
  const pauseIds: string[] = [];
  for (const id of ids) {
    const item = routine.items.find((i) => i.id === id);
    if (!item) continue;
    if (item.step === "sunscreen") continue;
    if (!item.active || item.itemStatus === "paused") {
      skippedAlreadyPausedIds.push(id);
      continue;
    }
    pauseIds.push(id);
  }
  return { pauseIds, skippedAlreadyPausedIds };
}

export function previewRoutineAdjustment(input: {
  routine: CareRoutine;
  proposal: RoutineAdjustmentProposal;
  selectedItemIds?: string[];
  nowIso?: string;
}): RoutineAdjustmentPreview {
  const beforeItems = toAdjustmentTargets(input.routine).map((t) => ({
    ...t,
    isRecentCandidate: input.proposal.candidateItemIds.includes(t.itemId),
  }));

  if (
    !input.proposal.allowsApply ||
    input.proposal.blocksProductAdjustments ||
    input.proposal.type === "keep_current" ||
    input.proposal.type === "record_only" ||
    input.proposal.type === "consultation_first" ||
    input.proposal.type === "restart_later"
  ) {
    return {
      proposal: input.proposal,
      beforeItems,
      afterItems: beforeItems,
      pausedItemIds: [],
      keptActiveItemIds: beforeItems
        .filter((t) => t.currentlyActive)
        .map((t) => t.itemId),
      skippedAlreadyPausedIds: [],
      noteKeys:
        input.proposal.type === "restart_later"
          ? ["restart_reschedule_only"]
          : input.proposal.blocksProductAdjustments
            ? ["consultation_blocks_apply"]
            : ["no_item_change"],
    };
  }

  const { pauseIds, skippedAlreadyPausedIds } = resolvePauseIds(
    input.proposal,
    input.routine,
    input.selectedItemIds
  );

  const afterItems = beforeItems.map((t) =>
    pauseIds.includes(t.itemId) ? { ...t, currentlyActive: false } : t
  );

  return {
    proposal: input.proposal,
    beforeItems,
    afterItems,
    pausedItemIds: pauseIds,
    keptActiveItemIds: afterItems
      .filter((t) => t.currentlyActive)
      .map((t) => t.itemId),
    skippedAlreadyPausedIds,
    noteKeys: [
      "pause_not_delete",
      "undo_available",
      ...(pauseIds.length === 0 ? ["nothing_to_change"] : []),
    ],
  };
}

export function hasAppliedAdjustmentForCheckIn(
  history: CareRoutineAdjustmentRecord[] | undefined,
  checkInId: string,
  type?: RoutineAdjustmentType
): boolean {
  return (history ?? []).some(
    (r) =>
      r.checkInId === checkInId &&
      r.undoneAt == null &&
      (type == null || r.type === type)
  );
}

function structuredCloneRoutine(routine: CareRoutine): CareRoutine {
  return JSON.parse(JSON.stringify(routine)) as CareRoutine;
}

export function applyRoutineAdjustment(
  input: ApplyRoutineAdjustmentInput
): ApplyRoutineAdjustmentResult {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const { proposal, routine } = input;

  if (
    proposal.blocksProductAdjustments ||
    proposal.type === "consultation_first"
  ) {
    return { ok: false, error: "consultation_blocked" };
  }
  if (proposal.type === "keep_current" || proposal.type === "record_only") {
    return { ok: false, error: "keep_or_record_only" };
  }
  if (
    hasAppliedAdjustmentForCheckIn(
      input.history,
      proposal.checkInId,
      proposal.type
    )
  ) {
    return { ok: false, error: "duplicate_apply" };
  }

  if (proposal.type === "restart_later") {
    if (!input.newStartAt?.trim()) {
      return { ok: false, error: "invalid_restart" };
    }
    const nextRoutine: CareRoutine = {
      ...routine,
      version: routine.version + 1,
      updatedAt: nowIso,
    };
    const preview = previewRoutineAdjustment({
      routine,
      proposal,
      selectedItemIds: input.selectedItemIds,
      nowIso,
    });
    const record: CareRoutineAdjustmentRecord = {
      id: `rec_${proposal.id}_${Date.now().toString(36)}`,
      checkInId: proposal.checkInId,
      type: proposal.type,
      appliedAt: nowIso,
      undoneAt: null,
      routineId: routine.id,
      beforeRoutine: structuredCloneRoutine(routine),
      afterRoutine: structuredCloneRoutine(nextRoutine),
      selectedItemIds: [],
      newStartAt: input.newStartAt,
      adjustmentSource: "checkin",
    };
    return { ok: true, routine: nextRoutine, record, preview };
  }

  const { pauseIds, skippedAlreadyPausedIds, error } = resolvePauseIds(
    proposal,
    routine,
    input.selectedItemIds
  );
  if (error) return error;
  if (pauseIds.length === 0) {
    return { ok: false, error: "nothing_to_change" };
  }

  const nextItems: CareRoutineItem[] = routine.items.map((item) => {
    if (!pauseIds.includes(item.id)) return item;
    return {
      ...item,
      active: false,
      stoppedAt: nowIso,
      itemStatus: "paused",
      pausedAt: nowIso,
      pauseReason: proposal.type,
      previousActive: true,
      adjustmentSource: "checkin",
      adjustmentCheckInId: proposal.checkInId,
    };
  });

  const nextRoutine: CareRoutine = {
    ...routine,
    version: routine.version + 1,
    updatedAt: nowIso,
    items: nextItems,
  };

  const preview = previewRoutineAdjustment({
    routine,
    proposal,
    selectedItemIds: pauseIds,
    nowIso,
  });
  preview.skippedAlreadyPausedIds = skippedAlreadyPausedIds;

  const record: CareRoutineAdjustmentRecord = {
    id: `rec_${proposal.id}_${Date.now().toString(36)}`,
    checkInId: proposal.checkInId,
    type: proposal.type,
    appliedAt: nowIso,
    undoneAt: null,
    routineId: routine.id,
    beforeRoutine: structuredCloneRoutine(routine),
    afterRoutine: structuredCloneRoutine(nextRoutine),
    selectedItemIds: pauseIds,
    newStartAt: null,
    adjustmentSource: "checkin",
  };

  return { ok: true, routine: nextRoutine, record, preview };
}

export function undoRoutineAdjustment(input: {
  currentRoutine: CareRoutine;
  record: CareRoutineAdjustmentRecord;
  nowIso?: string;
}):
  | {
      ok: true;
      routine: CareRoutine;
      record: CareRoutineAdjustmentRecord;
    }
  | { ok: false; error: "already_undone" | "routine_mismatch" } {
  if (input.record.undoneAt) {
    return { ok: false, error: "already_undone" };
  }
  if (input.currentRoutine.id !== input.record.routineId) {
    return { ok: false, error: "routine_mismatch" };
  }
  const nowIso = input.nowIso ?? new Date().toISOString();
  const restored: CareRoutine = {
    ...structuredCloneRoutine(input.record.beforeRoutine),
    version: input.currentRoutine.version + 1,
    updatedAt: nowIso,
  };
  return {
    ok: true,
    routine: restored,
    record: { ...input.record, undoneAt: nowIso },
  };
}
