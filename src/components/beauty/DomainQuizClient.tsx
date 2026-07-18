"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BeautyShell, QuizCard } from "@/components/beauty/BeautyShell";
import { JourneyProgress } from "@/components/ui/JourneyChrome";

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
  const progressCurrent = idx + 1;
  const progress = useMemo(
    () => Math.round((progressCurrent / steps.length) * 100),
    [progressCurrent, steps.length]
  );

  function choose(value: string) {
    const next = { ...answers, [step.key]: value };
    setAnswers(next);
    if (idx < steps.length - 1) {
      setIdx(idx + 1);
      return;
    }
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        domain,
        answers: next,
        completedAt: new Date().toISOString(),
      })
    );
    router.push(resultsPath);
  }

  return (
    <BeautyShell eyebrow="맞춤 문진" title={title} subtitle={subtitle}>
      <JourneyProgress current={progressCurrent} total={steps.length} label="문진 진행" />
      <QuizCard>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-warm)]">
          질문 {idx + 1}
        </p>
        <h2 className="mt-2 text-balance text-xl font-semibold sm:text-2xl">{step.title}</h2>
        {step.help ? (
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{step.help}</p>
        ) : null}
        <div className="mt-6 grid gap-2 sm:grid-cols-2" role="group" aria-label={step.title}>
          {step.options.map((o) => {
            const selected = answers[step.key] === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => choose(o.value)}
                aria-pressed={selected}
                className={`kb-chip w-full justify-start text-left ${selected ? "is-selected" : ""}`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {idx > 0 ? (
            <button
              type="button"
              className="kb-btn kb-btn-secondary"
              onClick={() => setIdx(idx - 1)}
            >
              이전
            </button>
          ) : null}
          <p className="text-xs text-[var(--text-subtle)]" aria-live="polite">
            선택하면 다음 질문으로 이동합니다 · {progress}%
          </p>
        </div>
      </QuizCard>
    </BeautyShell>
  );
}
