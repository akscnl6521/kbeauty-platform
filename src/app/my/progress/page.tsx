"use client";

import { useEffect, useState } from "react";
import { hydrateCareDashboard } from "@/lib/care/client-hydrate";
import type { CareProgressDelta } from "@/lib/care/types";
import { MyCareNav } from "../MyCareNav";

const TREND_KO = {
  improved: "좋아짐",
  similar: "비슷함",
  worsened: "악화",
  insufficient_data: "데이터 부족",
} as const;

export default function MyProgressPage() {
  const [deltas, setDeltas] = useState<CareProgressDelta[]>([]);

  useEffect(() => {
    void hydrateCareDashboard().then((h) =>
      setDeltas(h.dashboard.progressSummary)
    );
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">피부 변화</h1>
      <MyCareNav current="/my/progress" />
      <p className="mt-2 text-sm text-gray-600">
        과장된 효과 수치를 만들지 않습니다. 자기보고 비교만 표시합니다.
      </p>
      <ul className="mt-6 space-y-2 text-sm">
        {deltas.map((d) => (
          <li
            key={d.metric}
            className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
          >
            <span className="font-medium">{d.metric}</span>
            <span className="ml-2 text-gray-600">
              {d.from ?? "—"} → {d.to ?? "—"} · {TREND_KO[d.trend]}
            </span>
          </li>
        ))}
      </ul>
      {!deltas.length ? (
        <p className="mt-4 text-sm text-gray-600">완료된 체크인이 필요합니다.</p>
      ) : null}
    </main>
  );
}
