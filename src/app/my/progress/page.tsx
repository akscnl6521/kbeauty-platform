"use client";

import { useEffect, useState } from "react";
import { hydrateCareDashboard } from "@/lib/care/client-hydrate";
import { loadCareStore } from "@/lib/care";
import {
  productFeedbackSafetyMessage,
  summarizeProductFeedback,
  type ProductFeedbackSummary,
} from "@/lib/care/feedbackSummary";
import type { CareProgressDelta } from "@/lib/care/types";
import { MyCareNav } from "../MyCareNav";

const TREND_KO = {
  improved: "좋아짐",
  similar: "비슷함",
  worsened: "악화",
  insufficient_data: "데이터 부족",
} as const;

const EMPTY_FEEDBACK_SUMMARY: ProductFeedbackSummary = {
  total: 0,
  used: 0,
  purchased: 0,
  irritation: 0,
  repurchaseYes: 0,
  averageSatisfaction: null,
};

export default function MyProgressPage() {
  const [deltas, setDeltas] = useState<CareProgressDelta[]>([]);
  const [feedbackSummary, setFeedbackSummary] =
    useState<ProductFeedbackSummary>(EMPTY_FEEDBACK_SUMMARY);

  useEffect(() => {
    void hydrateCareDashboard().then((h) =>
      setDeltas(h.dashboard.progressSummary)
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time hydrate from localStorage-backed care store; not available during server render
    setFeedbackSummary(summarizeProductFeedback(loadCareStore().feedback ?? []));
  }, []);

  const safetyMessage = productFeedbackSafetyMessage(feedbackSummary);

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-[#FAF7F5] px-4 py-10 text-gray-900">
      <h1 className="text-2xl font-bold">피부 변화</h1>
      <MyCareNav current="/my/progress" />
      <p className="mt-2 text-sm text-gray-600">
        과장된 효과 수치를 만들지 않습니다. 체크인 자기보고와 실제 제품 사용 기록만 표시합니다.
      </p>

      <section className="mt-6 rounded-2xl border border-[#E8DFD8] bg-white p-4">
        <h2 className="font-semibold">제품 사용 경험 요약</h2>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-[#FAF7F5] p-3"><p className="text-xs text-gray-500">기록한 제품</p><p className="text-xl font-semibold tabular-nums">{feedbackSummary.total}</p></div>
          <div className="rounded-lg bg-[#FAF7F5] p-3"><p className="text-xs text-gray-500">실제 사용</p><p className="text-xl font-semibold tabular-nums">{feedbackSummary.used}</p></div>
          <div className="rounded-lg bg-[#FAF7F5] p-3"><p className="text-xs text-gray-500">구매</p><p className="text-xl font-semibold tabular-nums">{feedbackSummary.purchased}</p></div>
          <div className="rounded-lg bg-[#FAF7F5] p-3"><p className="text-xs text-gray-500">평균 만족도</p><p className="text-xl font-semibold tabular-nums">{feedbackSummary.averageSatisfaction ?? "—"}</p></div>
          <div className="rounded-lg bg-[#FAF7F5] p-3"><p className="text-xs text-gray-500">재구매 의향</p><p className="text-xl font-semibold tabular-nums">{feedbackSummary.repurchaseYes}</p></div>
          <div className="rounded-lg bg-[#FAF7F5] p-3"><p className="text-xs text-gray-500">자극 기록</p><p className="text-xl font-semibold tabular-nums">{feedbackSummary.irritation}</p></div>
        </div>
        {safetyMessage ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {safetyMessage}
          </p>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">체크인 변화</h2>
        <ul className="mt-3 space-y-2 text-sm">
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
      </section>
    </main>
  );
}
