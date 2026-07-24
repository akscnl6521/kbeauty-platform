"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { countdownLabel, saveAnalysisSessionFromLocalRecommendation } from "@/lib/care";
import {
  hydrateCareDashboard,
  type CareHydrateResult,
} from "@/lib/care/client-hydrate";
import {
  QUICK_SKIN_CHECK_CHOICES,
  followUpQuestions,
  needsFollowUpQuestions,
  toProgressNote,
  type QuickSkinCheckChoice,
} from "@/lib/care/quickSkinCheck";
import {
  getRevisitDashboardSummary,
  type RevisitDashboardSummary,
} from "@/lib/care/revisitDashboard";
import {
  ANALYSIS_RESULT_STORAGE_KEY,
  RANKED_PRODUCTS_STORAGE_KEY,
  RECOMMENDATION_STORAGE_KEY,
} from "@/lib/recommend/types";
import { MyCareNav } from "./MyCareNav";

type PhotoConsentState = {
  loaded: boolean;
  saveForComparison: boolean;
  migrationPending: boolean;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "기록 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "날짜 확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function referralClass(tone: RevisitDashboardSummary["referral"]["tone"]): string {
  if (tone === "urgent") return "border-red-300 bg-red-50 text-red-950";
  if (tone === "warning") return "border-amber-300 bg-amber-50 text-amber-950";
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

function uiStateLabel(state: RevisitDashboardSummary["uiState"]): string {
  switch (state) {
    case "logged_out":
      return "로그인 후 서버에 기록을 저장할 수 있습니다";
    case "no_analysis":
      return "저장된 분석이 없습니다";
    case "analysis_only":
      return "분석만 있고 루틴은 아직 없습니다";
    case "routine_active":
      return "루틴을 진행 중입니다";
    case "checkin_scheduled":
      return "다음 체크인이 예약되어 있습니다";
    case "checkin_overdue":
      return "작성 가능한 체크인이 있습니다";
    case "worsening":
      return "악화·상담 신호를 확인하세요";
    case "photo_no_consent":
      return "사진 비교 저장은 선택 사항입니다";
    case "photo_feature_pending":
      return "사진 저장 기능 준비 중";
    case "partial_data":
      return "일부 기록이 비어 있습니다";
    case "api_error":
      return "동기화 오류";
    case "on_track":
      return "오늘도 기록을 이어가세요";
    default:
      return "";
  }
}

async function loadPhotoConsent(): Promise<PhotoConsentState> {
  try {
    const res = await fetch("/api/care/photo-consents", { credentials: "include" });
    if (res.status === 401) {
      return { loaded: true, saveForComparison: false, migrationPending: false };
    }
    if (!res.ok) {
      return { loaded: false, saveForComparison: false, migrationPending: false };
    }
    const json = (await res.json()) as {
      ok?: boolean;
      data?: {
        migrationPending?: boolean;
        stored?: { choices?: { saveForComparison?: boolean } } | null;
        defaults?: { saveForComparison?: boolean };
      };
    };
    const migrationPending = Boolean(json.data?.migrationPending);
    const saveForComparison = Boolean(
      json.data?.stored?.choices?.saveForComparison ??
        json.data?.defaults?.saveForComparison
    );
    return { loaded: true, saveForComparison, migrationPending };
  } catch {
    return { loaded: false, saveForComparison: false, migrationPending: false };
  }
}

/**
 * Personal care home — revisit dashboard (mobile-first).
 */
export default function MyCareHomePage() {
  const [hydrated, setHydrated] = useState<CareHydrateResult | null>(null);
  const [photoConsent, setPhotoConsent] = useState<PhotoConsentState>({
    loaded: false,
    saveForComparison: false,
    migrationPending: false,
  });
  const [authenticated, setAuthenticated] = useState(true);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [hasLocalAnalysis, setHasLocalAnalysis] = useState(false);
  const [quickChoice, setQuickChoice] = useState<QuickSkinCheckChoice | null>(null);
  const [quickNote, setQuickNote] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time hydrate from localStorage; server render must start false, browser value applied post-mount
    setHasLocalAnalysis(
      Boolean(window.localStorage.getItem(RECOMMENDATION_STORAGE_KEY))
    );
    void Promise.all([hydrateCareDashboard(), loadPhotoConsent()]).then(
      ([nextHydrated, consent]) => {
        setHydrated(nextHydrated);
        setPhotoConsent(consent);
        if (nextHydrated.source === "local") {
          void fetch("/api/care/dashboard", { credentials: "include" }).then((res) => {
            if (res.status === 401) setAuthenticated(false);
          });
        }
      }
    );
  }, []);

  function importLatestAnalysis() {
    try {
      const analysis = JSON.parse(
        window.localStorage.getItem(ANALYSIS_RESULT_STORAGE_KEY) || "null"
      );
      const recommendation = JSON.parse(
        window.localStorage.getItem(RECOMMENDATION_STORAGE_KEY) || "null"
      );
      const ranked = JSON.parse(
        window.localStorage.getItem(RANKED_PRODUCTS_STORAGE_KEY) || "[]"
      );
      if (!recommendation) {
        setSavedMsg("저장된 추천이 없습니다. /analyze에서 먼저 분석하세요.");
        return;
      }
      const rankedIds = Array.isArray(ranked)
        ? ranked
            .map((r: { product?: { id?: string }; id?: string }) =>
              String(r?.product?.id ?? r?.id ?? "")
            )
            .filter(Boolean)
        : [];

      if (hydrated?.source === "server") {
        void fetch("/api/care/analyses", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timezone:
              Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul",
            country: "KR",
            skinType: null,
            sensitivity: null,
            concerns: recommendation.skinConcerns ?? [],
            toneDepth: null,
            undertone: null,
            allergyIngredients: recommendation.allergyIngredients ?? [],
            avoidedIngredients: recommendation.avoidedIngredients ?? [],
            analysisSnapshot:
              analysis && typeof analysis === "object" ? analysis : {},
            recommendationSnapshot: recommendation,
            rankedProductIds: rankedIds,
            dataConfidence:
              typeof recommendation.confidenceScore === "number"
                ? recommendation.confidenceScore
                : null,
            consentCareTracking: true,
          }),
        }).then(async (res) => {
          if (res.ok) {
            const next = await hydrateCareDashboard();
            setHydrated(next);
            setSavedMsg("서버에 분석을 저장하고 체크인을 예약했습니다.");
          } else {
            setSavedMsg("서버 저장에 실패했습니다. 로컬에 저장합니다.");
            saveLocal();
          }
        });
        return;
      }

      saveLocal();

      function saveLocal() {
        const next = saveAnalysisSessionFromLocalRecommendation({
          analysis: analysis && typeof analysis === "object" ? analysis : {},
          recommendation,
          rankedProductIds: rankedIds,
          allergyIngredients: recommendation.allergyIngredients ?? [],
          avoidedIngredients: recommendation.avoidedIngredients ?? [],
          concerns: recommendation.skinConcerns ?? [],
          skinType: null,
          sensitivity: null,
          undertone: null,
          toneDepth: null,
          country: "KR",
          consentCareTracking: true,
        });
        setHydrated({
          source: "local",
          dashboard: {
            linkedAccount: false,
            source: "server",
            sessions: next.sessions,
            activeRoutine: next.routines[0] ?? null,
            checkIns: next.checkIns,
            suggestions: next.suggestions,
            notifications: next.notifications,
            progressSummary: [],
            unreadNotifications: next.notifications.filter((n) => !n.read)
              .length,
            nextDueCheckIn: next.checkIns.find((c) => c.status === "due") ?? null,
            settings: next.settings,
          },
          localStore: next,
        });
        setSavedMsg(
          "분석을 케어 기록으로 저장하고 Day 3/7/15/30 체크인을 예약했습니다."
        );
      }
    } catch {
      setSavedMsg("가져오기에 실패했습니다.");
    }
  }

  const dashboard = hydrated?.dashboard;
  const revisit = useMemo(
    () =>
      getRevisitDashboardSummary({
        authenticated,
        sessions: dashboard?.sessions ?? [],
        checkIns: dashboard?.checkIns ?? [],
        activeRoutine: dashboard?.activeRoutine ?? null,
        progressDeltas: dashboard?.progressSummary,
        syncError: hydrated?.source === "local" && authenticated,
        photoConsent,
      }),
    [authenticated, dashboard, hydrated?.source, photoConsent]
  );

  const sourceLabel =
    hydrated?.source === "server" ? "서버 동기화" : "이 기기(local)";
  const unread = dashboard?.unreadNotifications ?? 0;
  const showReferral =
    revisit.referral.tone !== "normal" || revisit.uiState === "worsening";

  function onQuickPick(choice: QuickSkinCheckChoice) {
    setQuickChoice(choice);
    setQuickNote(toProgressNote(choice));
  }

  const section = (key: string, node: ReactNode | null) =>
    revisit.sectionsOrder.includes(key) ? node : null;

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-[#FAF7F5] px-4 py-10 text-gray-900">
      <h1 className="text-3xl font-bold tracking-tight">내 케어</h1>
      <p className="mt-2 text-sm text-gray-600">
        이전 분석부터 다음 체크인까지 한곳에서 확인합니다.
      </p>
      <MyCareNav current="/my" />

      <p className="mt-2 text-xs text-gray-500">데이터 출처: {sourceLabel}</p>
      {hydrated?.source === "local" && authenticated ? (
        <p className="mt-2 text-xs text-rose-700">
          서버 동기화 실패, 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}

      {savedMsg ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {savedMsg}
        </p>
      ) : null}

      {section(
        "next_action",
        <section className="mt-6 rounded-2xl border-2 border-[#C2185B] bg-white px-4 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#C2185B]">
            다음 할 일
          </p>
          <h2 className="mt-1 text-lg font-bold">{revisit.nextAction.label}</h2>
          <p className="mt-1 text-sm text-gray-600">{revisit.nextAction.priorityReason}</p>
          <Link
            href={revisit.nextAction.href}
            className="touch-target mt-3 inline-flex items-center rounded-lg bg-[#C2185B] px-4 py-2 text-sm font-semibold text-white"
          >
            {revisit.nextAction.label}
          </Link>
        </section>
      )}

      {section(
        "status",
        <section className="mt-4 rounded-2xl border border-[#E8DFD8] bg-white px-4 py-4">
          <p className="text-xs text-gray-500">오늘 상태</p>
          <p className="mt-1 text-sm font-medium">{uiStateLabel(revisit.uiState)}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
            <span className="rounded-full border border-[#E8DFD8] px-2 py-1">
              {revisit.managementLabel}
            </span>
            {revisit.lastAnalysisAt ? (
              <span className="rounded-full border border-[#E8DFD8] px-2 py-1">
                최근 분석 {formatDate(revisit.lastAnalysisAt)}
              </span>
            ) : null}
          </div>
        </section>
      )}

      {section(
        "consultation",
        showReferral ? (
          <section
            className={`mt-4 rounded-2xl border px-4 py-4 ${referralClass(revisit.referral.tone)}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide">상담 필요 여부</p>
            <h2 className="mt-1 text-lg font-bold">{revisit.referral.label}</h2>
            {revisit.referral.tone === "urgent" ? (
              <p className="mt-2 text-sm">
                호흡 곤란, 전신 알레르기, 급격한 붓기처럼 위급한 증상이 있다면 제품
                사용을 중단하고 지역 응급서비스나 의료기관에 즉시 문의하세요.
              </p>
            ) : revisit.referral.tone === "warning" ? (
              <p className="mt-2 text-sm">
                제품 구매보다 증상 확인을 우선하고, 체크인 기록을 의료진 상담 시 참고
                자료로 활용하세요.
              </p>
            ) : null}
            <Link
              href="/my/guidance"
              className="touch-target mt-3 inline-flex text-sm font-semibold underline"
            >
              사용·상담 가이드 보기
            </Link>
          </section>
        ) : null
      )}

      {section(
        "quick_check",
        revisit.quickCheckVisible ? (
          <section className="mt-4 rounded-2xl border border-[#E8DFD8] bg-white px-4 py-4">
            <h2 className="text-lg font-semibold">오늘 피부는 어떤가요?</h2>
            <p className="mt-1 text-xs text-gray-500">
              이 화면의 선택은 기기에만 남습니다. 공식 기록은 체크인에서 작성하세요.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {QUICK_SKIN_CHECK_CHOICES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onQuickPick(opt.value)}
                  className={`touch-target rounded-lg border px-3 py-2 text-sm font-medium ${
                    quickChoice === opt.value
                      ? "border-[#C2185B] bg-pink-50 text-[#C2185B]"
                      : "border-[#E8DFD8] bg-[#FAF7F5]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {quickNote ? (
              <p className="mt-3 text-sm text-gray-700">{quickNote}</p>
            ) : null}
            {quickChoice && needsFollowUpQuestions(quickChoice) ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
                {followUpQuestions(quickChoice).map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            ) : null}
            {revisit.uiState === "checkin_overdue" && revisit.nextCheckIn ? (
              <Link
                href={`/my/check-ins/${revisit.nextCheckIn.id}`}
                className="touch-target mt-3 inline-flex text-sm font-semibold text-[#C2185B] underline"
              >
                정식 체크인 작성하기
              </Link>
            ) : null}
          </section>
        ) : null
      )}

      {section(
        "next_checkin",
        <section className="mt-4 rounded-2xl border border-[#E8DFD8] bg-white px-4 py-4">
          <h2 className="text-lg font-semibold">다음 체크인</h2>
          {revisit.nextCheckIn ? (
            <div className="mt-3 text-sm">
              <p className="font-medium">
                Day {revisit.nextCheckIn.day} · {countdownLabel(revisit.nextCheckIn.dueAt)}
              </p>
              <p className="mt-1 text-gray-600">상태: {revisit.nextCheckIn.label}</p>
              {revisit.latestCheckInAnswerSummary ? (
                <p className="mt-1 text-gray-600">
                  최근 응답: {revisit.latestCheckInAnswerSummary}
                </p>
              ) : null}
              <Link
                href={`/my/check-ins/${revisit.nextCheckIn.id}`}
                className="touch-target mt-3 inline-flex items-center rounded-lg border border-[#E8DFD8] px-4 py-2 font-semibold text-[#C2185B]"
              >
                {revisit.nextCheckIn.status === "due" ? "체크인 하기" : "체크인 일정 보기"}
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-600">
              예정된 체크인이 없습니다. 새 분석을 저장하면 Day 3·7·15·30 일정이 자동
              생성됩니다.
            </p>
          )}
          {!dashboard?.sessions.length ? (
            <Link
              href="/onboarding"
              className="mt-3 inline-block text-sm font-medium text-[#C2185B] underline"
            >
              피부 관리 설정하기
            </Link>
          ) : null}
          {hasLocalAnalysis ? (
            <button
              type="button"
              onClick={importLatestAnalysis}
              className="touch-target mt-4 rounded-lg border border-[#E8DFD8] px-3 py-2 text-sm"
            >
              최근 분석 다시 동기화
            </button>
          ) : null}
        </section>
      )}

      {section(
        "routine",
        revisit.activeRoutineTitle ? (
          <section className="mt-4 rounded-2xl border border-[#E8DFD8] bg-white px-4 py-4">
            <h2 className="text-lg font-semibold">현재 루틴</h2>
            <p className="mt-2 text-sm text-gray-700">{revisit.activeRoutineTitle}</p>
            <p className="mt-1 text-sm text-gray-600">
              활성 단계 {revisit.activeItemCount}개
            </p>
            <Link
              href="/my/routine"
              className="touch-target mt-3 inline-flex text-sm font-semibold text-[#C2185B] underline"
            >
              루틴 상세 보기
            </Link>
          </section>
        ) : null
      )}

      {section(
        "concerns",
        <section className="mt-4 rounded-2xl border border-[#E8DFD8] bg-white px-4 py-4">
          <h2 className="text-lg font-semibold">최근 변화·고민</h2>
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            <p>
              주요 고민:{" "}
              {revisit.primaryConcerns.length > 0
                ? revisit.primaryConcerns.join(", ")
                : "등록 없음"}
            </p>
            {revisit.focusAreas.length > 0 ? (
              <p>집중 영역: {revisit.focusAreas.join(", ")}</p>
            ) : null}
            {revisit.latestCheckInAnswerSummary ? (
              <p>최근 체크인: {revisit.latestCheckInAnswerSummary}</p>
            ) : null}
          </div>
        </section>
      )}

      {section(
        "photo",
        <section className="mt-4 rounded-2xl border border-[#E8DFD8] bg-white px-4 py-4">
          <h2 className="text-lg font-semibold">사진 비교</h2>
          <p className="mt-2 text-sm text-gray-700">{revisit.photoStatus.label}</p>
          {revisit.photoStatus.kind === "pending_migration" ? (
            <p className="mt-2 text-sm text-amber-800">
              사진 저장 기능 준비 중입니다. Staging migration 적용 전까지는 업로드가
              제한됩니다.
            </p>
          ) : null}
          {revisit.photoStatus.kind === "saved_enabled" ? (
            <Link
              href="/my/progress"
              className="touch-target mt-3 inline-flex text-sm font-semibold text-[#C2185B] underline"
            >
              변화 기록 화면으로
            </Link>
          ) : (
            <Link
              href="/my/settings"
              className="touch-target mt-3 inline-flex text-sm font-medium text-[#8B6914] underline"
            >
              설정에서 동의 관리
            </Link>
          )}
        </section>
      )}

      {section(
        "stats",
        <section className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3">
            <p className="text-xs text-gray-500">읽지 않은 알림</p>
            <p className="text-xl font-semibold tabular-nums">{unread}</p>
          </div>
          <div className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3">
            <p className="text-xs text-gray-500">완료 체크인</p>
            <p className="text-xl font-semibold tabular-nums">
              {revisit.progress.completedCount}
            </p>
          </div>
          <div className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3">
            <p className="text-xs text-gray-500">분석 기록</p>
            <p className="text-xl font-semibold tabular-nums">
              {dashboard?.sessions.length ?? 0}
            </p>
          </div>
        </section>
      )}

      <p className="mt-8 text-xs text-gray-500">
        의료 진단·치료를 제공하지 않습니다. 심한 증상은 전문가·응급서비스에 문의하세요.
        로그인 시 서버에 저장되며, 미로그인 시 이 기기에만 저장됩니다.
      </p>
    </main>
  );
}
