"use client";

import Head from "next/head";
import Link from "next/link";
import { useLocale } from "@/hooks/useLocale";

export default function Home() {
  const { messages, locale, setLocale } = useLocale();

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A]">
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
          <div className="font-['Playfair_Display',serif] text-2xl italic tracking-tight text-[#1A1A1A]">
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
        <section className="relative mt-16 grid flex-1 items-center gap-10 md:mt-20 md:grid-cols-2">
          {/* left pink blur */}
          <div className="pointer-events-none absolute -left-24 top-10 h-96 w-96 rounded-full bg-pink-100 blur-3xl opacity-50" />

          <div className="relative z-10 max-w-xl space-y-6">
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-[#C2185B]">
              {messages.platform_tag}
            </p>
            <h1 className="font-['Playfair_Display',serif] text-5xl font-bold leading-tight md:text-6xl">
              {messages.find_match}
            </h1>
            <p className="text-lg font-light text-gray-500">
              {messages.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/quiz">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full bg-[#C2185B] px-8 py-3 text-sm font-medium text-white shadow-lg shadow-[#C2185B33] transition-transform hover:scale-105"
                >
                  {messages.start_button}
                </button>
              </Link>
              <Link href="/analyze">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-[#C2185B] bg-transparent px-7 py-3 text-sm font-medium text-[#C2185B] transition-transform hover:scale-105"
                >
                  {locale === "ko"
                    ? "AI 피부 분석"
                    : locale === "ja"
                      ? "AI肌分析"
                      : "AI Skin Analysis"}
                </button>
              </Link>
            </div>
          </div>

          {/* Right preview card */}
          <div className="relative z-10">
            <div className="rounded-3xl bg-white p-8 shadow-[0_18px_50px_rgba(0,0,0,0.10)]">
              <p className="mb-6 text-xs font-medium uppercase tracking-[0.35em] text-gray-400">
                Skincare Routine Preview
              </p>

              <div className="space-y-5">
                {[
                  { n: "01", t: messages.preview_step_1 },
                  { n: "02", t: messages.preview_step_2 },
                  { n: "03", t: messages.preview_step_3 },
                  { n: "04", t: messages.preview_step_4 },
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
        <section className="mt-14 grid gap-6 border-t border-gray-100 pt-10 md:grid-cols-3">
          {[
            { v: "186+", l: "Products" },
            { v: "38", l: "Ingredients" },
            { v: "3", l: "Languages" },
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
        <footer className="mt-14 border-t border-gray-100 pt-8 text-xs text-gray-400">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <span>{messages.footer_powered}</span>
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
