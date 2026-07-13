"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hydrateCareDashboard } from "@/lib/care/client-hydrate";
import type { CareCheckIn } from "@/lib/care/types";
import { MyCareNav } from "../MyCareNav";

export default function MyCheckInsPage() {
  const [checkIns, setCheckIns] = useState<CareCheckIn[]>([]);

  useEffect(() => {
    void hydrateCareDashboard().then((h) => setCheckIns(h.dashboard.checkIns));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">체크인</h1>
      <MyCareNav current="/my/check-ins" />
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
                className="font-medium text-[#8B6914] underline"
              >
                Day {c.day}
              </Link>
              <span className="ml-2 text-gray-600">{c.status}</span>
              <p className="text-xs text-gray-500">{c.dueAt}</p>
            </li>
          ))}
      </ul>
      {!checkIns.length ? (
        <p className="mt-4 text-sm text-gray-600">
          아직 체크인이 없습니다.{" "}
          <Link href="/my" className="text-[#8B6914] underline">
            홈에서 분석 저장
          </Link>
        </p>
      ) : null}
    </main>
  );
}
