"use client";

import { useEffect, useState } from "react";
import {
  applySuggestionToRoutine,
  loadCareStore,
  saveCareStore,
} from "@/lib/care";
import { hydrateCareDashboard } from "@/lib/care/client-hydrate";
import type { CareRoutine, CareStoreSnapshot, CareSuggestion } from "@/lib/care/types";
import { MyCareNav } from "../MyCareNav";

export default function MyRoutinePage() {
  const [routine, setRoutine] = useState<CareRoutine | null>(null);
  const [suggestions, setSuggestions] = useState<CareSuggestion[]>([]);
  const [source, setSource] = useState<"server" | "local">("local");
  const [localStore, setLocalStore] = useState<CareStoreSnapshot | null>(null);

  useEffect(() => {
    void hydrateCareDashboard().then((h) => {
      setRoutine(h.dashboard.activeRoutine);
      setSuggestions(h.dashboard.suggestions);
      setSource(h.source);
      setLocalStore(h.localStore);
    });
  }, []);

  async function applyFirstPending() {
    const sug = suggestions.find((s) => !s.applied);
    if (!sug || !routine) return;

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
        setSuggestions((prev) =>
          prev.map((s) => (s.id === sug.id ? { ...s, applied: true } : s))
        );
      }
      return;
    }

    const store = localStore ?? loadCareStore();
    const nextRoutine = applySuggestionToRoutine(routine, sug);
    const next: CareStoreSnapshot = {
      ...store,
      routines: store.routines.map((r) =>
        r.id === routine.id ? nextRoutine : r
      ),
      suggestions: store.suggestions.map((s) =>
        s.id === sug.id ? { ...s, applied: true } : s
      ),
    };
    saveCareStore(next);
    setRoutine(nextRoutine);
    setSuggestions(next.suggestions);
    setLocalStore(next);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">내 루틴</h1>
      <MyCareNav current="/my/routine" />
      <p className="mt-2 text-sm text-gray-600">
        시스템은 제안만 합니다. 적용 버튼을 누르기 전에는 저장 루틴을 바꾸지
        않습니다.
      </p>
      {!routine ? (
        <p className="mt-4 text-sm text-gray-600">저장된 루틴이 없습니다.</p>
      ) : (
        <>
          <p className="mt-4 text-sm">버전 {routine.version}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {routine.items.map((i) => (
              <li
                key={i.id}
                className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
              >
                {i.step} · {i.timeOfDay} · {i.frequency} ·{" "}
                {i.active ? "사용중" : "중단"}
                {i.productId ? ` · #${i.productId}` : ""}
                {i.customProductName ? ` · ${i.customProductName}` : ""}
              </li>
            ))}
          </ul>
          {routine.conflictNotes.length ? (
            <ul className="mt-4 list-disc pl-5 text-sm text-amber-900">
              {routine.conflictNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            onClick={() => void applyFirstPending()}
            className="mt-4 rounded-lg border border-[#E8DFD8] px-3 py-2 text-sm"
          >
            대기 중 제안 1건 적용
          </button>
        </>
      )}
    </main>
  );
}
