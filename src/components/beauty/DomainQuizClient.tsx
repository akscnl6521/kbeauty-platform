"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BeautyShell, QuizCard } from "@/components/beauty/BeautyShell";
import { applyDomainQuizToBeautyProfile } from "@/lib/care/local-store";

export type QuizOption = { value: string; label: string };
export type QuizStep = {
  key: string;
  title: string;
  help?: string;
  options: QuizOption[];
};

export function DomainQuizClient({
  domain,
  storageKey,
  title,
  subtitle,
  steps,
  resultsPath,
}: {
  domain: string;
  storageKey: string;
  title: string;
  subtitle: string;
  steps: QuizStep[];
  resultsPath: string;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const step = steps[idx]!;
  const progress = useMemo(
    () => Math.round(((idx + (answers[step.key] ? 1 : 0)) / steps.length) * 100),
    [answers, idx, step.key, steps.length]
  );

  function choose(value: string) {
    const next = { ...answers, [step.key]: value };
    setAnswers(next);
    if (idx < steps.length - 1) {
      setIdx(idx + 1);
      return;
    }
    const completedAt = new Date().toISOString();
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        domain,
        answers: next,
        completedAt,
      })
    );
    try {
      applyDomainQuizToBeautyProfile({
        domain,
        answers: next,
        completedAt,
      });
    } catch {
      /* local profile merge is best-effort */
    }
    router.push(resultsPath);
  }

  return (
    <BeautyShell eyebrow="맞춤 문진" title={title} subtitle={subtitle}>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#EFE6DE]">
        <div
          className="h-full rounded-full bg-[#8B4513] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <QuizCard>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9A6B3F]">
          {idx + 1} / {steps.length}
        </p>
        <h2 className="mt-2 text-xl font-semibold sm:text-2xl">{step.title}</h2>
        {step.help ? (
          <p className="mt-2 text-sm leading-6 text-gray-600">{step.help}</p>
        ) : null}
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {step.options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => choose(o.value)}
              className="rounded-2xl border border-[#E8DFD8] bg-[#FCF9F6] px-4 py-3 text-left text-sm font-medium transition hover:border-[#8B4513] hover:bg-white"
            >
              {o.label}
            </button>
          ))}
        </div>
        {idx > 0 ? (
          <button
            type="button"
            className="mt-6 text-sm text-gray-600 underline"
            onClick={() => setIdx(idx - 1)}
          >
            이전
          </button>
        ) : null}
      </QuizCard>
    </BeautyShell>
  );
}
