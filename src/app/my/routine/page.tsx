"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  applySuggestionToRoutine,
  loadCareStore,
  pauseRoutine,
  saveCareStore,
  nextDueCheckIn,
  countdownLabel,
} from "@/lib/care";
import { hydrateCareDashboard } from "@/lib/care/client-hydrate";
import type {
  CareCheckIn,
  CareRoutine,
  CareStoreSnapshot,
  CareSuggestion,
} from "@/lib/care/types";
import { MyCareNav } from "../MyCareNav";

export default function MyRoutinePage() {
  const [routine, setRoutine] = useState<CareRoutine | null>(null);
  const [suggestions, setSuggestions] = useState<CareSuggestion[]>([]);
  const [checkIns, setCheckIns] = useState<CareCheckIn[]>([]);
  const [source, setSource] = useState<"server" | "local">("local");
  const [localStore, setLocalStore] = useState<CareStoreSnapshot | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void hydrateCareDashboard().then((h) => {
      setRoutine(h.dashboard.activeRoutine);
      setSuggestions(h.dashboard.suggestions.filter((s) => !s.applied));
      setCheckIns(h.dashboard.checkIns);
      setSource(h.source);
      setLocalStore(h.localStore);
    });
  }, []);

  const am = useMemo(
    () =>
      (routine?.items ?? [])
        .filter((i) => i.active && (i.timeOfDay === "am" || i.timeOfDay === "both"))
        .sort((a, b) => a.order - b.order),
    [routine]
  );
  const pm = useMemo(
    () =>
      (routine?.items ?? [])
        .filter((i) => i.active && (i.timeOfDay === "pm" || i.timeOfDay === "both"))
        .sort((a, b) => a.order - b.order),
    [routine]
  );
  const activeCount = (routine?.items ?? []).filter((i) => i.active).length;
  const next = nextDueCheckIn(checkIns);
  const todayDone = Math.min(am.length + pm.length, activeCount);
  const todayTotal = Math.max(am.length + pm.length, 1);
  const progressPct = Math.round((Math.min(todayDone, todayTotal) / todayTotal) * 100);

  async function applySuggestion(sug: CareSuggestion) {
    if (!routine) return;
    if (source === "server") {
      const res = await fetch(`/api/care/suggestions/${sug.id}/accept`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const json = (await res.json()) as {
          ok: boolean;
          data?: { routine: CareRoutine };
        };
        if (json.data?.routine) setRoutine(json.data.routine);
        setSuggestions((prev) => prev.filter((s) => s.id !== sug.id));
        setMsg("제안을 적용했습니다. (사용자가 확인한 변경만 반영)");
      }
      return;
    }
    const store = localStore ?? loadCareStore();
    const nextRoutine = applySuggestionToRoutine(routine, sug);
    const nextStore: CareStoreSnapshot = {
      ...store,
      routines: store.routines.map((r) =>
        r.id === routine.id ? nextRoutine : r
      ),
      suggestions: store.suggestions.map((s) =>
        s.id === sug.id ? { ...s, applied: true } : s
      ),
    };
    saveCareStore(nextStore);
    setRoutine(nextRoutine);
    setSuggestions(nextStore.suggestions.filter((s) => !s.applied));
    setLocalStore(nextStore);
    setMsg("제안을 적용했습니다.");
  }

  function onPause(mode: "pause" | "stop") {
    if (!routine) return;
    if (source === "server") {
      setMsg(
        "서버 루틴 일시중지 API는 버전 생성으로 처리됩니다. 로컬에서 먼저 반영하거나 제안을 사용하세요."
      );
      return;
    }
    const nextStore = pauseRoutine(routine.id, mode);
    setRoutine(nextStore.routines.find((r) => r.id === routine.id) ?? null);
    setCheckIns(nextStore.checkIns);
    setLocalStore(nextStore);
    setMsg(mode === "stop" ? "루틴을 중단하고 이후 체크인을 취소했습니다." : "루틴을 일시 중지했습니다.");
  }

  return (
    <main className="kb-container py-10">
      <h1 className="text-2xl font-bold tracking-tight">내 루틴</h1>
      <MyCareNav current="/my/routine" />
      <p className="mt-2 text-sm text-stone-600">
        시스템은 제안만 합니다. 적용 버튼을 누르기 전에는 저장 루틴을 바꾸지 않습니다.
      </p>

      {msg ? (
        <p role="status" aria-live="polite" className="mt-3 text-sm text-stone-700">
          {msg}
        </p>
      ) : null}

      {!routine ? (
        <div className="mt-8 space-y-3 text-sm">
          <p className="text-stone-600">저장된 루틴이 없습니다.</p>
          <Link
            href="/my/routine/new"
            className="inline-flex min-h-11 items-center rounded-lg bg-[var(--kb-accent,#8B6914)] px-4 text-white"
          >
            루틴 초안 만들기
          </Link>
        </div>
      ) : (
        <>
          <section className="mt-6">
            <p className="text-sm text-stone-600">버전 {routine.version}</p>
            <div className="mt-2">
              <p className="text-xs text-stone-500">오늘 진행률 (활성 단계 기준 표시)</p>
              <div
                className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100"
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full bg-[var(--kb-accent,#8B6914)]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
            {activeCount >= 8 ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                단계가 {activeCount}개로 많습니다. 단순화를 권장하지만 자동 삭제하지는 않습니다.
              </p>
            ) : null}
          </section>

          <section className="mt-6">
            <h2 className="text-lg font-semibold">아침</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {am.length ? (
                am.map((i) => (
                  <li
                    key={`am-${i.id}`}
                    className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3"
                  >
                    <span className="font-medium">{i.order}. {i.step}</span>
                    <span className="text-stone-600">
                      {" "}
                      · {i.frequency}
                      {i.customProductName ? ` · ${i.customProductName}` : ""}
                      {i.productId ? ` · #${i.productId}` : ""}
                    </span>
                    {i.usageNote ? (
                      <p className="mt-1 text-xs text-stone-500">{i.usageNote}</p>
                    ) : null}
                  </li>
                ))
              ) : (
                <li className="text-stone-500">아침 제품이 없습니다.</li>
              )}
            </ul>
          </section>

          <section className="mt-6">
            <h2 className="text-lg font-semibold">저녁</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {pm.length ? (
                pm.map((i) => (
                  <li
                    key={`pm-${i.id}`}
                    className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3"
                  >
                    <span className="font-medium">{i.order}. {i.step}</span>
                    <span className="text-stone-600">
                      {" "}
                      · {i.frequency}
                      {i.customProductName ? ` · ${i.customProductName}` : ""}
                      {i.productId ? ` · #${i.productId}` : ""}
                    </span>
                  </li>
                ))
              ) : (
                <li className="text-stone-500">저녁 제품이 없습니다.</li>
              )}
            </ul>
          </section>

          {routine.conflictNotes.length ? (
            <ul className="mt-4 list-disc pl-5 text-sm text-amber-900">
              {routine.conflictNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}

          <section className="mt-6 space-y-3">
            <h2 className="text-lg font-semibold">조정 제안</h2>
            {!suggestions.length ? (
              <p className="text-sm text-stone-500">대기 중 제안이 없습니다.</p>
            ) : (
              suggestions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3 text-sm"
                >
                  <p className="font-medium">{s.title}</p>
                  <p className="text-stone-700">{s.reason}</p>
                  <p className="text-xs text-stone-500">{s.expectedEffect}</p>
                  <button
                    type="button"
                    className="mt-2 min-h-11 rounded-lg border border-stone-300 px-3"
                    onClick={() => void applySuggestion(s)}
                  >
                    내가 확인 후 적용
                  </button>
                </div>
              ))
            )}
          </section>

          <section className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link
              href="/my/routine/new"
              className="inline-flex min-h-11 items-center underline text-[var(--kb-accent,#8B6914)]"
            >
              제품 교체·초안 편집
            </Link>
            <button
              type="button"
              className="min-h-11 underline text-stone-600"
              onClick={() => onPause("pause")}
            >
              일시 중지
            </button>
            <button
              type="button"
              className="min-h-11 underline text-stone-600"
              onClick={() => onPause("stop")}
            >
              중단
            </button>
          </section>

          {next ? (
            <p className="mt-6 text-sm text-stone-700">
              다음 체크인: Day {next.day} · {countdownLabel(next.dueAt)}{" "}
              <Link
                href={`/my/check-ins/${next.id}`}
                className="text-[var(--kb-accent,#8B6914)] underline"
              >
                열기
              </Link>
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}
