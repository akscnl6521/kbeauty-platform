"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { countdownLabel, nextDueCheckIn } from "@/lib/care";
import { hydrateCareDashboard } from "@/lib/care/client-hydrate";
import type { CareCheckIn } from "@/lib/care/types";
import { MyCareNav } from "../MyCareNav";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "예정",
  due: "오늘·예정",
  completed: "완료",
  skipped: "건너뜀",
  expired: "지연·만료",
  cancelled: "취소",
};

export default function MyCheckInsPage() {
  const [checkIns, setCheckIns] = useState<CareCheckIn[]>([]);

  useEffect(() => {
    void hydrateCareDashboard().then((h) => setCheckIns(h.dashboard.checkIns));
  }, []);

  const next = nextDueCheckIn(checkIns);

  return (
    <main className="kb-container py-10">
      <h1 className="text-2xl font-bold tracking-tight">체크인</h1>
      <MyCareNav current="/my/check-ins" />
      <p className="mt-2 text-sm text-stone-600">
        Day 3 · 7 · 15 · 30. 짧은 단계형 질문으로 상태를 기록합니다.
      </p>

      {next ? (
        <p className="mt-4 rounded-lg border border-[#E8DFD8] bg-white px-3 py-3 text-sm">
          다음: Day {next.day} · {countdownLabel(next.dueAt)}{" "}
          <Link
            href={`/my/check-ins/${next.id}`}
            className="ml-2 text-[var(--kb-accent,#8B6914)] underline"
          >
            작성하기
          </Link>
        </p>
      ) : null}

      <ul className="mt-6 space-y-2 text-sm">
        {checkIns
          .slice()
          .sort((a, b) => a.day - b.day)
          .map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3"
            >
              <Link
                href={`/my/check-ins/${c.id}`}
                className="font-medium text-[var(--kb-accent,#8B6914)] underline"
              >
                Day {c.day}
              </Link>
              <span className="ml-2 text-stone-600">
                {STATUS_LABEL[c.status] ?? c.status}
              </span>
              <p className="text-xs text-stone-500">
                예정 {new Date(c.dueAt).toLocaleString()}
              </p>
            </li>
          ))}
      </ul>
      {!checkIns.length ? (
        <p className="mt-4 text-sm text-stone-600">
          아직 체크인이 없습니다.{" "}
          <Link href="/my" className="text-[var(--kb-accent,#8B6914)] underline">
            홈에서 분석 저장
          </Link>
        </p>
      ) : null}
    </main>
  );
}
