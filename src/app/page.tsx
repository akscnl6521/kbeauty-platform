"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ANALYSIS_RESULT_STORAGE_KEY, RECOMMENDATION_STORAGE_KEY } from "@/lib/recommend/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function Home() {
  const [hasPrevious, setHasPrevious] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    setHasPrevious(Boolean(localStorage.getItem(ANALYSIS_RESULT_STORAGE_KEY) || localStorage.getItem(RECOMMENDATION_STORAGE_KEY)));
    try { void createSupabaseBrowserClient().auth.getUser().then(({ data }) => setLoggedIn(Boolean(data.user))); } catch { /* 환경 변수 미설정 시 비로그인 화면 */ }
  }, []);
  return <main className="bg-[#FAF7F5] text-gray-900">
    <section className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
      <p className="text-sm font-semibold text-[#C2185B]">K-Beauty Match</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">내 피부 정보에서 시작하는, 더 신중한 K-뷰티 선택</h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">피부 고민과 성분 선호를 정리하고, 확인된 근거와 판매 정보를 바탕으로 다음 관리 행동을 안내합니다.</p>
      <div className="mt-8 flex flex-wrap gap-3"><Link href="/analyze" className="rounded-full bg-[#C2185B] px-6 py-3 font-semibold text-white">피부 분석 시작하기</Link>{loggedIn ? <Link href="/my" className="rounded-full border border-[#C2185B] px-6 py-3 font-semibold text-[#C2185B]">내 피부 관리</Link> : null}</div>
      {hasPrevious ? <Link href="/results" className="mt-8 block rounded-xl border border-pink-200 bg-white p-4 text-sm font-medium text-[#C2185B]">이전 분석 이어보기 →</Link> : null}
    </section>
    <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-16 md:grid-cols-3">{[["1","피부 정보 정리"],["2","성분·근거 확인"],["3","내 루틴과 체크인"]].map(([n,text]) => <div key={n} className="rounded-2xl bg-white p-6"><p className="font-semibold text-[#C2185B]">{n}</p><h2 className="mt-3 text-xl font-semibold">{text}</h2></div>)}</section>
    <section className="bg-white px-5 py-16"><div className="mx-auto max-w-4xl space-y-8"><h2 className="text-3xl font-bold">추천은 이렇게 확인합니다</h2><p>피부 정보 → 성분 → 공개된 근거 → 판매처·가격·재고 확인 순서로 검토합니다. 확인이 부족한 제품은 핵심 추천에 포함하지 않습니다.</p><div className="grid gap-4 sm:grid-cols-2"><p className="rounded-xl bg-[#FAF7F5] p-5">3·7·15·30일에 맞춰, 원하면 변화와 사용감을 기록할 수 있습니다.</p><p className="rounded-xl bg-[#FAF7F5] p-5">강한 통증, 진물, 지속 악화 등은 제품 선택보다 전문가 상담을 우선 안내합니다. 진단을 제공하지 않습니다.</p></div><p className="text-sm text-gray-600">사진과 입력 정보는 분석과 저장에 필요한 범위에서만 다루며, 동의 없이 의료적 판단이나 광고 목적에 사용하지 않습니다.</p></div></section>
    <section className="mx-auto max-w-6xl px-5 py-20 text-center"><h2 className="text-3xl font-bold">내 피부 관리의 다음 단계를 정해보세요</h2><Link href="/analyze" className="mt-6 inline-block rounded-full bg-[#C2185B] px-6 py-3 font-semibold text-white">피부 분석 시작하기</Link></section>
  </main>;
}