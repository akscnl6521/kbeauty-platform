"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const DRAFT_KEY = "kbeautyOnboardingDraftV1";

type Form = {
  country: string;
  timezone: string;
  skinType: string;
  sensitivity: string;
  concerns: string;
  consent: boolean;
};

const titles = [
  "국가와 시간대",
  "피부 타입",
  "민감도",
  "고민",
  "입력 내용 확인",
  "케어 기록 동의",
];

function emptyForm(): Form {
  return {
    country: "KR",
    timezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul",
    skinType: "",
    sensitivity: "",
    concerns: "",
    consent: false,
  };
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);

  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) setForm(JSON.parse(draft) as Form);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      setDraftSaved(true);
    } catch {
      /* ignore */
    }
  }, [form]);

  function patch<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  async function finish() {
    if (!form.consent) {
      setError("계정에 케어 기록을 저장하려면 동의가 필요합니다.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/care/analyses", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone: form.timezone,
          country: form.country,
          skinType: form.skinType || null,
          sensitivity: form.sensitivity || null,
          concerns: form.concerns
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          toneDepth: null,
          undertone: null,
          allergyIngredients: [],
          avoidedIngredients: [],
          currentProducts: [],
          analysisSnapshot: {},
          recommendationSnapshot: {},
          rankedProductIds: [],
          dataConfidence: null,
          consentCareTracking: true,
        }),
      });
      if (res.status === 401) {
        router.push("/login?next=%2Fonboarding");
        return;
      }
      if (!res.ok) throw new Error("save_failed");
      localStorage.removeItem(DRAFT_KEY);
      router.push("/my?onboarded=1");
    } catch {
      setError("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  function chips(key: "skinType" | "sensitivity", values: string[]) {
    return (
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label={titles[step]}>
        {values.map((value) => {
          const selected = form[key] === value;
          return (
            <button
              type="button"
              key={value}
              onClick={() => patch(key, value)}
              aria-pressed={selected}
              className={`touch-target rounded-full border px-4 py-2 text-sm ${
                selected
                  ? "border-[#C2185B] bg-pink-50 font-medium text-[#C2185B]"
                  : "border-gray-200 bg-white"
              }`}
            >
              {value}
            </button>
          );
        })}
      </div>
    );
  }

  let content: React.ReactNode;
  if (step === 0) {
    content = (
      <div className="mt-5 grid gap-4">
        <label className="block text-sm">
          국가
          <input
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] px-3 py-2.5"
            value={form.country}
            onChange={(e) => patch("country", e.target.value)}
          />
        </label>
        <label className="block text-sm">
          시간대
          <input
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] px-3 py-2.5"
            value={form.timezone}
            onChange={(e) => patch("timezone", e.target.value)}
          />
        </label>
      </div>
    );
  } else if (step === 1) {
    content = chips("skinType", [
      "건성",
      "지성",
      "복합성",
      "중성",
      "잘 모르겠어요",
    ]);
  } else if (step === 2) {
    content = chips("sensitivity", [
      "낮음",
      "보통",
      "높음",
      "잘 모르겠어요",
    ]);
  } else if (step === 3) {
    content = (
      <label className="mt-5 block text-sm">
        고민 (쉼표로 구분, 선택)
        <input
          className="mt-2 w-full rounded-lg border border-[#E8DFD8] px-3 py-2.5"
          value={form.concerns}
          onChange={(e) => patch("concerns", e.target.value)}
          placeholder="예: 건조, 민감"
        />
      </label>
    );
  } else if (step === 4) {
    content = (
      <dl className="mt-5 space-y-3 rounded-xl bg-[#FAF7F5] p-4 text-sm">
        <div>
          <dt className="text-gray-500">국가·시간대</dt>
          <dd className="font-medium">
            {form.country} · {form.timezone}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">피부 타입·민감도</dt>
          <dd className="font-medium">
            {form.skinType || "미입력"} · {form.sensitivity || "미입력"}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">고민</dt>
          <dd className="font-medium">{form.concerns || "미입력"}</dd>
        </div>
      </dl>
    );
  } else {
    content = (
      <div className="mt-5 space-y-3 text-sm">
        <label className="flex gap-3">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(e) => patch("consent", e.target.checked)}
            className="mt-1"
          />
          <span>
            내 케어 기록을 계정에 저장하는 데 동의합니다.{" "}
            <Link href="/privacy" className="underline">
              개인정보처리방침
            </Link>
          </span>
        </label>
      </div>
    );
  }

  return (
    <main className="min-h-[70vh] bg-[#FAF7F5] px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-xl rounded-2xl border border-[#E8DFD8] bg-white p-6">
        <div className="flex items-center justify-between gap-3 text-sm text-[#C2185B]">
          <p>
            {step + 1} / {titles.length}
          </p>
          {draftSaved ? (
            <p className="text-xs text-gray-500">임시 저장됨</p>
          ) : null}
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded bg-pink-100"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={titles.length}
        >
          <div
            className="h-2 rounded bg-[#C2185B]"
            style={{ width: `${((step + 1) / titles.length) * 100}%` }}
          />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">
          {titles[step]}
        </h1>
        {content}
        {error ? (
          <p role="alert" className="mt-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={!step}
            onClick={() => setStep((v) => v - 1)}
            className="touch-target rounded-lg px-3 text-sm disabled:opacity-40"
          >
            이전
          </button>
          <button
            type="button"
            onClick={() => router.push("/my")}
            className="touch-target text-sm text-gray-500 underline"
          >
            나중에 계속하기
          </button>
          {step === titles.length - 1 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void finish()}
              className="touch-target rounded-lg bg-[#C2185B] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "저장 중…" : "완료"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((v) => v + 1)}
              className="touch-target rounded-lg bg-[#C2185B] px-4 py-2 text-sm font-semibold text-white"
            >
              다음
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
