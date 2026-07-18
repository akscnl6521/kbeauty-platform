"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { hydrateCareDashboard } from "@/lib/care/client-hydrate";
import {
  completeCheckIn,
  skipCheckIn,
  evaluateSafetyGate,
  getCheckinStepsForDay,
  getDayFocusCopy,
  EMERGENCY_FLAG_LABELS,
} from "@/lib/care";
import type {
  CareCheckIn,
  CareCheckInAnswers,
  CareCheckInDay,
  CareEmergencyFlags,
  CareSuggestion,
} from "@/lib/care/types";
import { MyCareNav } from "../../MyCareNav";

const emptyAnswers = (): CareCheckInAnswers => ({
  stillUsing: true,
  sting: 2,
  itch: 1,
  redness: 2,
  dryness: 3,
  oiliness: 3,
  breakouts: 2,
  swelling: 0,
  peeling: 1,
  satisfaction: 6,
  adherence: 7,
  photoAttached: false,
  freeMemo: null,
  newProductsUsed: null,
  adverseReaction: null,
  usageClarity: 7,
  routineFit: 6,
  wantReanalysis: null,
  emergencyFlags: {},
});

export default function MyCheckInDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [checkIn, setCheckIn] = useState<CareCheckIn | null>(null);
  const [suggestions, setSuggestions] = useState<CareSuggestion[]>([]);
  const [source, setSource] = useState<"server" | "local">("local");
  const [answers, setAnswers] = useState(emptyAnswers());
  const [done, setDone] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const day = (checkIn?.day ?? 3) as CareCheckInDay;
  const steps = useMemo(() => getCheckinStepsForDay(day), [day]);
  const safetyPreview = useMemo(() => evaluateSafetyGate(answers), [answers]);

  useEffect(() => {
    void hydrateCareDashboard().then((h) => {
      setSource(h.source);
      const found = h.dashboard.checkIns.find((c) => c.id === id) ?? null;
      setCheckIn(found);
      setSuggestions(
        h.dashboard.suggestions.filter((s) => s.checkInId === id)
      );
      if (found?.status === "completed") setDone(true);
      if (found?.status === "skipped") setSkipped(true);
    });
  }, [id]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    if (source === "server") {
      const res = await fetch(`/api/care/check-ins/${id}/complete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      setSubmitting(false);
      if (res.ok) {
        const json = (await res.json()) as {
          ok: boolean;
          data?: { checkIn: CareCheckIn; suggestions: CareSuggestion[] };
        };
        if (json.data) {
          setCheckIn(json.data.checkIn);
          setSuggestions(json.data.suggestions);
        }
        setDone(true);
      } else {
        setError("저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
      return;
    }

    const next = completeCheckIn(id, answers);
    const found = next.checkIns.find((c) => c.id === id) ?? null;
    setCheckIn(found);
    setSuggestions(next.suggestions.filter((s) => s.checkInId === id));
    setDone(true);
    setSubmitting(false);
  }

  async function onSkip() {
    if (!window.confirm("이번 체크인을 건너뛸까요? 나중에 다시 열 수 없습니다.")) {
      return;
    }
    setSubmitting(true);
    if (source === "server") {
      const res = await fetch(`/api/care/check-ins/${id}/skip`, {
        method: "POST",
        credentials: "include",
      });
      setSubmitting(false);
      if (res.ok) {
        setSkipped(true);
        setCheckIn((c) => (c ? { ...c, status: "skipped" } : c));
      } else {
        setError("건너뛰기에 실패했습니다.");
      }
      return;
    }
    const next = skipCheckIn(id);
    setCheckIn(next.checkIns.find((c) => c.id === id) ?? null);
    setSkipped(true);
    setSubmitting(false);
  }

  function setFlag(key: keyof CareEmergencyFlags, value: boolean) {
    setAnswers((prev) => ({
      ...prev,
      emergencyFlags: { ...(prev.emergencyFlags ?? {}), [key]: value },
    }));
  }

  if (!checkIn) {
    return (
      <main className="kb-container py-10 text-sm">
        <p>체크인을 찾을 수 없습니다.</p>
        <Link href="/my/check-ins" className="text-[var(--kb-accent,#8B6914)] underline">
          목록
        </Link>
      </main>
    );
  }

  const finished = checkIn.status === "completed" || done || skipped;

  return (
    <main className="kb-container py-10">
      <h1 className="text-2xl font-bold tracking-tight">Day {checkIn.day} 체크인</h1>
      <MyCareNav current="/my/check-ins" />
      <p className="mt-2 text-sm text-stone-600">{getDayFocusCopy(day)}</p>
      <p className="mt-1 text-xs text-stone-500">
        의료 진단이 아닙니다. 사진은 선택이며 이번 단계에서는 업로드를 강제하지 않습니다.
      </p>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {finished ? (
        <div className="mt-6 space-y-4 text-sm">
          {skipped ? (
            <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
              이번 체크인을 건너뛰었습니다.
            </p>
          ) : (
            <>
              {safetyPreview.urgent ||
              (checkIn.referralLevel && checkIn.referralLevel !== "none") ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-amber-950"
                >
                  <p className="font-medium">안전 안내 (진단 아님)</p>
                  <p className="mt-1">{safetyPreview.userMessage}</p>
                  {safetyPreview.suppressProductPush ? (
                    <p className="mt-2 text-xs">
                      새 제품 추천을 강하게 밀지 않습니다. 사용 중단을 먼저 고려하세요.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  완료되었습니다. 제안은 동의 후에만 루틴에 반영됩니다.
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/my/progress"
                  className="inline-flex min-h-11 items-center text-[var(--kb-accent,#8B6914)] underline"
                >
                  변화 보기
                </Link>
                <Link
                  href="/my/routine"
                  className="inline-flex min-h-11 items-center text-[var(--kb-accent,#8B6914)] underline"
                >
                  루틴 조정 제안
                </Link>
                <Link
                  href="/analyze"
                  className="inline-flex min-h-11 items-center text-[var(--kb-accent,#8B6914)] underline"
                >
                  재분석
                </Link>
              </div>
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3"
                >
                  <p className="font-medium">{s.title}</p>
                  <p className="text-stone-700">{s.reason}</p>
                  <p className="text-xs text-stone-500">{s.expectedEffect}</p>
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <div className="mt-6">
          <ol className="mb-4 flex flex-wrap gap-2 text-xs" aria-label="체크인 단계">
            {steps.map((s, i) => (
              <li
                key={s.id}
                className={
                  i === stepIdx
                    ? "rounded-full bg-stone-900 px-3 py-1 text-white"
                    : "rounded-full bg-stone-100 px-3 py-1 text-stone-600"
                }
              >
                {i + 1}. {s.title}
              </li>
            ))}
          </ol>

          {safetyPreview.urgent ? (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950"
            >
              <p className="font-medium">긴급 신호가 선택되었습니다</p>
              <p className="mt-1">{safetyPreview.userMessage}</p>
            </div>
          ) : null}

          <form
            className="space-y-4 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              if (stepIdx < steps.length - 1) {
                setStepIdx((n) => n + 1);
                return;
              }
              void submit();
            }}
          >
            <fieldset>
              <legend className="sr-only">{steps[stepIdx]?.title}</legend>
              {(steps[stepIdx]?.questions ?? []).map((q) => {
                if (q.kind === "emergency_flags") {
                  return (
                    <div key={q.id} className="space-y-2">
                      <p className="font-medium text-stone-800">{q.label}</p>
                      {q.help ? (
                        <p className="text-xs text-stone-500">{q.help}</p>
                      ) : null}
                      <ul className="space-y-2">
                        {(
                          Object.keys(EMERGENCY_FLAG_LABELS) as (keyof CareEmergencyFlags)[]
                        ).map((key) => (
                          <li key={key}>
                            <label className="flex min-h-11 items-center gap-3">
                              <input
                                type="checkbox"
                                className="h-5 w-5"
                                checked={Boolean(answers.emergencyFlags?.[key])}
                                onChange={(e) => setFlag(key, e.target.checked)}
                              />
                              <span>{EMERGENCY_FLAG_LABELS[key]}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                }
                if (q.kind === "boolean" && q.answerKey === "stillUsing") {
                  return (
                    <label key={q.id} className="flex min-h-11 items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={answers.stillUsing === true}
                        onChange={(e) =>
                          setAnswers({ ...answers, stillUsing: e.target.checked })
                        }
                      />
                      {q.label}
                    </label>
                  );
                }
                if (q.kind === "boolean" && q.answerKey) {
                  const key = q.answerKey;
                  const val = answers[key];
                  return (
                    <label key={q.id} className="flex min-h-11 items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={val === true}
                        onChange={(e) =>
                          setAnswers({ ...answers, [key]: e.target.checked })
                        }
                      />
                      <span>
                        {q.label}
                        {q.help ? (
                          <span className="mt-0.5 block text-xs text-stone-500">
                            {q.help}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                }
                if (q.kind === "memo") {
                  return (
                    <label key={q.id} className="block">
                      <span className="text-stone-700">{q.label}</span>
                      <textarea
                        className="mt-2 min-h-24 w-full rounded-lg border border-stone-200 px-3 py-2"
                        maxLength={500}
                        value={answers.freeMemo ?? ""}
                        onChange={(e) =>
                          setAnswers({ ...answers, freeMemo: e.target.value || null })
                        }
                      />
                    </label>
                  );
                }
                if (q.kind === "slider" && q.answerKey) {
                  const key = q.answerKey;
                  const num = typeof answers[key] === "number" ? (answers[key] as number) : 0;
                  return (
                    <label key={q.id} className="block">
                      <span className="text-stone-700">{q.label} (0–10)</span>
                      {q.help ? (
                        <span className="mt-0.5 block text-xs text-stone-500">{q.help}</span>
                      ) : null}
                      <input
                        type="range"
                        min={q.min ?? 0}
                        max={q.max ?? 10}
                        className="mt-2 w-full"
                        value={num}
                        onChange={(e) =>
                          setAnswers({
                            ...answers,
                            [key]: Number(e.target.value),
                          })
                        }
                      />
                      <span className="tabular-nums text-xs text-stone-500">{num}</span>
                    </label>
                  );
                }
                return null;
              })}
            </fieldset>

            <div className="flex flex-wrap gap-3 pt-2">
              {stepIdx > 0 ? (
                <button
                  type="button"
                  className="kb-btn min-h-11 border border-stone-300 bg-white px-4 text-stone-800"
                  onClick={() => setStepIdx((n) => Math.max(0, n - 1))}
                >
                  이전
                </button>
              ) : null}
              <button
                type="submit"
                disabled={submitting}
                className="kb-btn min-h-11 bg-[var(--kb-accent,#8B6914)] px-4 text-white disabled:opacity-50"
              >
                {submitting
                  ? "저장 중…"
                  : stepIdx < steps.length - 1
                    ? "다음"
                    : "완료"}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void onSkip()}
                className="min-h-11 px-3 text-sm text-stone-600 underline"
              >
                건너뛰기
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
