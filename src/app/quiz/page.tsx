"use client";

import Head from "next/head";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/hooks/useLocale";

type StepKey = "age" | "tone" | "undertone" | "concern" | "budget";

export default function QuizPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<StepKey, string>>>({});
  const { messages, locale, setLocale } = useLocale();

  const totalSteps = 4;

  const handleSelect = (key: StepKey, value: string, isLastStep: boolean) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));

    if (isLastStep) {
      router.push("/results");
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
              {["10s", "20s", "30s", "40s+"].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleSelect("age", label, false)}
                  className="rounded-full border border-pink-100 px-5 py-2 text-sm font-medium text-gray-800 transition hover:border-[#C2185B] hover:bg-pink-50"
                >
                  {label}
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
              {["Light", "Medium", "Dark"].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleSelect("tone", label, false)}
                  className="rounded-full border border-pink-100 px-5 py-2 text-sm font-medium text-gray-800 transition hover:border-[#C2185B] hover:bg-pink-50"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="pt-2">
              <p className="mb-3 text-sm text-gray-600">And your undertone?</p>
              <div className="flex flex-wrap gap-3">
                {["Warm", "Cool", "Neutral"].map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleSelect("undertone", label, false)}
                    className="rounded-full border border-pink-100 px-5 py-2 text-sm font-medium text-gray-800 transition hover:border-[#C2185B] hover:bg-pink-50"
                  >
                    {label}
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
              {["Redness", "Dryness", "Acne", "Dullness", "Anti-aging"].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleSelect("concern", label, false)}
                  className="rounded-full border border-pink-100 px-5 py-2 text-sm font-medium text-gray-800 transition hover:border-[#C2185B] hover:bg-pink-50"
                >
                  {label}
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
              ].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleSelect("budget", label, true)}
                  className="rounded-full border border-pink-100 px-5 py-2 text-sm font-medium text-gray-800 transition hover:border-[#C2185B] hover:bg-pink-50"
                >
                  {label}
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

