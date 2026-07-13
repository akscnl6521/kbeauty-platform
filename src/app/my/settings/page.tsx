"use client";

import { useEffect, useState } from "react";
import { loadCareStore, saveCareStore } from "@/lib/care";
import {
  attachLocalCareStore,
  hydrateCareDashboard,
} from "@/lib/care/client-hydrate";
import type { CareStoreSnapshot } from "@/lib/care/types";
import { MyCareNav } from "../MyCareNav";

export default function MyCareSettingsPage() {
  const [store, setStore] = useState<CareStoreSnapshot | null>(null);
  const [linked, setLinked] = useState(false);
  const [source, setSource] = useState<"server" | "local">("local");
  const [attachMsg, setAttachMsg] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);

  useEffect(() => {
    void hydrateCareDashboard().then((h) => {
      setLinked(h.dashboard.linkedAccount || h.source === "server");
      setSource(h.source);
      setStore(h.localStore ?? loadCareStore());
    });
  }, []);

  if (!store) return null;

  function patch(p: Partial<CareStoreSnapshot["settings"]>) {
    const next = {
      ...store!,
      settings: { ...store!.settings, ...p },
    };
    saveCareStore(next);
    setStore(next);
  }

  async function handleAttach() {
    if (
      !window.confirm(
        "이 기기의 로컬 케어 데이터를 계정에 연결합니다. 중복 항목은 건너뜁니다. 계속할까요?"
      )
    ) {
      return;
    }
    setAttaching(true);
    setAttachMsg(null);
    const result = await attachLocalCareStore();
    setAttaching(false);
    setAttachMsg(result.message);
    if (result.ok) {
      setLinked(true);
      setSource("server");
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">케어 설정</h1>
      <MyCareNav current="/my/settings" />
      <div className="mt-4 rounded-lg border border-[#E8DFD8] bg-white px-3 py-3 text-sm">
        <p>
          계정 연결:{" "}
          <span className="font-medium">
            {linked ? "연결됨 (서버)" : "미연결 (로컬만)"}
          </span>
        </p>
        <p className="mt-1 text-xs text-gray-500">
          현재 데이터 출처: {source === "server" ? "서버" : "이 기기"}
        </p>
        {source === "local" ? (
          <button
            type="button"
            disabled={attaching}
            onClick={() => void handleAttach()}
            className="mt-3 rounded-lg border border-[#E8DFD8] px-3 py-2 text-sm disabled:opacity-50"
          >
            {attaching ? "연결 중…" : "로컬 데이터 계정에 연결"}
          </button>
        ) : null}
        {attachMsg ? (
          <p className="mt-2 text-xs text-gray-700">{attachMsg}</p>
        ) : null}
      </div>
      <div className="mt-6 space-y-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={store.settings.notificationsEnabled}
            onChange={(e) => patch({ notificationsEnabled: e.target.checked })}
          />
          사이트 내 알림
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={store.settings.emailOptIn}
            onChange={(e) => patch({ emailOptIn: e.target.checked })}
          />
          이메일 알림 (외부 발송은 credential 있을 때만)
        </label>
        <p className="text-xs text-gray-500">
          야간 회피: {store.settings.quietHoursStart}:00–
          {store.settings.quietHoursEnd}:00 · timezone{" "}
          {store.settings.timezone}
        </p>
      </div>
    </main>
  );
}
