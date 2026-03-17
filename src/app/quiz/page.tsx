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
};

const OPTION_LABELS_JA: Record<string, string> = {
  "10s": "10代",
  "20s": "20代",
  "30s": "30代",
  "40s+": "40代以上",
  Light: "明るい",
  Medium: "ミディアム",
  Dark: "ダーク",
  Warm: "ウォームトーン",
  Cool: "クールトーン",
  Neutral: "ニュートラル",
  Redness: "赤み",
  Dryness: "乾燥",
  Acne: "ニキビ",
  Dullness: "くすみ",
  "Anti-aging": "エイジングケア",
};

function optionLabel(value: string, locale: string): string {
  if (locale === "ko") return OPTION_LABELS_KO[value] ?? value;
  if (locale === "ja") return OPTION_LABELS_JA[value] ?? value;
  return value;
}

function budgetLabel(value: string, locale: string): string {
  if (locale === "ko") {
    if (value === "Budget ($0-20)") return "저가 (₩0-27,000)";
    if (value === "Mid-range ($20-50)") return "중가 (₩27,000-67,500)";
    if (value === "Premium ($50+)") return "프리미엄 (₩67,500+)";
  } else if (locale === "ja") {
    if (value === "Budget ($0-20)") return "低価格 (¥0-3,000)";
    if (value === "Mid-range ($20-50)") return "中価格 (¥3,000-7,500)";
    if (value === "Premium ($50+)") return "プレミアム (¥7,500+)";
  }
  return value;
}

export default function QuizPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<StepKey, string>>>({});
  const { messages, locale, setLocale } = useLocale();

  const totalSteps = 4;
  const title =
    locale === "ko"
      ? "나에게 맞는 K-뷰티 정보를 찾아보세요"
      : messages.find_match;
  const subtitle =
    locale === "ko"
      ? "몇 가지 질문으로 피부에 맞는 성분과 제품 정보를 정리해드립니다"
      : "";

  const optionClass = (key: StepKey, value: string) => {
    const selected = answers[key] === value;
    return `rounded-full border px-5 py-2 text-sm font-medium transition ${
      selected
        ? "border-[#C2185B] bg-[#C2185B] text-white shadow-md shadow-[#C2185B33]"
        : "border-pink-100 bg-white text-gray-800 hover:border-[#C2185B] hover:bg-pink-50"
    }`;
  };

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
              {title}
            </h2>
            {subtitle ? (
              <p className="-mt-3 text-sm text-gray-500">{subtitle}</p>
            ) : null}
            <p className="text-base text-gray-600">{messages.age_question}</p>
            <div className="flex flex-wrap gap-3">
              {["10s", "20s", "30s", "40s+"].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleSelect("age", value, false)}
                  className={optionClass("age", value)}
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
              {title}
            </h2>
            {subtitle ? (
              <p className="-mt-3 text-sm text-gray-500">{subtitle}</p>
            ) : null}
            <p className="text-base text-gray-600">{messages.tone_question}</p>
            <div className="flex flex-wrap gap-3">
              {["Light", "Medium", "Dark"].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleSelect("tone", value, false)}
                  className={optionClass("tone", value)}
                >
                  {optionLabel(value, locale)}
                </button>
              ))}
            </div>
            <div className="pt-2">
              <p className="mb-3 text-sm text-gray-600">
                {locale === "ko"
                  ? "퍼스널 컬러는?"
                  : locale === "ja"
                    ? "アンダートーンは？"
                    : "And your undertone?"}
              </p>
              <div className="flex flex-wrap gap-3">
                {["Warm", "Cool", "Neutral"].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleSelect("undertone", value, false)}
                    className={optionClass("undertone", value)}
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
              {title}
            </h2>
            {subtitle ? (
              <p className="-mt-3 text-sm text-gray-500">{subtitle}</p>
            ) : null}
            <p className="text-base text-gray-600">{messages.concern_question}</p>
            <div className="flex flex-wrap gap-3">
              {["Redness", "Dryness", "Acne", "Dullness", "Anti-aging"].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleSelect("concern", value, false)}
                  className={optionClass("concern", value)}
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
              {title}
            </h2>
            {subtitle ? (
              <p className="-mt-3 text-sm text-gray-500">{subtitle}</p>
            ) : null}
            <p className="text-base text-gray-600">
              {locale === "ko"
                ? "관심 있는 가격대는 어느 정도인가요?"
                : messages.budget_question}
            </p>
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
                  className={optionClass("budget", value)}
                >
                  {budgetLabel(value, locale)}
                </button>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A]">
      <Head>
        <title>Find Your K-Beauty Match | KBEAUTY GUIDE</title>
        <meta
          name="description"
          content="Take our quick quiz to find K-beauty products perfect for your skin tone, concerns and budget."
        />
      </Head>
      <main className="min-h-screen flex items-center justify-center bg-[#FAFAF8] px-6 py-10">
        {/* Top label & language toggle */}
        <div className="absolute left-0 right-0 top-0 mx-auto max-w-2xl px-6 py-10">
          <div className="mb-8 flex items-center justify-between">
          <div className="font-['Playfair_Display',serif] text-sm font-semibold uppercase tracking-[0.3em] text-[#B8860B]">
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
        </div>

        <section className="w-full max-w-2xl">
          <div className="w-full max-w-2xl rounded-3xl border border-pink-100 bg-white p-8 shadow-sm">
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

