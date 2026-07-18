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
    const frame = window.requestAnimationFrame(() => {
      setHasPrevious(
        Boolean(
          localStorage.getItem(ANALYSIS_RESULT_STORAGE_KEY) ||
            localStorage.getItem(RECOMMENDATION_STORAGE_KEY)
        )
      );
    });
    try {
      void createSupabaseBrowserClient()
        .auth.getUser()
        .then(({ data }) => setLoggedIn(Boolean(data.user)));
    } catch {
      /* env missing */
    }
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <main className="kb-surface overflow-x-hidden text-gray-900">
      <section className="kb-container pb-12 pt-10 sm:pb-16 sm:pt-14 lg:pt-16">
        <p className="kb-eyebrow">K-Beauty Match</p>
        <h1 className="kb-display mt-4 max-w-3xl text-balance text-[1.85rem] leading-[1.2] sm:text-5xl lg:text-6xl">
          피부·메이크업·헤어를 분석하고
          <br className="hidden min-[380px]:block" />
          한국 제품과 관리 루틴을 맞춰드립니다
        </h1>
        <p className="kb-lead mt-5 max-w-2xl text-base sm:mt-6 sm:text-lg">
          문진과 피부 정보로 고민을 정리한 뒤, 성분·근거·판매처를 확인한
          한국 제품 후보와 3·7·15·30일 관리 흐름을 안내합니다. 의료 진단이나
          치료를 대체하지 않습니다.
        </p>

        <div className="mt-8 flex max-w-xl flex-col gap-3 sm:mt-9">
          <Link href="/analyze" className="kb-btn kb-btn-primary w-full sm:w-auto sm:self-start">
            피부 분석 시작하기
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link href="/quiz/mascara" className="kb-btn kb-btn-secondary">
              메이크업 문진
            </Link>
            <Link href="/quiz/hair" className="kb-btn kb-btn-secondary">
              헤어 문진
            </Link>
          </div>
          {loggedIn ? (
            <Link href="/my" className="kb-btn kb-btn-ghost self-start px-0 sm:px-4">
              내 피부 관리로 이동
            </Link>
          ) : (
            <Link
              href="/signup?next=%2Fonboarding"
              className="text-sm font-medium text-[var(--text-muted)] underline-offset-4 hover:underline"
            >
              계정 만들기 (선택)
            </Link>
          )}
        </div>

        {hasPrevious ? (
          <Link
            href="/results"
            className="mt-6 inline-flex text-sm font-semibold text-[var(--brand)] underline-offset-4 hover:underline"
          >
            이전 분석 이어보기
          </Link>
        ) : null}
      </section>

      <section className="kb-container pb-14 sm:pb-16" aria-labelledby="home-steps">
        <h2 id="home-steps" className="sr-only">
          이용 단계
        </h2>
        <ol className="grid gap-8 border-t border-[var(--border-soft)] pt-10 md:grid-cols-3 md:gap-10">
          {[
            ["01", "짧게 정리", "피부·메이크업·헤어 고민을 문진으로 정리합니다."],
            ["02", "근거 확인", "성분과 공개 근거, 판매처를 함께 검토합니다."],
            ["03", "이어서 관리", "루틴과 3·7·15·30일 체크인으로 사용감을 기록합니다."],
          ].map(([n, title, body]) => (
            <li key={n} className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.2em] text-[var(--brand)]">{n}</p>
              <h3 className="mt-3 text-lg font-semibold text-[#2a1c14]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-[var(--border-soft)] bg-white/70 px-5 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="kb-display text-2xl sm:text-3xl">추천은 이렇게 확인합니다</h2>
          <p className="kb-lead mt-4">
            피부 정보 → 성분 → 공개된 근거 → 판매처·가격·재고 확인 순서로
            검토합니다. 확인이 부족한 제품은 핵심 추천에 넣지 않습니다.
          </p>
          <div className="mt-8 space-y-5 text-sm leading-7 text-[var(--text-muted)]">
            <p>
              3·7·15·30일에 맞춰 원하면 변화와 사용감을 기록할 수 있습니다.
              정상 흐름은 자동으로, 위험 신호만 강조합니다.
            </p>
            <p>
              강한 통증·진물·지속 악화 등은 제품 선택보다 전문가 상담을
              우선 안내합니다. 질환을 진단하지 않습니다.
            </p>
            <p>
              사진과 입력 정보는 분석·저장에 필요한 범위에서만 다루며,{" "}
              <Link href="/privacy" className="underline underline-offset-2">
                개인정보처리방침
              </Link>
              을 따릅니다.
            </p>
          </div>
        </div>
      </section>

      <section className="kb-container py-16 text-center sm:py-20">
        <h2 className="kb-display text-balance text-2xl sm:text-3xl">
          피부 분석부터 시작해 보세요
        </h2>
        <p className="kb-lead mx-auto mt-3 max-w-lg text-sm">
          메이크업·헤어 문진은 분석 후에도 이어갈 수 있습니다.
        </p>
        <Link href="/analyze" className="kb-btn kb-btn-primary mt-7">
          피부 분석 시작하기
        </Link>
      </section>
    </main>
  );
}
