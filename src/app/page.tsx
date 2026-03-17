"use client";

import Head from "next/head";
import Link from "next/link";
import { useLocale } from "@/hooks/useLocale";

export default function Home() {
  const { messages, locale, setLocale } = useLocale();

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <Head>
        <title>
          KBEAUTY GUIDE - Personalized Korean Skincare Recommendations
        </title>
        <meta
          name="description"
          content="Find your perfect K-beauty match based on skin tone, age, concerns and budget. Science-backed ingredient information included."
        />
      </Head>
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="text-lg font-semibold tracking-[0.2em] text-[#C2185B]">
            KBEAUTY GUIDE
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={`rounded-full px-3 py-1 transition ${
                locale === "en"
                  ? "bg-[#C2185B] text-white"
                  : "border border-pink-200 text-gray-700 hover:bg-pink-50"
              }`}
            >
              🇺🇸
            </button>
            <button
              type="button"
              onClick={() => setLocale("ja")}
              className={`rounded-full px-3 py-1 transition ${
                locale === "ja"
                  ? "bg-[#C2185B] text-white"
                  : "border border-pink-200 text-gray-700 hover:bg-pink-50"
              }`}
            >
              🇯🇵
            </button>
            <button
              type="button"
              onClick={() => setLocale("ko")}
              className={`rounded-full px-3 py-1 transition ${
                locale === "ko"
                  ? "bg-[#C2185B] text-white"
                  : "border border-pink-200 text-gray-700 hover:bg-pink-50"
              }`}
            >
              🇰🇷
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <section className="mt-20 flex flex-1 flex-col items-start justify-center gap-8 md:mt-28 md:flex-row md:items-center md:gap-16">
          <div className="max-w-xl space-y-6">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-[#C2185B]">
              {messages.platform_tag}
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              {messages.find_match}
            </h1>
            <p className="text-base leading-relaxed text-gray-600 md:text-lg">
              {messages.subtitle}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/quiz">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full bg-[#C2185B] px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-[#C2185B33] transition hover:bg-[#a3154f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  {messages.start_button}
                </button>
              </Link>
              <Link href="/analyze">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-pink-200 px-6 py-3 text-sm font-semibold text-[#C2185B] transition hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  {locale === "ko"
                    ? "AI 피부 분석"
                    : locale === "ja"
                      ? "AI肌分析"
                      : "AI Skin Analysis"}
                </button>
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
              <span className="rounded-full bg-pink-50 px-4 py-1 text-[#C2185B]">
                {messages.badge_skin_tone}
              </span>
              <span className="rounded-full bg-pink-50 px-4 py-1 text-[#C2185B]">
                {messages.badge_budget}
              </span>
            </div>
          </div>

          {/* Right side simple visual placeholder */}
          <div className="mt-10 w-full max-w-sm md:mt-0">
            <div className="relative rounded-3xl border border-pink-100 bg-pink-50/60 p-6">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-[#C2185B]">
                {messages.preview_title}
              </div>
              <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{messages.skin_type}</span>
                  <span className="rounded-full bg-pink-50 px-3 py-1 text-[11px] font-medium text-[#C2185B]">
                    {messages.preview_skin_example}
                  </span>
                </div>
                <div className="h-px bg-pink-100" />
                <div className="space-y-2 text-xs text-gray-600">
                  <p className="font-semibold text-gray-900">{messages.preview_routine_title}</p>
                  <ul className="list-inside list-disc space-y-1">
                    <li>{messages.preview_step_1}</li>
                    <li>{messages.preview_step_2}</li>
                    <li>{messages.preview_step_3}</li>
                    <li>{messages.preview_step_4}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer note */}
        <footer className="mt-16 border-t border-gray-100 pt-6 text-xs text-gray-400">
          <div className="flex flex-col items-start justify-between gap-2 text-xs text-gray-400 sm:flex-row sm:items-center">
            <span>{messages.footer_powered}</span>
            <div className="flex gap-4">
              <Link
                href="/privacy"
                className="text-xs text-gray-400 underline hover:text-[#C2185B]"
              >
                {messages.privacy_policy}
              </Link>
              <Link
                href="/terms"
                className="text-xs text-gray-400 underline hover:text-[#C2185B]"
              >
                {messages.terms_of_service}
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
