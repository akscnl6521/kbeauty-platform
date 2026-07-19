"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { hydrateCareDashboard } from "@/lib/care/client-hydrate";
import { completeCheckIn } from "@/lib/care";
import type {
  CareAcuteSignals,
  CareCheckIn,
  CareCheckInAnswers,
  CareSuggestion,
} from "@/lib/care/types";
import { MyCareNav } from "../../MyCareNav";

const emptyAcuteSignals = (): CareAcuteSignals => ({
  pain: false,
  bleeding: false,
  oozing: false,
  rapidSwelling: false,
  spreadingRash: false,
  eyeIrritation: false,
  breathingDifficulty: false,
  systemicAllergy: false,
});

const emptyAnswers = (): CareCheckInAnswers => ({
  stillUsing: true,
  sting: 0,
  itch: 0,
  redness: 0,
  dryness: 0,
  oiliness: 0,
  breakouts: 0,
  swelling: 0,
  peeling: 0,
  satisfaction: 5,
  adherence: 5,
  photoAttached: false,
  freeMemo: null,
  acuteSignals: emptyAcuteSignals(),
});

const ACUTE_OPTIONS: { key: keyof CareAcuteSignals; label: string }[] = [
  { key: "pain", label: "통증" },
  { key: "bleeding", label: "출혈" },
  { key: "oozing", label: "진물" },
  { key: "rapidSwelling", label: "급격한 붓기" },
  { key: "spreadingRash", label: "퍼지는 발진" },
  { key: "eyeIrritation", label: "눈 내부 자극" },
  { key: "breathingDifficulty", label: "호흡 곤란" },
  { key: "systemicAllergy", label: "전신 알레르기 반응" },
];

export default function MyCheckInDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [checkIn, setCheckIn] = useState<CareCheckIn | null>(null);
  const [suggestions, setSuggestions] = useState<CareSuggestion[]>([]);
  const [source, setSource] = useState<"server" | "local">("local");
  const [answers, setAnswers] = useState(emptyAnswers());
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    void hydrateCareDashboard().then((h) => {
      setSource(h.source);
      const found = h.dashboard.checkIns.find((c) => c.id === id) ?? null;
      setCheckIn(found);
      setSuggestions(h.dashboard.suggestions.filter((s) => s.checkInId === id));
      if (found?.status === "completed") setDone(true);
    });
  }, [id]);

  const hasEmergencySignal = Boolean(
    answers.acuteSignals?.breathingDifficulty ||
      answers.acuteSignals?.systemicAllergy ||
      answers.acuteSignals?.rapidSwelling
  );

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    if (source === "server") {
      const res = await fetch(`/api/care/check-ins/${id}/complete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      setSubmitting(false);
      if (!res.ok) {
        setSubmitError("저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const json = (await res.json()) as {
        ok: boolean;
        data?: { checkIn: CareCheckIn; suggestions: CareSuggestion[] };
      };
      if (json.data) {
        setCheckIn(json.data.checkIn);
        setSuggestions(json.data.suggestions);
      }
      setDone(true);
      return;
    }

    const next = completeCheckIn(id, answers);
    const found = next.checkIns.find((c) => c.id === id) ?? null;
    setCheckIn(found);
    setSuggestions(next.suggestions.filter((s) => s.checkInId === id));
    setDone(true);
    setSubmitting(false);
  }

  if (!checkIn) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-sm">
        <p>체크인을 찾을 수 없습니다.</p>
        <Link href="/my/check-ins" className="text-[#8B6914] underline">목록</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Day {checkIn.day} 체크인</h1>
      <MyCareNav current="/my/check-ins" />
      <p className="mt-2 text-sm text-gray-600">
        현재 상태를 직접 기록하는 선택형 질문입니다. 질환을 진단하지 않습니다.
      </p>

      {checkIn.status === "completed" || done ? (
        <div className="mt-6 space-y-3 text-sm">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            완료되었습니다. 제안은 동의 후에만 루틴에 반영됩니다.
          </p>
          {checkIn.referralLevel !== "none" ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 font-medium text-rose-900">
              현재 응답에는 전문가 확인을 우선할 신호가 포함되어 있습니다. 심하거나 급격히 악화되면 가까운 의료기관·응급서비스에 문의하세요.
            </p>
          ) : null}
          <Link href="/my/progress" className="text-[#8B6914] underline">변화 보기</Link>
          {suggestions.map((s) => (
            <div key={s.id} className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3">
              <p className="font-medium">{s.title}</p>
              <p className="text-gray-700">{s.reason}</p>
              <p className="text-xs text-gray-500">{s.expectedEffect}</p>
            </div>
          ))}
        </div>
      ) : (
        <form className="mt-6 space-y-6 text-sm" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <fieldset className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
            <legend className="px-1 font-semibold text-rose-900">먼저 확인할 위험 신호</legend>
            <p className="mb-3 text-xs leading-5 text-rose-800">
              현재 해당되는 항목만 선택하세요. 호흡 곤란·전신 알레르기 반응·급격한 붓기는 제품 사용보다 즉시 상태 확인이 우선입니다.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ACUTE_OPTIONS.map(({ key, label }) => (
                <label key={key} className="flex min-h-10 items-center gap-2 rounded-lg border border-rose-100 bg-white px-3">
                  <input
                    type="checkbox"
                    checked={Boolean(answers.acuteSignals?.[key])}
                    onChange={(e) =>
                      setAnswers({
                        ...answers,
                        acuteSignals: {
                          ...emptyAcuteSignals(),
                          ...(answers.acuteSignals ?? {}),
                          [key]: e.target.checked,
                        },
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            {hasEmergencySignal ? (
              <p className="mt-3 rounded-lg bg-white px-3 py-2 font-semibold text-rose-900" role="alert">
                긴급 확인 신호가 선택되었습니다. 새 제품 사용을 중단하고 가까운 의료기관·응급서비스에 문의하는 것을 우선하세요.
              </p>
            ) : null}
          </fieldset>

          {([
            ["sting", "따가움"], ["itch", "가려움"], ["redness", "붉음"],
            ["dryness", "건조"], ["oiliness", "유분"], ["breakouts", "트러블"],
            ["swelling", "붓기"], ["peeling", "벗겨짐"],
            ["satisfaction", "만족도"], ["adherence", "루틴 준수"],
          ] as const).map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-gray-700">{label} (0–10)</span>
              <input
                type="range"
                min={0}
                max={10}
                className="mt-1 w-full"
                value={answers[key] ?? 0}
                onChange={(e) => setAnswers({ ...answers, [key]: Number(e.target.value) })}
              />
              <span className="tabular-nums text-xs text-gray-500">{answers[key]}</span>
            </label>
          ))}

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={answers.stillUsing === true}
              onChange={(e) => setAnswers({ ...answers, stillUsing: e.target.checked })}
            />
            현재 루틴을 계속 사용 중
          </label>

          {submitError ? <p className="text-sm text-rose-700">{submitError}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[#8B6914] px-4 py-2 text-white disabled:opacity-50"
          >
            {submitting ? "저장 중…" : "체크인 저장"}
          </button>
        </form>
      )}
    </main>
  );
}