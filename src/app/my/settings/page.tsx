"use client";

import { useEffect, useState } from "react";
import { loadCareStore, saveCareStore, type CareStoreSnapshot } from "@/lib/care";
import { MyCareNav } from "../MyCareNav";

export default function MyCareSettingsPage() {
  const [store, setStore] = useState<CareStoreSnapshot | null>(null);
  useEffect(() => setStore(loadCareStore()), []);

  if (!store) return null;

  function patch(p: Partial<CareStoreSnapshot["settings"]>) {
    const next = {
      ...store!,
      settings: { ...store!.settings, ...p },
    };
    saveCareStore(next);
    setStore(next);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">케어 설정</h1>
      <MyCareNav current="/my/settings" />
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
