"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ANALYSIS_RESULT_STORAGE_KEY,
  RECOMMENDATION_STORAGE_KEY,
} from "@/lib/recommend/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function Home() {
  const [hasPrevious, setHasPrevious] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setHasPrevious(
      Boolean(
        localStorage.getItem(ANALYSIS_RESULT_STORAGE_KEY) ||
          localStorage.getItem(RECOMMENDATION_STORAGE_KEY)
      )
    );
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
          내 피부 정보에서 시작하는,
          <br className="hidden sm:block" /> 더 신중한 K-뷰티 선택
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600 sm:mt-6 sm:text-lg sm:leading-8">
          피부 고민과 성분 선호를 정리하고, 확인된 근거와 판매 정보를 바탕으로
          다음 관리 행동을 안내합니다. 진단·치료를 약속하지 않습니다.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/analyze"
            className="touch-target inline-flex items-center justify-center rounded-full bg-[#C2185B] px-6 py-3 text-sm font-semibold text-white sm:text-base"
          >
            피부 분석 시작하기
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
        {hasPrevious ? (
          <Link
            href="/results"
            className="mt-6 block max-w-xl rounded-xl border border-pink-200 bg-white px-4 py-3 text-sm font-medium text-[#C2185B]"
          >
            이전 분석 이어보기 →
          </Link>
        ) : null}
      </section>

      <section className="mx-auto grid max-w-[var(--site-content-max)] gap-4 px-5 pb-14 sm:px-6 md:grid-cols-3">
        {[
          ["1", "피부 정보 정리", "고민·민감도·회피 성분을 짧게 정리합니다."],
          ["2", "성분·근거 확인", "전성분과 공개된 근거를 검토합니다."],
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
          내 피부 관리의 다음 단계를 정해보세요
        </h2>
        <Link
          href="/analyze"
          className="touch-target mt-6 inline-flex items-center justify-center rounded-full bg-[#C2185B] px-6 py-3 font-semibold text-white"
        >
          피부 분석 시작하기
        </Link>
      </section>
    </main>
  );
}
