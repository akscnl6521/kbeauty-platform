"use client";

import {
  loadCareStore,
  nextDueCheckIn,
  refreshCareDueState,
  summarizeProgress,
} from "@/lib/care";
import type { CareDashboardDTO } from "@/lib/care/persistence/types";
import type { CareStoreSnapshot } from "@/lib/care/types";

export type CareHydrateResult = {
  source: "server" | "local";
  dashboard: CareDashboardDTO;
  localStore: CareStoreSnapshot | null;
};

function localToDashboard(store: CareStoreSnapshot): CareDashboardDTO {
  const due = nextDueCheckIn(store.checkIns);
  return {
    linkedAccount: false,
    source: "server",
    sessions: store.sessions,
    activeRoutine: store.routines[0] ?? null,
    checkIns: store.checkIns,
    suggestions: store.suggestions,
    notifications: store.notifications,
    progressSummary: summarizeProgress(store.checkIns),
    unreadNotifications: store.notifications.filter((n) => !n.read).length,
    nextDueCheckIn: due,
    settings: store.settings,
  };
}

export async function hydrateCareDashboard(): Promise<CareHydrateResult> {
  try {
    const res = await fetch("/api/care/dashboard", { credentials: "include" });
    if (res.ok) {
      const json = (await res.json()) as {
        ok: boolean;
        data?: CareDashboardDTO;
      };
      if (json.ok && json.data) {
        return {
          source: "server",
          dashboard: json.data,
          localStore: null,
        };
      }
    }
  } catch {
    // fallback to local
  }

  const store = refreshCareDueState();
  return {
    source: "local",
    dashboard: localToDashboard(store),
    localStore: store,
  };
}

export async function attachLocalCareStore(): Promise<{
  ok: boolean;
  message: string;
}> {
  const store = loadCareStore();
  try {
    const res = await fetch("/api/care/analyses/attach", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(store),
    });
    const json = (await res.json()) as {
      ok: boolean;
      data?: { sessionsAttached: number; checkInsAttached: number };
      error?: { message: string };
    };
    if (!res.ok || !json.ok) {
      return {
        ok: false,
        message: json.error?.message ?? "연결에 실패했습니다.",
      };
    }
    const attached = json.data;
    return {
      ok: true,
      message: `연결 완료 — 세션 ${attached?.sessionsAttached ?? 0}건, 체크인 ${attached?.checkInsAttached ?? 0}건`,
    };
  } catch {
    return { ok: false, message: "연결 요청에 실패했습니다." };
  }
}
