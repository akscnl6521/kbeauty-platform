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

  const ingredientCta =
    locale === "ko"
      ? "성분별로 보기"
      : locale === "ja"
        ? "成分で探す"
        : "Explore Ingredients";

  return (
    <div
      className="min-h-screen text-[#1A1A1A]"
      style={{
        backgroundImage: "url('/hero-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
      }}
    >
      <Head>
        <title>
          KBEAUTY GUIDE - Personalized Korean Skincare Recommendations
        </title>
        <meta
          name="description"
          content="Find your perfect K-beauty match based on skin tone, age, concerns and budget. Science-backed ingredient information included."
        />
      </Head>

      <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="font-['Playfair_Display',serif] text-2xl font-semibold tracking-tight text-[#1A1A1A]">
            KBEAUTY GUIDE
          </div>

          <div className="flex items-center gap-4 text-sm">
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={`transition ${
                locale === "en"
                  ? "text-[#C2185B]"
                  : "text-gray-500 hover:text-[#1A1A1A]"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLocale("ja")}
              className={`transition ${
                locale === "ja"
                  ? "text-[#C2185B]"
                  : "text-gray-500 hover:text-[#1A1A1A]"
              }`}
            >
              JA
            </button>
            <button
              type="button"
              onClick={() => setLocale("ko")}
              className={`transition ${
                locale === "ko"
                  ? "text-[#C2185B]"
                  : "text-gray-500 hover:text-[#1A1A1A]"
              }`}
            >
              KO
            </button>
          </div>
        </header>

        {/* Hero */}
        <section className="relative mt-14 grid flex-1 items-center gap-10 md:mt-16 md:grid-cols-2">
          <div className="pointer-events-none absolute -left-28 top-14 h-80 w-80 rounded-full bg-pink-200/40 blur-3xl" />

          <div className="relative z-10 max-w-xl space-y-6">
            <div className="inline-flex rounded-full bg-pink-100/70 px-4 py-2 text-xs font-semibold tracking-[0.2em] text-[#C2185B]">
              {platformTag}
            </div>
            <h1 className="font-['Playfair_Display',serif] text-5xl font-bold leading-tight md:text-6xl">
              {headline}
            </h1>
            <p className="text-lg font-light text-gray-500">
              {subcopy}
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4">
              <Link href="/quiz" className="block">
                <button
                  type="button"
                  className="w-full rounded-2xl bg-[#C2185B] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#C2185B33] transition hover:brightness-95"
                >
                  {locale === "ko" ? "가이드 시작하기" : messages.start_button}
                </button>
              </Link>
              <Link href="/analyze" className="block">
                <button
                  type="button"
                  className="w-full rounded-2xl border border-[#C2185B] bg-transparent px-5 py-3 text-sm font-semibold text-[#C2185B] transition hover:bg-pink-50/60"
                >
                  {locale === "ko"
                    ? "AI 피부 분석 시작"
                    : locale === "ja"
                      ? "AI肌分析"
                      : "AI Skin Analysis"}
                </button>
              </Link>
              <Link href="/face-explorer" className="block">
                <button
                  type="button"
                  className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-gray-800 shadow-sm ring-1 ring-white/60 transition hover:bg-white/80"
                >
                  {locale === "ko"
                    ? "얼굴로 탐색하기"
                    : locale === "ja"
                      ? "顔で探す"
                      : "Explore by Face"}
                </button>
              </Link>
              <Link href="/ingredients" className="block">
                <button
                  type="button"
                  className="w-full rounded-2xl border border-[#C2185B] bg-transparent px-5 py-3 text-sm font-semibold text-[#C2185B] transition hover:bg-pink-50/60"
                >
                  {ingredientCta}
                </button>
              </Link>
            </div>
          </div>

          {/* Right preview card */}
          <div className="relative z-10">
            <div className="rounded-3xl bg-white p-8 shadow-[0_18px_50px_rgba(0,0,0,0.10)]">
              <p className="mb-6 text-xs font-medium uppercase tracking-[0.35em] text-gray-400">
                AI GUIDE PREVIEW
              </p>

              <div className="space-y-5">
                {[
                  { n: "01", t: locale === "ko" ? "피부 타입 추정" : messages.preview_step_1 },
                  { n: "02", t: locale === "ko" ? "주요 고민 정리" : messages.preview_step_2 },
                  { n: "03", t: locale === "ko" ? "추천 성분 제안" : messages.preview_step_3 },
                  { n: "04", t: locale === "ko" ? "루틴 가이드 안내" : messages.preview_step_4 },
                ].map((row) => (
                  <div key={row.n} className="flex items-start gap-4">
                    <div className="w-10 text-sm font-semibold text-[#B8860B]">
                      {row.n}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-800">{row.t}</p>
                      <div className="mt-4 h-px w-full bg-gray-100" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mt-14 grid gap-6 border-t border-black/5 pt-10 md:grid-cols-3">
          {[
            { v: "186+", l: locale === "ko" ? "정리된 제품 정보" : "Products" },
            { v: "38", l: locale === "ko" ? "핵심 성분 가이드" : "Ingredients" },
            { v: "3", l: locale === "ko" ? "언어 지원" : "Languages" },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded-3xl bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.06)]"
            >
              <p className="font-['Playfair_Display',serif] text-3xl font-bold">
                {s.v}
              </p>
              <p className="mt-2 text-sm text-gray-500">{s.l}</p>
            </div>
          ))}
        </section>

        {/* Footer */}
        <footer className="mt-14 border-t border-black/5 pt-8 text-xs text-gray-500">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <span>
              {locale === "ko"
                ? "K-뷰티 성분, 루틴, 실제 사용자 데이터 기반"
                : locale === "ja"
                  ? "成分・ルーティン・ユーザーデータに基づくK-ビューティーガイド"
                  : "K-beauty ingredients, routines, and real user data"}
            </span>
            <div className="flex gap-4">
              <Link href="/privacy" className="hover:text-gray-600">
                {messages.privacy_policy}
              </Link>
              <Link href="/terms" className="hover:text-gray-600">
                {messages.terms_of_service}
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
