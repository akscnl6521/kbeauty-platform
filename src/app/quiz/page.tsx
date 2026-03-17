"use client";

import Head from "next/head";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/hooks/useLocale";

type StepKey = "age" | "tone" | "undertone" | "concern" | "budget";

const OPTION_LABELS_KO: Record<string, string> = {
  "10s": "10대",
  "20s": "20대",
  "30s": "30대",
  "40s+": "40대 이상",
  Light: "밝은",
  Medium: "중간",
  Dark: "어두운",
  Warm: "웜톤",
  Cool: "쿨톤",
  Neutral: "중립",
  Redness: "붉은기",
  Dryness: "건조함",
  Acne: "여드름",
  Dullness: "칙칙함",
  "Anti-aging": "노화 방지",
  "Budget ($0-20)": "저가 ($0-20)",
  "Mid-range ($20-50)": "중가 ($20-50)",
  "Premium ($50+)": "프리미엄 ($50+)",
};

function optionLabel(value: string, locale: string): string {
  return locale === "ko" ? OPTION_LABELS_KO[value] ?? value : value;
}

export default function QuizPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<StepKey, string>>>({});
  const { messages, locale, setLocale } = useLocale();

  const totalSteps = 4;

  const budgetToParam = (raw: string): string => {
    if (raw === "Budget ($0-20)") return "low";
    if (raw === "Mid-range ($20-50)") return "mid";
    if (raw === "Premium ($50+)") return "premium";
    return "mid";
  };

  const handleSelect = (key: StepKey, value: string, isLastStep: boolean) => {
    const nextAnswers = { ...answers, [key]: value };
    setAnswers(nextAnswers);

    if (isLastStep) {
      const params = new URLSearchParams();
      if (nextAnswers.age) params.set("age", nextAnswers.age);
      if (nextAnswers.tone) params.set("tone", nextAnswers.tone);
      if (nextAnswers.undertone) params.set("warmth", nextAnswers.undertone);
      if (nextAnswers.concern) params.set("concern", nextAnswers.concern);
      if (nextAnswers.budget)
        params.set("budget", budgetToParam(nextAnswers.budget));
      router.push(`/results?${params.toString()}`);
    } else {
      setStep((prev) => Math.min(prev + 1, totalSteps - 1));
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">
              {messages.find_match}
            </h2>
            <p className="text-base text-gray-600">{messages.age_question}</p>
            <div className="flex flex-wrap gap-3">
              {["10s", "20s", "30s", "40s+"].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleSelect("age", value, false)}
                  className="rounded-full border border-pink-100 px-5 py-2 text-sm font-medium text-gray-800 transition hover:border-[#C2185B] hover:bg-pink-50"
                >
                  {optionLabel(value, locale)}
                </button>
              ))}
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">
              {messages.find_match}
            </h2>
            <p className="text-base text-gray-600">{messages.tone_question}</p>
            <div className="flex flex-wrap gap-3">
              {["Light", "Medium", "Dark"].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleSelect("tone", value, false)}
                  className="rounded-full border border-pink-100 px-5 py-2 text-sm font-medium text-gray-800 transition hover:border-[#C2185B] hover:bg-pink-50"
                >
                  {optionLabel(value, locale)}
                </button>
              ))}
            </div>
            <div className="pt-2">
              <p className="mb-3 text-sm text-gray-600">And your undertone?</p>
              <div className="flex flex-wrap gap-3">
                {["Warm", "Cool", "Neutral"].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleSelect("undertone", value, false)}
                    className="rounded-full border border-pink-100 px-5 py-2 text-sm font-medium text-gray-800 transition hover:border-[#C2185B] hover:bg-pink-50"
                  >
                    {optionLabel(value, locale)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">
              {messages.find_match}
            </h2>
            <p className="text-base text-gray-600">{messages.concern_question}</p>
            <div className="flex flex-wrap gap-3">
              {["Redness", "Dryness", "Acne", "Dullness", "Anti-aging"].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleSelect("concern", value, false)}
                  className="rounded-full border border-pink-100 px-5 py-2 text-sm font-medium text-gray-800 transition hover:border-[#C2185B] hover:bg-pink-50"
                >
                  {optionLabel(value, locale)}
                </button>
              ))}
            </div>
          </div>
        );
      case 3:
      default:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900">
              {messages.find_match}
            </h2>
            <p className="text-base text-gray-600">{messages.budget_question}</p>
            <div className="flex flex-wrap gap-3">
              {[
                "Budget ($0-20)",
                "Mid-range ($20-50)",
                "Premium ($50+)",
              ].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleSelect("budget", value, true)}
                  className="rounded-full border border-pink-100 px-5 py-2 text-sm font-medium text-gray-800 transition hover:border-[#C2185B] hover:bg-pink-50"
                >
                  {optionLabel(value, locale)}
                </button>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <Head>
        <title>Find Your K-Beauty Match | KBEAUTY GUIDE</title>
        <meta
          name="description"
          content="Take our quick quiz to find K-beauty products perfect for your skin tone, concerns and budget."
        />
      </Head>
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
        {/* Top label & language toggle */}
        <div className="mb-8 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[#C2185B]">
            K-Beauty Quiz
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
        </div>

        <section className="flex flex-1 flex-col justify-center">
          <div className="rounded-3xl border border-pink-100 bg-pink-50/40 p-6 shadow-sm sm:p-8">
            {renderStep()}

            {/* Progress */}
            <div className="mt-10 flex items-center justify-between text-xs text-gray-500">
              <span>
                Step {step + 1}/{totalSteps}
              </span>
              <div className="flex-1 px-4">
                <div className="h-1 w-full rounded-full bg-pink-100">
                  <div
                    className="h-1 rounded-full bg-[#C2185B] transition-all"
                    style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

