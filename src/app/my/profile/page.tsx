"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  loadCareStore,
  saveCareStore,
  updateBeautyProfileConfirmed,
} from "@/lib/care/local-store";
import {
  createEmptyBeautyProfile,
  mergeBeautyProfiles,
  parseBeautyProfile,
  type BeautyProfile,
} from "@/lib/profile";
import { MyCareNav } from "../MyCareNav";

function sourceLabel(source?: string): string {
  if (source === "user_confirmed") return "확인됨";
  if (source === "inferred") return "추론";
  return "미입력";
}

function csv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function Field({
  label,
  value,
  source,
}: {
  label: string;
  value?: string | null;
  source?: string;
}) {
  return (
    <div className="rounded-xl border border-[#E8DFD8] bg-white px-3 py-2">
      <p className="text-xs text-gray-500">
        {label} · {sourceLabel(source)}
      </p>
      <p className="mt-1 text-sm font-medium text-gray-900">
        {value && value.length > 0 ? value : "아직 없음"}
      </p>
    </div>
  );
}

function readInitialProfile(): BeautyProfile {
  if (typeof window === "undefined") return createEmptyBeautyProfile();
  return parseBeautyProfile(loadCareStore().beautyProfile ?? null);
}

function formFromProfile(p: BeautyProfile) {
  return {
    skinType: p.skin.type?.value ?? "",
    sensitivity: p.skin.sensitivity?.value ?? "",
    country: p.locale.country?.value ?? "KR",
    language: p.locale.language?.value ?? "ko",
    undertone: p.makeup.undertone?.value ?? "",
    scalpType: p.hairScalp.scalpType?.value ?? "",
    allergies: p.general.allergies.value.join(", "),
    concerns: p.skin.concerns.value.join(", "),
    avoided: p.skin.avoidedIngredients.value.join(", "),
    recommended: p.skin.recommendedIngredients.value.join(", "),
    preferredBrands: p.general.preferredBrands.value.join(", "),
    excludedBrands: p.general.excludedBrands.value.join(", "),
  };
}

function applyForm(p: BeautyProfile, set: {
  setSkinType: (v: string) => void;
  setSensitivity: (v: string) => void;
  setCountry: (v: string) => void;
  setLanguage: (v: string) => void;
  setUndertone: (v: string) => void;
  setScalpType: (v: string) => void;
  setAllergies: (v: string) => void;
  setConcerns: (v: string) => void;
  setAvoided: (v: string) => void;
  setRecommended: (v: string) => void;
  setPreferredBrands: (v: string) => void;
  setExcludedBrands: (v: string) => void;
}) {
  const f = formFromProfile(p);
  set.setSkinType(f.skinType);
  set.setSensitivity(f.sensitivity);
  set.setCountry(f.country);
  set.setLanguage(f.language);
  set.setUndertone(f.undertone);
  set.setScalpType(f.scalpType);
  set.setAllergies(f.allergies);
  set.setConcerns(f.concerns);
  set.setAvoided(f.avoided);
  set.setRecommended(f.recommended);
  set.setPreferredBrands(f.preferredBrands);
  set.setExcludedBrands(f.excludedBrands);
}

/** Long-term BeautyProfile view/edit — local care store + optional server sync. */
export default function MyBeautyProfilePage() {
  const [profile, setProfile] = useState<BeautyProfile>(readInitialProfile);
  const initial = formFromProfile(profile);
  const [msg, setMsg] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [skinType, setSkinType] = useState(initial.skinType);
  const [sensitivity, setSensitivity] = useState(initial.sensitivity);
  const [country, setCountry] = useState(initial.country);
  const [language, setLanguage] = useState(initial.language);
  const [undertone, setUndertone] = useState(initial.undertone);
  const [scalpType, setScalpType] = useState(initial.scalpType);
  const [allergies, setAllergies] = useState(initial.allergies);
  const [concerns, setConcerns] = useState(initial.concerns);
  const [avoided, setAvoided] = useState(initial.avoided);
  const [recommended, setRecommended] = useState(initial.recommended);
  const [preferredBrands, setPreferredBrands] = useState(initial.preferredBrands);
  const [excludedBrands, setExcludedBrands] = useState(initial.excludedBrands);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/care/beauty-profile", {
          credentials: "include",
        });
        if (!res.ok) {
          if (res.status === 401) {
            if (!cancelled) {
              setSyncNote("로그인 전 · 이 기기 로컬 프로필을 사용합니다.");
            }
            return;
          }
          return;
        }
        const json = (await res.json()) as {
          ok?: boolean;
          data?: {
            profile?: BeautyProfile | null;
            migrationPending?: boolean;
            storage?: string;
          };
        };
        if (!json.ok || !json.data || cancelled) return;
        const local = parseBeautyProfile(loadCareStore().beautyProfile ?? null);
        if (json.data.migrationPending || !json.data.profile) {
          setSyncNote(
            "서버 프로필 저장은 아직 준비 중입니다. 지금은 이 기기 로컬에 안전하게 보관합니다."
          );
          return;
        }
        const merged = mergeBeautyProfiles(
          local,
          parseBeautyProfile(json.data.profile)
        );
        const store = loadCareStore();
        saveCareStore({ ...store, beautyProfile: merged });
        setProfile(merged);
        applyForm(merged, {
          setSkinType,
          setSensitivity,
          setCountry,
          setLanguage,
          setUndertone,
          setScalpType,
          setAllergies,
          setConcerns,
          setAvoided,
          setRecommended,
          setPreferredBrands,
          setExcludedBrands,
        });
        setSyncNote("계정 프로필과 이 기기 기록을 병합했습니다.");
      } catch {
        if (!cancelled) {
          setSyncNote("서버 동기화를 건너뛰고 로컬 프로필을 사용합니다.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    const patch = {
      country,
      language,
      skinType: skinType || null,
      sensitivity: sensitivity || null,
      undertone: undertone || null,
      scalpType: scalpType || null,
      allergies: csv(allergies),
      concerns: csv(concerns),
      avoidedIngredients: csv(avoided),
      recommendedIngredients: csv(recommended),
      preferredBrands: csv(preferredBrands),
      excludedBrands: csv(excludedBrands),
    };
    const next = updateBeautyProfileConfirmed(patch);
    let p = next.beautyProfile ?? createEmptyBeautyProfile();

    try {
      const res = await fetch("/api/care/beauty-profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch, localProfile: p }),
      });
      if (res.status === 401) {
        setMsg(
          "장기 뷰티 프로필을 이 기기에 저장했습니다. 확인값이 추론값보다 우선합니다."
        );
      } else if (res.ok) {
        const json = (await res.json()) as {
          ok?: boolean;
          data?: {
            profile?: BeautyProfile;
            migrationPending?: boolean;
          };
        };
        if (json.ok && json.data?.profile) {
          p = parseBeautyProfile(json.data.profile);
          const store = loadCareStore();
          saveCareStore({ ...store, beautyProfile: p });
          setMsg(
            json.data.migrationPending
              ? "확인값을 저장했습니다. 서버 테이블은 아직 미적용이라 로컬에 보관합니다."
              : "확인값을 저장했고 계정 프로필에도 반영했습니다."
          );
        } else {
          setMsg("확인값을 이 기기에 저장했습니다.");
        }
      } else {
        setMsg("확인값을 이 기기에 저장했습니다. 서버 동기화는 나중에 다시 시도하세요.");
      }
    } catch {
      setMsg("확인값을 이 기기에 저장했습니다. 네트워크 오류로 서버 동기화는 건너뛰었습니다.");
    }

    setProfile(p);
    setSaving(false);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-gray-900">
      <MyCareNav current="/my/profile" />
      <header className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9A6B3F]">
          Beauty Profile
        </p>
        <h1 className="mt-2 text-2xl font-semibold">장기 뷰티 프로필</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          분석·문진·체크인에서 누적된 장기 기록입니다. 의료 진단이 아니며, 사용자가
          확인한 값이 추론값보다 우선합니다. 사진은 별도 동의 없이 장기 저장하지
          않습니다.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          마지막 갱신: {new Date(profile.updatedAt).toLocaleString("ko-KR")}
        </p>
        {syncNote ? (
          <p className="mt-2 text-xs text-gray-500" role="status">
            {syncNote}
          </p>
        ) : null}
      </header>

      {msg ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950" role="status">
          {msg}
        </p>
      ) : null}

      <section className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="현재 프로필 요약">
        <Field label="국가" value={profile.locale.country?.value} source={profile.locale.country?.source} />
        <Field label="언어" value={profile.locale.language?.value} source={profile.locale.language?.source} />
        <Field label="피부 타입" value={profile.skin.type?.value} source={profile.skin.type?.source} />
        <Field label="민감도" value={profile.skin.sensitivity?.value} source={profile.skin.sensitivity?.source} />
        <Field label="언더톤" value={profile.makeup.undertone?.value} source={profile.makeup.undertone?.source} />
        <Field label="두피 타입" value={profile.hairScalp.scalpType?.value} source={profile.hairScalp.scalpType?.source} />
        <Field label="고민" value={profile.skin.concerns.value.join(", ")} source={profile.skin.concerns.source} />
        <Field label="알레르기" value={profile.general.allergies.value.join(", ")} source={profile.general.allergies.source} />
        <Field
          label="추천 성분"
          value={profile.skin.recommendedIngredients.value.join(", ")}
          source={profile.skin.recommendedIngredients.source}
        />
        <Field
          label="회피 성분"
          value={profile.skin.avoidedIngredients.value.join(", ")}
          source={profile.skin.avoidedIngredients.source}
        />
        <Field
          label="위험 신호(사용자 보고)"
          value={profile.skin.redFlags.value.join(", ")}
          source={profile.skin.redFlags.source}
        />
        <Field
          label="유발 요인"
          value={profile.skin.triggers.value.join(", ")}
          source={profile.skin.triggers.source}
        />
      </section>

      <section className="mt-8 space-y-3 rounded-2xl border border-[#E8DFD8] bg-[#FCFAF7] p-4" aria-label="프로필 편집">
        <h2 className="text-lg font-semibold">확인값 편집</h2>
        <p className="text-xs text-gray-600">
          쉼표로 여러 값을 입력할 수 있습니다. 저장 시 모두 사용자 확인값으로
          표시됩니다.
        </p>
        <label className="block text-sm">
          국가
          <input className="mt-1 w-full rounded-xl border border-[#E8DFD8] px-3 py-2" value={country} onChange={(e) => setCountry(e.target.value)} />
        </label>
        <label className="block text-sm">
          언어
          <input className="mt-1 w-full rounded-xl border border-[#E8DFD8] px-3 py-2" value={language} onChange={(e) => setLanguage(e.target.value)} />
        </label>
        <label className="block text-sm">
          피부 타입
          <input className="mt-1 w-full rounded-xl border border-[#E8DFD8] px-3 py-2" value={skinType} onChange={(e) => setSkinType(e.target.value)} placeholder="dry / oily / combination…" />
        </label>
        <label className="block text-sm">
          민감도
          <input className="mt-1 w-full rounded-xl border border-[#E8DFD8] px-3 py-2" value={sensitivity} onChange={(e) => setSensitivity(e.target.value)} />
        </label>
        <label className="block text-sm">
          언더톤
          <input className="mt-1 w-full rounded-xl border border-[#E8DFD8] px-3 py-2" value={undertone} onChange={(e) => setUndertone(e.target.value)} placeholder="cool / warm / neutral" />
        </label>
        <label className="block text-sm">
          두피 타입
          <input className="mt-1 w-full rounded-xl border border-[#E8DFD8] px-3 py-2" value={scalpType} onChange={(e) => setScalpType(e.target.value)} />
        </label>
        <label className="block text-sm">
          고민 (쉼표 구분)
          <input className="mt-1 w-full rounded-xl border border-[#E8DFD8] px-3 py-2" value={concerns} onChange={(e) => setConcerns(e.target.value)} />
        </label>
        <label className="block text-sm">
          알레르기 (쉼표 구분)
          <input className="mt-1 w-full rounded-xl border border-[#E8DFD8] px-3 py-2" value={allergies} onChange={(e) => setAllergies(e.target.value)} />
        </label>
        <label className="block text-sm">
          추천 성분
          <input className="mt-1 w-full rounded-xl border border-[#E8DFD8] px-3 py-2" value={recommended} onChange={(e) => setRecommended(e.target.value)} />
        </label>
        <label className="block text-sm">
          회피 성분
          <input className="mt-1 w-full rounded-xl border border-[#E8DFD8] px-3 py-2" value={avoided} onChange={(e) => setAvoided(e.target.value)} />
        </label>
        <label className="block text-sm">
          선호 브랜드
          <input className="mt-1 w-full rounded-xl border border-[#E8DFD8] px-3 py-2" value={preferredBrands} onChange={(e) => setPreferredBrands(e.target.value)} />
        </label>
        <label className="block text-sm">
          제외 브랜드
          <input className="mt-1 w-full rounded-xl border border-[#E8DFD8] px-3 py-2" value={excludedBrands} onChange={(e) => setExcludedBrands(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-xl bg-[#8B4513] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "저장 중…" : "확인값 저장"}
          </button>
          <Link href="/my" className="rounded-xl border border-[#E8DFD8] bg-white px-4 py-2 text-sm font-medium">
            오늘로 돌아가기
          </Link>
          <Link href="/analyze" className="text-sm font-medium text-[#8B6914] underline self-center">
            새 분석으로 갱신
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">목표 이력</h2>
        {profile.goalHistory.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">아직 기록된 목표가 없습니다.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-gray-700">
            {profile.goalHistory.slice(-12).reverse().map((g, i) => (
              <li key={`${g.goal}-${g.recordedAt}-${i}`}>
                {g.goal} · {new Date(g.recordedAt).toLocaleDateString("ko-KR")}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
