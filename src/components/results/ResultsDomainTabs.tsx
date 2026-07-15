"use client";

import { useMemo, useState } from "react";
import { DomainQuizRecommendPanel } from "@/components/results/DomainQuizRecommendPanel";

export type ResultsDomainTab =
  | "analysis"
  | "skincare"
  | "makeup"
  | "hair"
  | "routine"
  | "cautions";

const TABS: Array<{ id: ResultsDomainTab; label: string }> = [
  { id: "analysis", label: "피부 분석" },
  { id: "skincare", label: "스킨케어" },
  { id: "makeup", label: "메이크업" },
  { id: "hair", label: "헤어·두피" },
  { id: "routine", label: "루틴" },
  { id: "cautions", label: "주의사항" },
];

/**
 * Domain section navigator for full-beauty results.
 * Keeps one job per tab; does not invent product rankings when data is absent.
 */
export function ResultsDomainTabs({
  skinTone,
  undertone,
  hasSkincare,
  mascaraHints,
  lipHints,
  scalpHints,
  morningSteps,
  eveningSteps,
  cautions,
}: {
  skinTone?: string;
  undertone?: string;
  hasSkincare: boolean;
  mascaraHints: string[];
  lipHints: string[];
  scalpHints: string[];
  morningSteps: string[];
  eveningSteps: string[];
  cautions: string[];
}) {
  const [tab, setTab] = useState<ResultsDomainTab>("analysis");

  const analysisCopy = useMemo(() => {
    const parts = [
      skinTone ? `피부톤 참고: ${skinTone}` : null,
      undertone ? `언더톤 참고: ${undertone}` : null,
      "사진·문진으로 확정되지 않은 항목은 단정하지 않습니다.",
    ].filter(Boolean);
    return parts.join(" · ");
  }, [skinTone, undertone]);

  return (
    <div className="mb-8">
      <div
        className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="결과 영역"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-[#8B4513] text-white"
                : "bg-white text-gray-700 ring-1 ring-[#E8DFD8]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        className="mt-4 rounded-2xl border border-[#E8DFD8] bg-white/90 p-4 text-sm leading-relaxed text-gray-800 sm:p-5"
        role="tabpanel"
      >
        {tab === "analysis" ? (
          <p>{analysisCopy}</p>
        ) : null}
        {tab === "skincare" ? (
          <p>
            {hasSkincare
              ? "아래 핵심 추천은 검수된 한국 verified offer 제품만 포함합니다. 미검수·discovery 후보는 노출되지 않습니다."
              : "스킨케어 추천 데이터가 아직 없습니다. 분석을 다시 실행해 주세요."}
          </p>
        ) : null}
        {tab === "makeup" ? (
          <div className="space-y-3">
            <p className="text-gray-600">
              메이크업은 피부톤·언더톤·속성 매칭을 우선합니다. 논문 근거가 없는
              표현은 사실처럼 단정하지 않습니다.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <a className="rounded-full border border-[#E8DFD8] px-3 py-1.5" href="/quiz/mascara">마스카라 문진</a>
              <a className="rounded-full border border-[#E8DFD8] px-3 py-1.5" href="/quiz/lip">립 문진</a>
              <a className="rounded-full border border-[#E8DFD8] px-3 py-1.5" href="/quiz/base">베이스 문진</a>
            </div>
            <div>
              <p className="font-semibold text-gray-900">마스카라 힌트</p>
              <ul className="mt-1 list-disc pl-5">
                {(mascaraHints.length ? mascaraHints : ["문진에서 속눈썹·번짐·워터프루프 선호를 보완하세요."]).map(
                  (h) => (
                    <li key={h}>{h}</li>
                  )
                )}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900">립 힌트</p>
              <ul className="mt-1 list-disc pl-5">
                {(lipHints.length ? lipHints : ["입술 톤·매트/글로시·착색 선호를 문진으로 보완하세요."]).map(
                  (h) => (
                    <li key={h}>{h}</li>
                  )
                )}
              </ul>
            </div>
            <p className="rounded-xl bg-[#F7F1EC] px-3 py-2 text-xs text-gray-600">
              공식 PDP가 확인되고 recommendable인 Staging 후보만 이후 공개 추천
              검토 대상입니다. 플레이스홀더는 노출되지 않습니다.
            </p>
            <DomainQuizRecommendPanel />
          </div>
        ) : null}
        {tab === "hair" ? (
          <div>
            <p className="text-gray-600">
              두피·모발 추천은 스킨케어 랭킹과 분리된 도메인에서만 매칭합니다.
            </p>
            <a
              className="mt-2 inline-flex rounded-full border border-[#E8DFD8] px-3 py-1.5 text-xs"
              href="/quiz/hair"
            >
              샴푸·두피 문진
            </a>
            <ul className="mt-2 list-disc pl-5">
              {(scalpHints.length
                ? scalpHints
                : ["두피 타입(건성/지성/민감)·비듬·손상·열 손상 문진을 보완하세요."]
              ).map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <DomainQuizRecommendPanel />
          </div>
        ) : null}
        {tab === "routine" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="font-semibold">아침</p>
              <ol className="mt-1 list-decimal pl-5">
                {(morningSteps.length ? morningSteps : ["세안 → 보습 → 선케어"]).map(
                  (s) => (
                    <li key={s}>{s}</li>
                  )
                )}
              </ol>
            </div>
            <div>
              <p className="font-semibold">저녁</p>
              <ol className="mt-1 list-decimal pl-5">
                {(eveningSteps.length ? eveningSteps : ["세안 → 진정/보습 → 필요 시 활성 성분"]).map(
                  (s) => (
                    <li key={s}>{s}</li>
                  )
                )}
              </ol>
            </div>
          </div>
        ) : null}
        {tab === "cautions" ? (
          <ul className="list-disc space-y-1 pl-5">
            {(cautions.length
              ? cautions
              : [
                  "의료 진단이 아니며 치료를 대체하지 않습니다.",
                  "자극·알레르기 반응이 있으면 사용을 중단하고 전문가와 상담하세요.",
                ]
            ).map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
