"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DRAFT_KEY = "kbeautyOnboardingDraftV1";
type Form = { country: string; timezone: string; skinType: string; sensitivity: string; concerns: string; consent: boolean };
const initial = (): Form => ({ country: "KR", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul", skinType: "", sensitivity: "", concerns: "", consent: false });
const titles = ["국가와 시간대", "피부 타입", "민감도", "고민", "입력 내용 확인", "케어 기록 동의"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { try { const draft = localStorage.getItem(DRAFT_KEY); if (draft) setForm(JSON.parse(draft)); } catch { /* 잘못된 임시값은 무시 */ } }, []);
  useEffect(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch { /* 저장 공간 부족 시 현재 입력 유지 */ } }, [form]);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((old) => ({ ...old, [key]: value }));
  async function finish() {
    if (!form.consent) { setError("계정에 케어 기록을 저장하려면 동의가 필요합니다."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/care/analyses", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timezone: form.timezone, country: form.country, skinType: form.skinType || null, sensitivity: form.sensitivity || null, concerns: form.concerns.split(",").map((v) => v.trim()).filter(Boolean), toneDepth: null, undertone: null, allergyIngredients: [], avoidedIngredients: [], currentProducts: [], analysisSnapshot: {}, recommendationSnapshot: {}, rankedProductIds: [], dataConfidence: null, consentCareTracking: true }) });
      if (res.status === 401) { router.push("/login?next=%2Fonboarding"); return; }
      if (!res.ok) throw new Error();
      localStorage.removeItem(DRAFT_KEY); router.push("/my?onboarded=1");
    } catch { setError("저장하지 못했습니다. 잠시 후 다시 시도해 주세요."); } finally { setBusy(false); }
  }
  const chips = (key: "skinType" | "sensitivity", values: string[]) => <div className="mt-5 flex flex-wrap gap-2">{values.map((value) => <button type="button" key={value} onClick={() => set(key, value)} className={`rounded-full border px-4 py-2 text-sm ${form[key] === value ? "border-[#C2185B] bg-pink-50 text-[#C2185B]" : "border-gray-200"}`}>{value}</button>)}</div>;
  let content: React.ReactNode;
  if (step === 0) content = <div className="mt-5 grid gap-4"><label>국가<input className="mt-1 w-full rounded border p-2" value={form.country} onChange={(e) => set("country", e.target.value)} /></label><label>시간대<input className="mt-1 w-full rounded border p-2" value={form.timezone} onChange={(e) => set("timezone", e.target.value)} /></label></div>;
  else if (step === 1) content = chips("skinType", ["건성", "지성", "복합성", "중성", "잘 모르겠어요"]);
  else if (step === 2) content = chips("sensitivity", ["낮음", "보통", "높음", "잘 모르겠어요"]);
  else if (step === 3) content = <label className="mt-5 block">고민 (쉼표로 구분)<input className="mt-2 w-full rounded border p-2" value={form.concerns} onChange={(e) => set("concerns", e.target.value)} /></label>;
  else if (step === 4) content = <dl className="mt-5 space-y-2 rounded bg-[#FAF7F5] p-4 text-sm"><div><dt>국가·시간대</dt><dd>{form.country} · {form.timezone}</dd></div><div><dt>피부 타입·민감도</dt><dd>{form.skinType || "미입력"} · {form.sensitivity || "미입력"}</dd></div><div><dt>고민</dt><dd>{form.concerns || "미입력"}</dd></div></dl>;
  else content = <label className="mt-5 flex gap-3 text-sm"><input type="checkbox" checked={form.consent} onChange={(e) => set("consent", e.target.checked)} />내 케어 기록을 계정에 저장하는 데 동의합니다.</label>;
  return <main className="min-h-[70vh] bg-[#FAF7F5] px-4 py-10"><div className="mx-auto max-w-xl rounded-2xl bg-white p-6"><p className="text-sm text-[#C2185B]">{step + 1} / {titles.length}</p><h1 className="mt-4 text-2xl font-bold">{titles[step]}</h1>{content}{error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}<div className="mt-8 flex items-center justify-between"><button type="button" disabled={!step} onClick={() => setStep((v) => v - 1)}>이전</button><button type="button" onClick={() => router.push("/my")} className="text-sm text-gray-500">나중에 계속하기</button>{step === titles.length - 1 ? <button type="button" disabled={busy} onClick={() => void finish()} className="rounded bg-[#C2185B] px-4 py-2 text-white">{busy ? "저장 중…" : "완료"}</button> : <button type="button" onClick={() => setStep((v) => v + 1)} className="rounded bg-[#C2185B] px-4 py-2 text-white">다음</button>}</div></div></main>;
}
