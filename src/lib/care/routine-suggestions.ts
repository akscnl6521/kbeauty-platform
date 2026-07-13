/**
 * Safe routine adjustment suggestions — never auto-applied.
 */

import { evaluateDermatologyReferral } from "@/lib/care/referral";
import { hasWorseningSignal } from "@/lib/care/progress";
import type {
  CareCheckIn,
  CareCheckInAnswers,
  CareProgressDelta,
  CareRoutine,
  CareSuggestion,
} from "@/lib/care/types";

function id(): string {
  return `sug_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildRoutineSuggestions(input: {
  checkIn: CareCheckIn;
  answers: CareCheckInAnswers;
  deltas: CareProgressDelta[];
  routine: CareRoutine | null;
}): CareSuggestion[] {
  const out: CareSuggestion[] = [];
  const a = input.answers;
  const day = input.checkIn.day;

  if ((a.sting ?? 0) >= 6 || (a.redness ?? 0) >= 6) {
    out.push({
      id: id(),
      createdAt: new Date().toISOString(),
      checkInId: input.checkIn.id,
      title: "사용 빈도 낮추기",
      reason: "초기 자극 신호가 높게 보고되었습니다.",
      expectedEffect: "자극 부담을 줄이고 적응 여부를 관찰할 수 있습니다.",
      applied: false,
      requiresUserConfirm: true,
      patch: {
        reduceFrequencyItemIds: (input.routine?.items ?? [])
          .filter(
            (i) =>
              i.active &&
              (i.step === "serum" ||
                i.step === "exfoliant" ||
                i.step === "treatment")
          )
          .map((i) => i.id)
          .slice(0, 3),
      },
    });
  }

  if ((a.dryness ?? 0) >= 6) {
    out.push({
      id: id(),
      createdAt: new Date().toISOString(),
      checkInId: input.checkIn.id,
      title: "보습 단계 강화",
      reason: "건조도가 높게 보고되었습니다.",
      expectedEffect: "장벽 부담을 줄이는 데 도움이 될 수 있습니다.",
      applied: false,
      requiresUserConfirm: true,
      patch: { addMoisturizerHint: true },
    });
  }

  if ((a.oiliness ?? 0) >= 7) {
    out.push({
      id: id(),
      createdAt: new Date().toISOString(),
      checkInId: input.checkIn.id,
      title: "무거운 제형 재검토",
      reason: "유분감이 높게 보고되었습니다.",
      expectedEffect: "답답함이 줄 수 있습니다(개인차).",
      applied: false,
      requiresUserConfirm: true,
      patch: {},
    });
  }

  const activeCount = (input.routine?.items ?? []).filter((i) => i.active)
    .length;
  if (activeCount >= 8 || (a.adherence ?? 10) <= 4) {
    out.push({
      id: id(),
      createdAt: new Date().toISOString(),
      checkInId: input.checkIn.id,
      title: "루틴 단순화",
      reason: "단계가 많거나 준수율이 낮게 보고되었습니다.",
      expectedEffect: "꾸준히 쓰기 쉬워질 수 있습니다.",
      applied: false,
      requiresUserConfirm: true,
      patch: { simplifyRoutine: true },
    });
  }

  if (
    day <= 7 &&
    !hasWorseningSignal(input.deltas) &&
    (a.satisfaction ?? 5) <= 5
  ) {
    out.push({
      id: id(),
      createdAt: new Date().toISOString(),
      checkInId: input.checkIn.id,
      title: "최소 2~4주 관찰",
      reason: "초기에는 변화가 뚜렷하지 않을 수 있습니다.",
      expectedEffect: "성급한 중단을 줄일 수 있습니다.",
      applied: false,
      requiresUserConfirm: true,
      patch: { observeWeeks: 3 },
    });
  }

  const referral = evaluateDermatologyReferral(a, {
    daysSinceStart: day,
    worsening: hasWorseningSignal(input.deltas),
  });
  if (referral.level !== "none") {
    out.push({
      id: id(),
      createdAt: new Date().toISOString(),
      checkInId: input.checkIn.id,
      title: "전문가 상담 검토",
      reason: referral.reasons.join(" · ") || referral.userMessage,
      expectedEffect: "화장품만으로 해결하기 어려운 신호일 때 도움이 됩니다.",
      applied: false,
      requiresUserConfirm: true,
      patch: {
        pauseItemIds: (input.routine?.items ?? [])
          .filter((i) => i.active)
          .map((i) => i.id)
          .slice(0, 2),
      },
    });
  }

  return out;
}

/** Apply suggestion only when user confirms — returns new routine version. */
export function applySuggestionToRoutine(
  routine: CareRoutine,
  suggestion: CareSuggestion
): CareRoutine {
  const now = new Date().toISOString();
  let items = routine.items.map((i) => ({ ...i }));
  const p = suggestion.patch;

  if (p.reduceFrequencyItemIds?.length) {
    items = items.map((i) =>
      p.reduceFrequencyItemIds!.includes(i.id)
        ? { ...i, frequency: "every_other_day" as const }
        : i
    );
  }
  if (p.pauseItemIds?.length) {
    items = items.map((i) =>
      p.pauseItemIds!.includes(i.id)
        ? { ...i, active: false, stoppedAt: now }
        : i
    );
  }
  if (p.simplifyRoutine) {
    const keep = new Set(["cleanser", "moisturizer", "sunscreen"]);
    items = items.map((i) =>
      keep.has(i.step) ? i : { ...i, active: false, stoppedAt: now }
    );
  }

  return {
    ...routine,
    version: routine.version + 1,
    updatedAt: now,
    items,
  };
}
