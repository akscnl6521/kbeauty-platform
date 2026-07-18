"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  countdownLabel,
  loadCareStore,
  mergeNotifications,
  nextDueCheckIn,
  refreshCareDueState,
  saveCareStore,
} from "@/lib/care";
import { hydrateCareDashboard } from "@/lib/care/client-hydrate";
import type { CareCheckIn, CareNotification } from "@/lib/care/types";
import { MyCareNav } from "../MyCareNav";

type Filter = "all" | "unread" | "checkin" | "safety";

export default function MyNotificationsPage() {
  const [notifications, setNotifications] = useState<CareNotification[]>([]);
  const [checkIns, setCheckIns] = useState<CareCheckIn[]>([]);
  const [source, setSource] = useState<"server" | "local">("local");
  const [filter, setFilter] = useState<Filter>("all");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const refreshed = refreshCareDueState();
      const h = await hydrateCareDashboard();
      setSource(h.source);
      setCheckIns(h.dashboard.checkIns);
      if (h.source === "server") {
        const res = await fetch("/api/care/notifications", {
          credentials: "include",
        });
        if (res.ok) {
          const json = (await res.json()) as {
            ok: boolean;
            data?: { notifications?: CareNotification[] } | CareNotification[];
          };
          const list = Array.isArray(json.data)
            ? json.data
            : json.data?.notifications ?? [];
          setNotifications(list);
          return;
        }
        setNote("서버 알림을 불러오지 못해 로컬 목록을 표시합니다. (Staging 미연결 가능)");
      }
      setNotifications(
        mergeNotifications([], refreshed.notifications, refreshed.checkIns)
      );
    })();
  }, []);

  const next = nextDueCheckIn(checkIns);
  const overdue = checkIns.filter((c) => c.status === "due" || c.status === "expired");
  const completed = checkIns.filter((c) => c.status === "completed");

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === "unread") return !n.read;
      if (filter === "checkin") return n.kind === "checkin_due";
      if (filter === "safety") return n.kind === "referral";
      return true;
    });
  }, [notifications, filter]);

  async function markRead(id: string) {
    if (source === "server") {
      await fetch(`/api/care/notifications/${id}/read`, {
        method: "POST",
        credentials: "include",
      });
    } else {
      const store = loadCareStore();
      const nextStore = {
        ...store,
        notifications: store.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
      };
      saveCareStore(nextStore);
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  return (
    <main className="kb-container py-10">
      <h1 className="text-2xl font-bold tracking-tight">알림</h1>
      <MyCareNav current="/my/notifications" />
      <p className="mt-2 text-sm text-stone-600">
        앱 내 알림 센터입니다. 외부 이메일과 별개이며, Production 데이터로 위장하지 않습니다.
      </p>
      {note ? (
        <p role="status" className="mt-2 text-xs text-amber-800">
          {note}
        </p>
      ) : null}

      <section className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3">
          <p className="text-xs text-stone-500">다음 체크인</p>
          <p className="mt-1 font-medium">
            {next ? `Day ${next.day} · ${countdownLabel(next.dueAt)}` : "없음"}
          </p>
          {next ? (
            <Link
              href={`/my/check-ins/${next.id}`}
              className="mt-2 inline-flex min-h-11 items-center text-[var(--kb-accent,#8B6914)] underline"
            >
              열기
            </Link>
          ) : null}
        </div>
        <div className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3">
          <p className="text-xs text-stone-500">지연·예정</p>
          <p className="mt-1 font-medium">{overdue.length}건</p>
        </div>
        <div className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3">
          <p className="text-xs text-stone-500">완료</p>
          <p className="mt-1 font-medium">{completed.length}건</p>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap gap-2 text-sm" role="tablist" aria-label="알림 필터">
        {(
          [
            ["all", "전체"],
            ["unread", "안 읽음"],
            ["checkin", "체크인"],
            ["safety", "안전"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={
              filter === id
                ? "min-h-11 rounded-full bg-stone-900 px-3 text-white"
                : "min-h-11 rounded-full bg-stone-100 px-3 text-stone-700"
            }
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-2 text-sm">
        {filtered.map((n) => (
          <li
            key={n.id}
            className={`rounded-lg border px-3 py-3 ${
              n.read ? "border-stone-100 bg-stone-50" : "border-[#E8DFD8] bg-white"
            }`}
          >
            <p className="font-medium">{n.title}</p>
            <p className="text-stone-700">{n.message}</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {n.relatedCheckInId ? (
                <Link
                  href={`/my/check-ins/${n.relatedCheckInId}`}
                  className="min-h-11 inline-flex items-center text-[var(--kb-accent,#8B6914)] underline"
                >
                  체크인으로 이동
                </Link>
              ) : null}
              {!n.read ? (
                <button
                  type="button"
                  className="min-h-11 underline text-stone-600"
                  onClick={() => void markRead(n.id)}
                >
                  읽음
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {!filtered.length ? (
        <p className="mt-4 text-sm text-stone-500">표시할 알림이 없습니다.</p>
      ) : null}
    </main>
  );
}
