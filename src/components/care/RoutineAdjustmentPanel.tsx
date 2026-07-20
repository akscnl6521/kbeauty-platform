"use client";

import { useMemo, useState } from "react";
import type { CareRoutine, CareRoutineAdjustmentRecord } from "@/lib/care/types";
import type { CheckinDecision } from "@/lib/retention/checkinPolicy";
import {
  getRoutineAdjustmentNoteLabel,
  getRoutineAdjustmentReasonLabel,
  getRoutineAdjustmentTypeLabel,
} from "@/lib/retention/routineAdjustmentCopy";
import {
  hasAppliedAdjustmentForCheckIn,
  previewRoutineAdjustment,
  proposeRoutineAdjustments,
  type RoutineAdjustmentProposal,
} from "@/lib/retention/routineAdjustmentPolicy";

type Props = {
  decision: CheckinDecision;
  checkIn: {
    id: string;
    day: 3 | 7 | 15 | 30;
    dueAt: string;
    scheduledFor: string;
  };
  routine: CareRoutine | null;
  history?: CareRoutineAdjustmentRecord[];
  stoppedReason?: "irritation" | "complexity" | "purchase_failed" | "other" | null;
  onApply: (input: {
    proposal: RoutineAdjustmentProposal;
    selectedItemIds: string[];
    newStartAt: string | null;
  }) => void;
  onKeepCurrent: () => void;
  onLater: () => void;
  onUndo: () => void;
};

export function RoutineAdjustmentPanel({
  decision,
  checkIn,
  routine,
  history = [],
  stoppedReason = null,
  onApply,
  onKeepCurrent,
  onLater,
  onUndo,
}: Props) {
  const adjustment = useMemo(
    () =>
      proposeRoutineAdjustments({
        decision,
        checkIn,
        routine,
        stoppedReason,
      }),
    [decision, checkIn, routine, stoppedReason]
  );

  const [selectedType, setSelectedType] = useState<string | null>(
    adjustment.primary?.id ?? null
  );
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [newStartAt, setNewStartAt] = useState("");
  const [deferred, setDeferred] = useState(false);

  const proposal =
    adjustment.proposals.find((p) => p.id === selectedType) ??
    adjustment.primary;

  const alreadyApplied = hasAppliedAdjustmentForCheckIn(history, checkIn.id);
  const activeRecord = history.find(
    (r) => r.checkInId === checkIn.id && r.undoneAt == null
  );

  const preview =
    proposal && routine
      ? previewRoutineAdjustment({
          routine,
          proposal,
          selectedItemIds,
        })
      : null;

  function toggleItem(id: string) {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  if (deferred) {
    return (
      <section className="rounded-2xl border border-[#E8DFD8] bg-white p-4 text-sm">
        <p>나중에 다시 확인할 수 있습니다. 루틴은 바꾸지 않았습니다.</p>
        <button
          type="button"
          className="mt-3 text-[#8B6914] underline"
          onClick={() => setDeferred(false)}
        >
          조정안 다시 보기
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-[#E8DFD8] bg-white p-4 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          체크인 기반 루틴 조정
        </p>
        <p className="mt-1 text-gray-700">
          제안만 표시합니다. 적용하기를 누르기 전에는 루틴이 바뀌지 않습니다.
        </p>
      </div>

      {adjustment.consultationFirst ? (
        <p
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 font-medium text-rose-900"
          role="alert"
        >
          {getRoutineAdjustmentReasonLabel("urgent_risk")}
        </p>
      ) : null}

      {adjustment.routineMissing ? (
        <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-amber-900">
          {getRoutineAdjustmentReasonLabel("no_routine")}
        </p>
      ) : null}

      {alreadyApplied && activeRecord ? (
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
          <p className="font-medium">
            이 체크인에 이미 조정을 적용했습니다 (
            {getRoutineAdjustmentTypeLabel(
              activeRecord.type as RoutineAdjustmentProposal["type"]
            )}
            ).
          </p>
          <p className="text-xs text-gray-600">
            {getRoutineAdjustmentNoteLabel("after_apply")}
          </p>
          <button
            type="button"
            className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
            onClick={onUndo}
          >
            최근 조정 되돌리기
          </button>
        </div>
      ) : null}

      {!alreadyApplied ? (
        <>
          <fieldset className="space-y-2">
            <legend className="font-semibold">추천 조정안</legend>
            {adjustment.proposals.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer gap-2 rounded-lg border border-[#E8DFD8] px-3 py-2"
              >
                <input
                  type="radio"
                  name="adj"
                  checked={proposal?.id === p.id}
                  onChange={() => {
                    setSelectedType(p.id);
                    setSelectedItemIds(
                      p.requiresUserSelection ? [] : p.candidateItemIds
                    );
                  }}
                />
                <span>
                  <span className="font-medium">
                    {getRoutineAdjustmentTypeLabel(p.type)}
                  </span>
                  <span className="mt-1 block text-xs text-gray-600">
                    {getRoutineAdjustmentReasonLabel(p.reason)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          {proposal ? (
            <p className="text-xs text-gray-600">
              {getRoutineAdjustmentNoteLabel("confirm_before_apply")} ·{" "}
              {getRoutineAdjustmentNoteLabel("pause_not_delete")}
            </p>
          ) : null}

          {proposal?.type === "restart_later" ? (
            <label className="block">
              <span className="font-medium">새 시작일</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-[#E8DFD8] px-3 py-2"
                value={newStartAt}
                onChange={(e) => setNewStartAt(e.target.value)}
              />
            </label>
          ) : null}

          {proposal &&
          routine &&
          (proposal.type === "simplify" ||
            proposal.type === "pause_recent_product" ||
            proposal.type === "pause_all_new_products") ? (
            <fieldset className="space-y-2">
              <legend className="font-semibold">
                {proposal.requiresUserSelection
                  ? "일시 중지할 항목 선택"
                  : "일시 중지 후보"}
              </legend>
              {routine.items
                .filter((i) => proposal.candidateItemIds.includes(i.id))
                .map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-2 rounded-lg border border-[#E8DFD8] px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={selectedItemIds.includes(item.id)}
                      disabled={item.step === "sunscreen" || !item.active}
                      onChange={() => toggleItem(item.id)}
                    />
                    <span>
                      {item.customProductName || item.step}
                      {item.step === "sunscreen" ? " (자동 중단 제외)" : ""}
                      {!item.active ? " · 이미 중지" : ""}
                    </span>
                  </label>
                ))}
            </fieldset>
          ) : null}

          {preview && routine ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[#E8DFD8] px-3 py-2">
                <p className="text-xs font-semibold text-gray-500">적용 전</p>
                <ul className="mt-1 space-y-1">
                  {preview.beforeItems.map((t) => (
                    <li key={t.itemId}>
                      {t.label} · {t.currentlyActive ? "사용중" : "중지"}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-[#E8DFD8] px-3 py-2">
                <p className="text-xs font-semibold text-gray-500">적용 후 예상</p>
                <ul className="mt-1 space-y-1">
                  {preview.afterItems.map((t) => (
                    <li key={t.itemId}>
                      {t.label} · {t.currentlyActive ? "사용중" : "일시 중지"}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {proposal?.allowsApply &&
            !proposal.blocksProductAdjustments &&
            !adjustment.consultationFirst ? (
              <button
                type="button"
                className="rounded-lg bg-[#8B6914] px-4 py-2 text-white"
                onClick={() => {
                  if (!proposal) return;
                  onApply({
                    proposal,
                    selectedItemIds,
                    newStartAt: newStartAt
                      ? new Date(`${newStartAt}T10:00:00`).toISOString()
                      : null,
                  });
                }}
              >
                적용하기
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-lg border border-[#E8DFD8] px-4 py-2"
              onClick={() => {
                onKeepCurrent();
                setSelectedType(
                  adjustment.proposals.find((p) => p.type === "keep_current")
                    ?.id ?? selectedType
                );
              }}
            >
              현재 루틴 유지
            </button>
            <button
              type="button"
              className="rounded-lg border border-[#E8DFD8] px-4 py-2"
              onClick={() => {
                setDeferred(true);
                onLater();
              }}
            >
              나중에
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
