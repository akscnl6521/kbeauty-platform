"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ANALYSIS_RESULT_STORAGE_KEY,
  RANKED_PRODUCTS_STORAGE_KEY,
  RECOMMENDATION_STORAGE_KEY,
} from "@/lib/recommend/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function Home() {
  const [hasPrevious, setHasPrevious] = useState(false);
  const [hasRanked, setHasRanked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setHasPrevious(
      Boolean(
        localStorage.getItem(ANALYSIS_RESULT_STORAGE_KEY) ||
          localStorage.getItem(RECOMMENDATION_STORAGE_KEY)
      )
    );
    try {
      const raw = localStorage.getItem(RANKED_PRODUCTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setHasRanked(Array.isArray(parsed) && parsed.length > 0);
      }
    } catch {
      setHasRanked(false);
    }
    try {
      void createSupabaseBrowserClient()
        .auth.getUser()
        .then(({ data }) => setLoggedIn(Boolean(data.user)));
    } catch {
      /* env missing */
    }
  }, []);

  return (
    <main className="bg-[#FAF7F5] text-gray-900">
      <section className="mx-auto max-w-[var(--site-content-max)] px-5 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-14 lg:pt-16">
        <p className="text-sm font-semibold tracking-wide text-[#C2185B]">
          K-Beauty Match
        </p>
        <h1 className="mt-4 max-w-3xl text-balance text-3xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
          피부·메이크업·헤어까지,
          <br className="hidden sm:block" /> 한곳에서 맞추는 K-뷰티
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600 sm:mt-6 sm:text-lg sm:leading-8">
          사진과 문진으로 피부 상태를 정리하고, 스킨케어·메이크업·헤어·두피까지
          한국 제품 후보를 근거와 함께 안내합니다. 의료 진단·치료를 대체하지
          않습니다.
        </p>
        <div className="mt-8 space-y-5">
          <div className="flex flex-wrap gap-3">
            <Link
              href="/analyze"
              className="touch-target inline-flex items-center justify-center rounded-full bg-[#C2185B] px-6 py-3 text-sm font-semibold text-white sm:text-base"
            >
              분석 시작하기
            </Link>
            <Link
              href="/quiz"
              className="touch-target inline-flex items-center justify-center rounded-full border border-[#C2185B] bg-white px-6 py-3 text-sm font-semibold text-[#C2185B] sm:text-base"
            >
              피부 문진
            </Link>
            <Link
              href="/face-explorer"
              className="touch-target inline-flex items-center justify-center rounded-full border border-[#E8DFD8] bg-white px-6 py-3 text-sm font-semibold text-gray-800 sm:text-base"
            >
              페이스 탐색
            </Link>
            {loggedIn ? (
              <Link
                href="/my"
                className="touch-target inline-flex items-center justify-center rounded-full border border-[#C2185B] px-6 py-3 text-sm font-semibold text-[#C2185B] sm:text-base"
              >
                내 피부 관리
              </Link>
            ) : (
              <Link
                href="/signup?next=%2Fonboarding"
                className="touch-target inline-flex items-center justify-center rounded-full border border-[#E8DFD8] bg-white px-6 py-3 text-sm font-semibold text-gray-800 sm:text-base"
              >
                계정 만들기
              </Link>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-gray-500">
              메이크업 · 헤어 문진
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href="/quiz/mascara"
                className="touch-target inline-flex items-center justify-center rounded-full border border-[#E8DFD8] bg-white px-4 py-2 text-sm font-medium text-gray-800"
              >
                마스카라
              </Link>
              <Link
                href="/quiz/base"
                className="touch-target inline-flex items-center justify-center rounded-full border border-[#E8DFD8] bg-white px-4 py-2 text-sm font-medium text-gray-800"
              >
                베이스
              </Link>
              <Link
                href="/quiz/lip"
                className="touch-target inline-flex items-center justify-center rounded-full border border-[#E8DFD8] bg-white px-4 py-2 text-sm font-medium text-gray-800"
              >
                립
              </Link>
              <Link
                href="/quiz/hair"
                className="touch-target inline-flex items-center justify-center rounded-full border border-[#E8DFD8] bg-white px-4 py-2 text-sm font-medium text-gray-800"
              >
                헤어·두피
              </Link>
            </div>
          </div>
        </div>
        {hasPrevious ? (
          <div className="mt-6 flex max-w-xl flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link
              href="/results"
              className="inline-flex flex-1 items-center justify-between rounded-xl border border-pink-200 bg-white px-4 py-3 text-sm font-medium text-[#C2185B]"
            >
              이전 분석·추천 이어보기
              <span aria-hidden>→</span>
            </Link>
            {hasRanked ? (
              <Link
                href="/routine"
                className="inline-flex flex-1 items-center justify-between rounded-xl border border-[#E8DFD8] bg-white px-4 py-3 text-sm font-medium text-gray-800"
              >
                추천으로 루틴 보기
                <span aria-hidden>→</span>
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="mx-auto grid max-w-[var(--site-content-max)] gap-4 px-5 pb-14 sm:px-6 md:grid-cols-3">
        {[
          ["1", "피부·메이크업·헤어 정리", "고민·톤·두피·선호를 짧게 정리합니다."],
          ["2", "성분·속성·근거", "전성분과 제품 속성, 공개 근거를 검토합니다."],
          ["3", "루틴과 체크인", "3·7·15·30일로 사용감을 기록합니다."],
        ].map(([n, title, body]) => (
          <div
            key={n}
            className="flex min-h-[9.5rem] flex-col rounded-2xl border border-[#E8DFD8] bg-white p-6"
          >
            <p className="text-sm font-semibold text-[#C2185B]">{n}</p>
            <h2 className="mt-2 text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">{body}</p>
          </div>
        ))}
      </section>

      <section className="bg-white px-5 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-4xl space-y-6">
          <h2 className="text-2xl font-bold sm:text-3xl">
            추천은 이렇게 확인합니다
          </h2>
          <p className="leading-7 text-gray-700">
            피부 정보 → 성분 → 공개된 근거 → 판매처·가격·재고 확인 순서로
            검토합니다. 확인이 부족한 제품은 핵심 추천에 넣지 않습니다.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <p className="rounded-xl bg-[#FAF7F5] p-5 text-sm leading-6 text-gray-700">
              3·7·15·30일에 맞춰 원하면 변화와 사용감을 기록할 수 있습니다.
              정상 흐름은 자동으로, 위험 신호만 강조합니다.
            </p>
            <p className="rounded-xl bg-[#FAF7F5] p-5 text-sm leading-6 text-gray-700">
              강한 통증·진물·지속 악화 등은 제품 선택보다 전문가 상담을
              우선 안내합니다. 질환을 진단하지 않습니다.
            </p>
          </div>
          <p className="text-sm leading-6 text-gray-600">
            사진과 입력 정보는 분석·저장에 필요한 범위에서만 다루며,{" "}
            <Link href="/privacy" className="underline">
              개인정보처리방침
            </Link>
            을 따릅니다.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[var(--site-content-max)] px-5 py-16 text-center sm:px-6 sm:py-20">
        <h2 className="text-2xl font-bold sm:text-3xl">
          {hasPrevious
            ? "이어서 결과와 루틴을 확인해 보세요"
            : "내 피부 관리의 다음 단계를 정해보세요"}
        </h2>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {hasPrevious ? (
            <>
              <Link
                href="/results"
                className="touch-target inline-flex items-center justify-center rounded-full bg-[#C2185B] px-6 py-3 font-semibold text-white"
              >
                추천 결과 보기
              </Link>
              {hasRanked ? (
                <Link
                  href="/routine"
                  className="touch-target inline-flex items-center justify-center rounded-full border border-[#C2185B] bg-white px-6 py-3 font-semibold text-[#C2185B]"
                >
                  루틴으로 정리하기
                </Link>
              ) : (
                <Link
                  href="/quiz"
                  className="touch-target inline-flex items-center justify-center rounded-full border border-[#E8DFD8] bg-white px-6 py-3 font-semibold text-gray-800"
                >
                  피부 문진 다시하기
                </Link>
              )}
            </>
          ) : (
            <>
              <Link
                href="/analyze"
                className="touch-target inline-flex items-center justify-center rounded-full bg-[#C2185B] px-6 py-3 font-semibold text-white"
              >
                피부 분석 시작하기
              </Link>
              <Link
                href="/quiz"
                className="touch-target inline-flex items-center justify-center rounded-full border border-[#E8DFD8] bg-white px-6 py-3 font-semibold text-gray-800"
              >
                짧은 피부 문진
              </Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
