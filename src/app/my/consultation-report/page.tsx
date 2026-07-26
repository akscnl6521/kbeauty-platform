"use client";

import Link from "next/link";
import { MyCareNav } from "../MyCareNav";
import { SampleDataBadge } from "@/components/scaffold/SampleDataBadge";

const MOCK_REPORT = {
  generatedAt: new Date().toISOString().slice(0, 10),
  concerns: ["여드름", "홍조"],
  sensitivity: "높음",
  durationWeeks: 6,
  currentRoutine: [
    "아침: 클렌저 → 진정 토너 → 보습 크림 → 선크림",
    "저녁: 클렌저 → 진정 토너 → 세럼 → 보습 크림",
  ],
  allergyIngredients: ["향료(Fragrance)"],
  redFlags: ["사용자 응답 기준 최근 2주 내 급격한 악화 보고 없음"],
  photosAttached: 0,
};

export default function ConsultationReportPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-[#FAF7F5] px-4 py-10 text-gray-900 print:bg-white">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">상담 리포트</h1>
        <SampleDataBadge label="샘플 데이터 · 실제 진단 아님" />
      </div>
      <p className="mt-2 text-sm text-gray-600">
        피부과 방문 시 참고용으로 가져갈 수 있는 요약입니다. 이 리포트는
        의학적 진단이 아니며, 스캐폴드 단계라 실제 사용자 데이터가 아닌
        샘플 값으로 채워져 있습니다.
      </p>
      <MyCareNav current="/my/consultation-report" />

      <section className="mt-6 rounded-2xl border border-[#E8DFD8] bg-white p-5 print:border-black">
        <p className="text-xs text-gray-500">생성일: {MOCK_REPORT.generatedAt}</p>

        <div className="mt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            주요 고민
          </h2>
          <p className="mt-1 font-medium">
            {MOCK_REPORT.concerns.join(", ")} (민감도: {MOCK_REPORT.sensitivity})
          </p>
          <p className="text-xs text-gray-500">
            증상 지속 기간: 약 {MOCK_REPORT.durationWeeks}주
          </p>
        </div>

        <div className="mt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            현재 루틴
          </h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {MOCK_REPORT.currentRoutine.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <div className="mt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            알레르기·주의 성분
          </h2>
          <p className="mt-1 text-sm">
            {MOCK_REPORT.allergyIngredients.join(", ") || "등록 없음"}
          </p>
        </div>

        <div className="mt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            위험 신호 점검
          </h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {MOCK_REPORT.redFlags.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <div className="mt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            첨부 사진
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {MOCK_REPORT.photosAttached}장 (사진 비교 동의·저장 연결은 별도
            기능 — 이 리포트 화면에는 아직 미연결)
          </p>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-3 print:hidden">
        <Link
          href="/my/clinics"
          className="inline-flex rounded-lg border border-[#E8DFD8] bg-white px-4 py-2 text-sm font-semibold"
        >
          ← 피부과 추천으로 돌아가기
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex rounded-lg bg-[#C2185B] px-4 py-2 text-sm font-semibold text-white"
        >
          인쇄/저장
        </button>
        <Link
          href="/my"
          className="inline-flex rounded-lg border border-[#E8DFD8] bg-white px-4 py-2 text-sm font-semibold"
        >
          내 케어로 돌아가기 (흐름 끝)
        </Link>
      </div>
    </main>
  );
}
