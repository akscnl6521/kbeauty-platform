"use client";

import Head from "next/head";
import Link from "next/link";
import { useLocale } from "@/hooks/useLocale";

export default function Home() {
  const { messages, locale, setLocale } = useLocale();

  const headline =
    locale === "ko"
      ? "내 피부에 맞는 K-뷰티를 더 쉽게 이해하세요"
      : messages.find_match;
  const subcopy =
    locale === "ko"
      ? "피부톤, 고민, 성분, 예산을 기준으로 K-뷰티 정보를 정리해드립니다"
      : messages.subtitle;

  const platformTag =
    locale === "ko"
      ? "K-뷰티 디스커버리 플랫폼"
      : locale === "ja"
        ? "K-ビューティー発見プラットフォーム"
        : "K-Beauty Discovery Platform";

  return (
    <div className="relative text-[#1A1A1A]" style={{ backgroundColor: "#F0EBE0" }}>

      {/* 배경 이미지: 잘리지 않고 전체 표시 */}
      <img
        src="/hero-bg.png"
        alt=""
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "auto",
          zIndex: 0,
          pointerEvents: "none",
          display: "block",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <Head>
          <title>KBEAUTY GUIDE - Personalized Korean Skincare Recommendations</title>
          <meta name="description" content="Find your perfect K-beauty match based on skin tone, age, concerns and budget." />
        </Head>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">

          {/* Header */}
          <header className="flex items-center justify-between">
            <div className="font-['Playfair_Display',serif] text-lg font-semibold tracking-tight sm:text-xl lg:text-2xl">
              KBEAUTY GUIDE
            </div>
            <div className="flex items-center gap-3 text-xs sm:gap-4 sm:text-sm">
              {(["en", "ja", "ko"] as const).map((l) => (
                <button key={l} type="button" onClick={() => setLocale(l)}
                  className={`uppercase transition ${locale === l ? "text-[#C2185B]" : "text-gray-500 hover:text-[#1A1A1A]"}`}>
                  {l}
                </button>
              ))}
            </div>
          </header>

          {/* Hero */}
          <section className="relative mt-8 sm:mt-12 lg:mt-16">

            {/* 핑크 블러 */}
            <div
              className="pointer-events-none absolute -left-4 top-8 h-48 w-48 rounded-full blur-3xl sm:h-64 sm:w-64 lg:h-80 lg:w-80"
              style={{ background: "rgba(194,24,91,0.15)" }}
            />

            {/* 2컬럼: 모바일=1컬럼, 태블릿/데스크탑=2컬럼 */}
            <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-10 lg:gap-12">

              {/* 왼쪽 텍스트 */}
              <div className="relative z-10 space-y-4 sm:space-y-5 lg:space-y-6">
                <div className="inline-flex rounded-full border border-pink-200/80 bg-white/40 px-3 py-1.5 text-xs font-semibold tracking-[0.15em] text-[#C2185B] sm:px-4 sm:py-2 sm:tracking-[0.2em]">
                  {platformTag}
                </div>

                <h1 className="font-['Playfair_Display',serif] text-3xl font-bold leading-[1.2] sm:text-4xl lg:text-5xl">
                  {headline}
                </h1>

                <p className="text-sm font-light text-gray-600 sm:text-base lg:text-lg">
                  {subcopy}
                </p>

                {/* 버튼 그리드 */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-2">
                  <Link href="/quiz">
                    <button type="button" className="w-full rounded-xl bg-[#C2185B] px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:brightness-95 sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm">
                      가이드 시작하기
                    </button>
                  </Link>
                  <Link href="/analyze">
                    <button type="button" className="w-full rounded-xl border border-[#C2185B] bg-white/60 px-4 py-2.5 text-xs font-semibold text-[#C2185B] transition hover:bg-white/80 sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm">
                      AI 피부 분석 시작
                    </button>
                  </Link>
                  <Link href="/face-explorer">
                    <button type="button" className="w-full rounded-xl border border-gray-300 bg-white/60 px-4 py-2.5 text-xs font-semibold text-gray-700 transition hover:bg-white/80 sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm">
                      얼굴로 탐색하기
                    </button>
                  </Link>
                  <Link href="/ingredients">
                    <button type="button" className="w-full rounded-xl border border-[#C2185B] bg-white/60 px-4 py-2.5 text-xs font-semibold text-[#C2185B] transition hover:bg-white/80 sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm">
                      성분별로 보기
                    </button>
                  </Link>
                </div>
              </div>

              {/* 오른쪽 가이드 카드 */}
              <div className="relative z-10">
                <div className="rounded-2xl border border-white/60 bg-white/80 p-5 shadow-lg backdrop-blur-sm sm:rounded-3xl sm:p-6 lg:p-8">
                  <p className="mb-4 text-xs font-medium uppercase tracking-[0.3em] text-gray-400 sm:mb-6">
                    AI GUIDE PREVIEW
                  </p>
                  <div className="space-y-4 sm:space-y-5">
                    {[
                      { n: "01", t: locale === "ko" ? "피부 타입 추정" : messages.preview_step_1 },
                      { n: "02", t: locale === "ko" ? "주요 고민 정리" : messages.preview_step_2 },
                      { n: "03", t: locale === "ko" ? "추천 성분 제안" : messages.preview_step_3 },
                      { n: "04", t: locale === "ko" ? "루틴 가이드 안내" : messages.preview_step_4 },
                    ].map((row) => (
                      <div key={row.n} className="flex items-start gap-3 sm:gap-4">
                        <div className="w-8 text-xs font-semibold text-[#B8860B] sm:w-10 sm:text-sm">{row.n}</div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-800 sm:text-sm">{row.t}</p>
                          <div className="mt-3 w-full border-t border-black/10 sm:mt-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* Stats - 배경 하단 제품 아래에 자연스럽게 위치 */}
          <section className="mt-12 grid grid-cols-3 gap-3 sm:mt-16 sm:gap-4 lg:mt-20 lg:gap-6">
            {[
              { v: "186+", l: locale === "ko" ? "정리된 제품 정보" : "Products" },
              { v: "38", l: locale === "ko" ? "핵심 성분 가이드" : "Ingredients" },
              { v: "3", l: locale === "ko" ? "언어 지원" : "Languages" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl bg-white/80 p-4 backdrop-blur-sm sm:rounded-2xl sm:p-5 lg:p-6">
                <p className="font-['Playfair_Display',serif] text-xl font-bold sm:text-2xl lg:text-3xl">{s.v}</p>
                <p className="mt-1 text-xs text-gray-500 sm:mt-2 sm:text-sm">{s.l}</p>
              </div>
            ))}
          </section>

          {/* Footer */}
          <footer className="mt-10 border-t border-black/5 pt-6 text-xs text-gray-500 sm:mt-14 sm:pt-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {locale === "ko" ? "K-뷰티 성분, 루틴, 실제 사용자 데이터 기반"
                  : locale === "ja" ? "成分・ルーティン・ユーザーデータに基づくK-ビューティーガイド"
                  : "K-beauty ingredients, routines, and real user data"}
              </span>
              <div className="flex gap-4">
                <Link href="/privacy" className="hover:text-gray-600">{messages.privacy_policy}</Link>
                <Link href="/terms" className="hover:text-gray-600">{messages.terms_of_service}</Link>
              </div>
            </div>
          </footer>

        </main>
      </div>
    </div>
  );
}