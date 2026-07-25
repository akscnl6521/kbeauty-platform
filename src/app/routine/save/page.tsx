"use client";

import Link from "next/link";
import { useState } from "react";
import { SampleDataBadge } from "@/components/scaffold/SampleDataBadge";

const SCAFFOLD_SAVE_KEY = "kbeautyScaffoldRoutineSavedAt";

function persistScaffoldSave(): string {
  const now = new Date().toISOString();
  if (typeof window === "undefined") return now;
  try {
    window.localStorage.setItem(SCAFFOLD_SAVE_KEY, now);
  } catch {
    /* ignore */
  }
  return now;
}

export default function RoutineSavePage() {
  const [savedAt] = useState<string>(persistScaffoldSave);

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-[#FAF7F5] px-4 py-10 text-gray-900">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">저장 완료</h1>
        <SampleDataBadge label="스캐폴드 저장" />
      </div>

      <section className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
        <p className="text-sm font-semibold text-green-900">
          ✓ 루틴과 구매처 선택이 저장되었습니다.
        </p>
        {savedAt ? (
          <p className="mt-1 text-xs text-green-800" suppressHydrationWarning>
            {savedAt}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-green-800">
          이 화면은 스캐폴드용 저장 스텝입니다. 실제 서버 저장은
          `/api/care/routines`(내 루틴 화면)에서 이미 연결되어 있습니다.
        </p>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/routine/purchase"
          className="inline-flex rounded-lg border border-[#E8DFD8] bg-white px-4 py-2 text-sm font-semibold"
        >
          ← 구매처로 돌아가기
        </Link>
        <Link
          href="/my/check-ins"
          className="inline-flex rounded-lg bg-[#C2185B] px-4 py-2 text-sm font-semibold text-white"
        >
          체크인으로 계속하기 →
        </Link>
      </div>
    </main>
  );
}
