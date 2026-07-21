"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadCareStore, saveCareStore } from "@/lib/care";
import { CARE_STORAGE_KEY, emptyCareStore } from "@/lib/care/local-store";
import {
  careExportFilename,
  serializeCareExport,
  summarizeCareStoreForDeletion,
} from "@/lib/care/dataPortability";
import {
  attachLocalCareStore,
  hydrateCareDashboard,
} from "@/lib/care/client-hydrate";
import type { CareStoreSnapshot } from "@/lib/care/types";
import { PhotoAssetsSettingsPanel } from "@/components/care/PhotoAssetsSettingsPanel";
import { PhotoConsentPanel } from "@/components/care/PhotoConsentPanel";
import { MyCareNav } from "../MyCareNav";

/** Account, care preferences, and user-controlled local data actions. */
export default function MyCareSettingsPage() {
  const [store, setStore] = useState<CareStoreSnapshot | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const [source, setSource] = useState<"server" | "local">("local");
  const [attachMsg, setAttachMsg] = useState<string | null>(null);
  const [dataMsg, setDataMsg] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [country, setCountry] = useState("KR");

  useEffect(() => {
    void hydrateCareDashboard().then((h) => {
      setLinked(h.dashboard.linkedAccount || h.source === "server");
      setSource(h.source);
      setStore(h.localStore ?? loadCareStore());
    });
    void fetch("/api/care/me", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && typeof j.data?.email === "string") setEmail(j.data.email);
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  if (!store) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-gray-900">
        <p className="text-sm text-gray-500">설정을 불러오는 중…</p>
      </main>
    );
  }

  function patch(p: Partial<CareStoreSnapshot["settings"]>) {
    const next = {
      ...store!,
      settings: { ...store!.settings, ...p },
    };
    saveCareStore(next);
    setStore(next);
  }

  async function handleAttach() {
    if (
      !window.confirm(
        "이 기기의 로컬 케어 데이터를 계정에 연결합니다. 중복 항목은 건너뜁니다. 계속할까요?"
      )
    ) {
      return;
    }
    setAttaching(true);
    setAttachMsg(null);
    const result = await attachLocalCareStore();
    setAttaching(false);
    setAttachMsg(result.message);
    if (result.ok) {
      setLinked(true);
      setSource("server");
    }
  }

  function handleLocalExport() {
    try {
      const now = new Date();
      const blob = new Blob([serializeCareExport(store!, now)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = careExportFilename(now);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setDataMsg("이 기기의 케어 기록을 JSON 파일로 저장했습니다.");
    } catch {
      setDataMsg("기록 파일을 만드는 중 오류가 발생했습니다.");
    }
  }

  function handleLocalDelete() {
    const counts = summarizeCareStoreForDeletion(store!);
    const confirmed = window.confirm(
      `이 기기의 케어 기록을 삭제합니다. 분석 ${counts.sessions}건, 루틴 ${counts.routines}건, 체크인 ${counts.checkIns}건이 삭제됩니다. 계정 서버에 이미 연결된 기록은 삭제되지 않습니다. 계속할까요?`
    );
    if (!confirmed) return;

    const timezone = store!.settings.timezone || "Asia/Seoul";
    window.localStorage.removeItem(CARE_STORAGE_KEY);
    const next = emptyCareStore(timezone);
    saveCareStore(next);
    setStore(next);
    setSource("local");
    setDataMsg("이 기기의 로컬 케어 기록을 삭제했습니다. 서버 연결 기록은 변경하지 않았습니다.");
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-[#FAF7F5] px-4 py-10 text-gray-900">
      <h1 className="text-2xl font-bold tracking-tight">계정 · 케어 설정</h1>
      <p className="mt-1 text-sm text-gray-600">
        본인 계정 정보만 표시됩니다. 관리자 화면에 이메일이 노출되지 않습니다.
      </p>
      <MyCareNav current="/my/settings" />

      <section className="mt-6 rounded-2xl border border-[#E8DFD8] bg-white px-4 py-4 text-sm">
        <h2 className="font-semibold">계정</h2>
        <p className="mt-2">
          이메일:{" "}
          <span className="font-medium">{email ?? "불러오는 중…"}</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/forgot-password" className="text-[#C2185B] underline">
            비밀번호 재설정
          </Link>
          <Link href="/logout" className="text-gray-700 underline">
            로그아웃
          </Link>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-[#E8DFD8] bg-white px-4 py-4 text-sm">
        <h2 className="font-semibold">지역 · 시간</h2>
        <label className="mt-3 block">
          국가
          <select
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            aria-label="국가"
          >
            <option value="KR">한국 (KR)</option>
            <option value="US">미국 (US)</option>
            <option value="JP">일본 (JP)</option>
            <option value="OTHER">기타</option>
          </select>
        </label>
        <label className="mt-3 block">
          시간대
          <input
            className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
            value={store.settings.timezone}
            onChange={(e) => patch({ timezone: e.target.value })}
            aria-label="시간대"
          />
        </label>
      </section>

      <section className="mt-4 rounded-2xl border border-[#E8DFD8] bg-white px-4 py-4 text-sm">
        <h2 className="font-semibold">알림 · Care 동의</h2>
        <p className="mt-2 text-xs text-gray-600">
          Day 3·7·15·30 체크인 알림은 채널별 동의와 중복 방지 규칙을 적용합니다.
        </p>
        <label className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={store.settings.notificationsEnabled}
            onChange={(e) => patch({ notificationsEnabled: e.target.checked })}
          />
          사이트 내 알림
        </label>
        <label className="mt-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={store.settings.emailOptIn}
            onChange={(e) => patch({ emailOptIn: e.target.checked })}
          />
          이메일 알림 희망 (외부 발송은 설정 시에만)
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            조용한 시간 시작
            <select
              className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
              value={store.settings.quietHoursStart}
              onChange={(e) => patch({ quietHoursStart: Number(e.target.value) })}
              aria-label="조용한 시간 시작"
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>{`${String(hour).padStart(2, "0")}:00`}</option>
              ))}
            </select>
          </label>
          <label className="block">
            조용한 시간 종료
            <select
              className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2"
              value={store.settings.quietHoursEnd}
              onChange={(e) => patch({ quietHoursEnd: Number(e.target.value) })}
              aria-label="조용한 시간 종료"
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>{`${String(hour).padStart(2, "0")}:00`}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          조용한 시간 {String(store.settings.quietHoursStart).padStart(2, "0")}:00–
          {String(store.settings.quietHoursEnd).padStart(2, "0")}:00에는 일반 알림을 다음 허용 시간으로 미룹니다. 긴급 위험 신호는 지연하지 않습니다.
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-[#E8DFD8] bg-white px-4 py-4 text-sm">
        <h2 className="font-semibold">기기 기록 연결</h2>
        <p className="mt-2">
          상태:{" "}
          <span className="font-medium">
            {linked ? "계정에 연결됨" : "로컬 기록 별도 유지 가능"}
          </span>
        </p>
        <p className="mt-1 text-xs text-gray-500">
          데이터 출처: {source === "server" ? "서버" : "이 기기(로컬)"}
        </p>
        <button
          type="button"
          disabled={attaching}
          onClick={() => void handleAttach()}
          className="mt-3 rounded-lg bg-[#C2185B] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {attaching ? "연결 중…" : "이 기기의 기록을 계정에 연결"}
        </button>
        {attachMsg ? <p className="mt-2 text-xs text-gray-700">{attachMsg}</p> : null}
        <p className="mt-2 text-xs text-gray-500">
          연결해도 로컬 데이터는 자동 삭제되지 않습니다.
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-[#E8DFD8] bg-white px-4 py-4 text-sm">
        <h2 className="font-semibold">사진 비교 동의</h2>
        <p className="mt-2 text-xs text-gray-600">
          분석만 또는 비교용 저장 중 선택합니다. 저장한 사진은 아래에서 삭제할 수 있습니다.
        </p>
        <div className="mt-3">
          <PhotoConsentPanel />
        </div>
      </section>

      <PhotoAssetsSettingsPanel />

      <section className="mt-4 rounded-2xl border border-[#E8DFD8] bg-white px-4 py-4 text-sm">
        <h2 className="font-semibold">내 데이터 관리</h2>
        <p className="mt-2 text-xs leading-5 text-gray-600">
          아래 기능은 현재 브라우저에 저장된 케어 기록만 대상으로 합니다. 서버에 연결된 계정 기록은 변경하지 않습니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleLocalExport}
            className="rounded-lg border border-[#C2185B] bg-white px-3 py-2 text-xs font-semibold text-[#C2185B]"
          >
            이 기기 기록 다운로드
          </button>
          <button
            type="button"
            onClick={handleLocalDelete}
            className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
          >
            이 기기 기록 삭제
          </button>
        </div>
        {dataMsg ? (
          <p className="mt-3 rounded-lg border border-[#E8DFD8] bg-[#FAF7F5] px-3 py-2 text-xs text-gray-700" role="status">
            {dataMsg}
          </p>
        ) : null}
        <p className="mt-3 text-xs text-gray-500">
          계정 서버 기록 다운로드·삭제 요청은 별도의 본인 확인 절차가 필요하며 Production 운영 단계에서 연결합니다.
        </p>
      </section>
    </main>
  );
}
