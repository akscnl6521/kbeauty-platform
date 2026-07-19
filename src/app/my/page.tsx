"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  countdownLabel,
  saveAnalysisSessionFromLocalRecommendation,
} from "@/lib/care";
import {
  hydrateCareDashboard,
  type CareHydrateResult,
} from "@/lib/care/client-hydrate";
import {
  managementLevelLabel,
  referralLabel,
  referralTone,
  summarizeCareDashboard,
} from "@/lib/care/dashboardSummary";
import {
  ANALYSIS_RESULT_STORAGE_KEY,
  RANKED_PRODUCTS_STORAGE_KEY,
  RECOMMENDATION_STORAGE_KEY,
} from "@/lib/recommend/types";
import { MyCareNav } from "./MyCareNav";
import { journeyActionHref } from "@/lib/user/next-action";
import { resolveUserJourney } from "@/lib/user/journey";

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

/**
 * Personal care home — what to do today.
 */
export default function MyCareHomePage() {
  const [hydrated, setHydrated] = useState<CareHydrateResult | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [hasLocalAnalysis, setHasLocalAnalysis] = useState(false);

  useEffect(() => {
    setHasLocalAnalysis(
      Boolean(window.localStorage.getItem(RECOMMENDATION_STORAGE_KEY))
    );
    void hydrateCareDashboard().then(setHydrated);
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
  const summary = useMemo(
    () =>
      summarizeCareDashboard({
        sessions: dashboard?.sessions ?? [],
        checkIns: dashboard?.checkIns ?? [],
      }),
    [dashboard?.sessions, dashboard?.checkIns]
  );
  const due = summary.nextCheckIn;
  const unread = dashboard?.unreadNotifications ?? 0;
  const activeItems =
    dashboard?.activeRoutine?.items.filter((i) => i.active).length ?? 0;
  const sourceLabel =
    hydrated?.source === "server" ? "서버 동기화" : "이 기기(local)";
  const latest = summary.latestSession;
  const tone = referralTone(summary.referralLevel);
  const journey = resolveUserJourney({
    authenticated: true,
    emailConfirmed: true,
    hasLocalAnalysis,
    hasLocalCare: Boolean(dashboard?.sessions.length),
    onboardingComplete: Boolean(dashboard?.sessions.length),
    hasRoutine: Boolean(dashboard?.activeRoutine),
    hasDueCheckIn: Boolean(due?.status === "due"),
    referralLevel: summary.referralLevel,
    syncError: hydrated?.source === "local",
  });

  const referralClass =
    tone === "urgent"
      ? "border-red-300 bg-red-50 text-red-950"
      : tone === "warning"
        ? "border-amber-300 bg-amber-50 text-amber-950"
        : "border-emerald-200 bg-emerald-50 text-emerald-950";

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-[#FAF7F5] px-4 py-10 text-gray-900">
      <h1 className="text-3xl font-bold tracking-tight">내 케어</h1>
      <p className="mt-2 text-sm text-gray-600">
        이전 분석부터 다음 체크인까지 한곳에서 확인합니다.
      </p>
      <MyCareNav current="/my" />

      <p className="mt-2 text-xs text-gray-500">데이터 출처: {sourceLabel}</p>
      {hydrated?.source === "local" ? (
        <p className="mt-2 text-xs text-rose-700">
          서버 동기화 실패, 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}

      {savedMsg ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {savedMsg}
        </p>
      ) : null}

      <section className={`mt-6 rounded-2xl border px-4 py-4 ${referralClass}`}>
        <p className="text-xs font-semibold uppercase tracking-wide">상담 필요 여부</p>
        <h2 className="mt-1 text-lg font-bold">{referralLabel(summary.referralLevel)}</h2>
        {tone === "urgent" ? (
          <p className="mt-2 text-sm">
            호흡 곤란, 전신 알레르기, 급격한 붓기처럼 위급한 증상이 있다면 제품 사용을 중단하고 지역 응급서비스나 의료기관에 즉시 문의하세요.
          </p>
        ) : tone === "warning" ? (
          <p className="mt-2 text-sm">
            제품 구매보다 증상 확인을 우선하고, 체크인 기록을 의료진 상담 시 참고 자료로 활용하세요.
          </p>
        ) : (
          <p className="mt-2 text-sm">
            새 통증, 진물, 출혈, 급격한 붓기 또는 퍼지는 발진이 생기면 다음 체크인 날짜를 기다리지 말고 확인하세요.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-pink-200 bg-white px-4 py-4">
        <h2 className="text-lg font-semibold">지금 할 일</h2>
        <p className="mt-2 text-sm text-gray-600">{journey.label}</p>
        <Link
          href={journeyActionHref(journey.primaryAction)}
          className="touch-target mt-3 inline-flex items-center rounded-lg bg-[#C2185B] px-4 py-2 text-sm font-semibold text-white"
        >
          {journey.label}
        </Link>
      </section>

      <section className="mt-6 rounded-2xl border border-[#E8DFD8] bg-white px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">최근 분석</p>
            <h2 className="mt-1 text-lg font-semibold">
              {managementLevelLabel(latest)}
            </h2>
          </div>
          <p className="text-xs text-gray-500">{formatDate(latest?.createdAt)}</p>
        </div>
        {latest ? (
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            <p>
              주요 고민: {latest.concerns.length > 0 ? latest.concerns.join(", ") : "등록 없음"}
            </p>
            <p>
              분석 신뢰도: {typeof latest.dataConfidence === "number"
                ? `${Math.round(latest.dataConfidence * 100)}%`
                : "확인 전"}
            </p>
            <p>추천 제품 기록: {latest.rankedProductIds.length}개</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-600">
            저장된 분석이 없습니다. 피부 분석을 완료하면 이곳에 관리 단계가 표시됩니다.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-[#E8DFD8] bg-white px-4 py-4">
        <h2 className="text-lg font-semibold">다음 체크인</h2>
        {due ? (
          <div className="mt-3 text-sm">
            <p className="font-medium">
              Day {due.day} · {countdownLabel(due.dueAt)}
            </p>
            <p className="mt-1 text-gray-600">
              상태: {due.status === "due" ? "지금 작성 가능" : "예약됨"}
            </p>
            <Link
              href={`/my/check-ins/${due.id}`}
              className="touch-target mt-3 inline-flex items-center rounded-lg bg-[#C2185B] px-4 py-2 font-semibold text-white"
            >
              {due.status === "due" ? "체크인 하기" : "체크인 일정 보기"}
            </Link>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-600">
            예정된 체크인이 없습니다. 새 분석을 저장하면 Day 3·7·15·30 일정이 자동 생성됩니다.
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

      <section className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3">
          <p className="text-xs text-gray-500">읽지 않은 알림</p>
          <p className="text-xl font-semibold tabular-nums">{unread}</p>
        </div>
        <div className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3">
          <p className="text-xs text-gray-500">활성 루틴 단계</p>
          <p className="text-xl font-semibold tabular-nums">{activeItems}</p>
        </div>
        <div className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3">
          <p className="text-xs text-gray-500">분석 기록</p>
          <p className="text-xl font-semibold tabular-nums">
            {dashboard?.sessions.length ?? 0}
          </p>
        </div>
      </section>

      <p className="mt-8 text-xs text-gray-500">
        의료 진단·치료를 제공하지 않습니다. 심한 증상은 전문가·응급서비스에 문의하세요. 로그인 시 서버에 저장되며, 미로그인 시 이 기기에만 저장됩니다.
      </p>
    </main>
  );
}
