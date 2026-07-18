"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  countdownLabel,
  saveAnalysisSessionFromLocalRecommendation,
} from "@/lib/care";
import {
  hydrateCareDashboard,
  type CareHydrateResult,
} from "@/lib/care/client-hydrate";
import {
  ANALYSIS_RESULT_STORAGE_KEY,
  RANKED_PRODUCTS_STORAGE_KEY,
  RECOMMENDATION_STORAGE_KEY,
} from "@/lib/recommend/types";
import { MyCareNav } from "./MyCareNav";
import { journeyActionHref } from "@/lib/user/next-action";
import { resolveUserJourney } from "@/lib/user/journey";
import { StatusMessage } from "@/components/ui/JourneyChrome";

/**
 * Personal care home — what to do today.
 */
export default function MyCareHomePage() {
  const [hydrated, setHydrated] = useState<CareHydrateResult | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
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
  const due = dashboard?.nextDueCheckIn ?? null;
  const unread = dashboard?.unreadNotifications ?? 0;
  const activeItems =
    dashboard?.activeRoutine?.items.filter((i) => i.active).length ?? 0;
  const sourceLabel =
    hydrated?.source === "server" ? "서버 동기화" : "이 기기(local)";
  const referralLevel = dashboard?.checkIns.find((checkIn) => checkIn.referralLevel !== "none")?.referralLevel ?? "none";
  const journey = resolveUserJourney({
    authenticated: true,
    emailConfirmed: true,
    hasLocalAnalysis:
      typeof window !== "undefined" &&
      Boolean(window.localStorage.getItem(RECOMMENDATION_STORAGE_KEY)),
    hasLocalCare: Boolean(dashboard?.sessions.length),
    onboardingComplete: Boolean(dashboard?.sessions.length),
    hasRoutine: Boolean(dashboard?.activeRoutine),
    hasDueCheckIn: Boolean(due),
    referralLevel,
    syncError: hydrated?.source === "local",
  });

  return (
    <main className="kb-surface mx-auto min-h-screen max-w-3xl overflow-x-hidden px-4 py-10 text-gray-900">
      <p className="kb-eyebrow">내 관리</p>
      <h1 className="kb-display mt-2 text-3xl">내 케어</h1>
      <p className="kb-lead mt-2 text-sm">
        오늘은 무엇을 하면 될까요? 정상 흐름은 자동으로, 위험 신호만 강조합니다.
      </p>
      <MyCareNav current="/my" />

      <p className="mt-2 text-xs text-[var(--text-subtle)]">데이터 출처: {sourceLabel}</p>
      {hydrated?.source === "local" ? (
        <div className="mt-3">
          <StatusMessage tone="error">서버 동기화 실패, 잠시 후 다시 시도해 주세요.</StatusMessage>
        </div>
      ) : null}

      {savedMsg ? (
        <p className="mt-4 kb-status-info text-sm text-emerald-900" role="status">
          {savedMsg}
        </p>
      ) : null}

      <section className="kb-panel mt-8">
        <h2 className="text-lg font-semibold">지금 할 일</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{journey.label}</p>
        <Link
          href={journeyActionHref(journey.primaryAction)}
          className="kb-btn kb-btn-primary mt-4"
        >
          {journey.label}
        </Link>
      </section>

      <section className="mt-6 space-y-4">
        <div className="border-t border-[var(--border-soft)] pt-5">
          <h2 className="text-lg font-semibold">다음 체크인</h2>
          {due ? (
            <div className="mt-3 text-sm">
              <p>
                Day {due.day} · {countdownLabel(due.dueAt)} · {due.status}
              </p>
              <Link
                href={`/my/check-ins/${due.id}`}
                className="kb-btn kb-btn-primary mt-3"
              >
                체크인 하기
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              아직 예약한 체크인이 없습니다. 분석을 저장하면 Day 3/7/15/30이
              준비됩니다.
            </p>
          )}
        </div>

        <div className="border-t border-[var(--border-soft)] pt-5">
          <h2 className="text-lg font-semibold">현재 루틴</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            활성 단계 {activeItems}개
          </p>
          <Link href="/my/routine" className="mt-2 inline-block text-sm font-semibold text-[var(--brand)] underline-offset-4 hover:underline">
            루틴 보기
          </Link>
        </div>

        <div className="border-t border-[var(--border-soft)] pt-5">
          <h2 className="text-lg font-semibold">최근 분석·추천</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            분석 기록 {dashboard?.sessions.length ?? 0}건 · 알림 {unread}건
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/my/analyses" className="kb-btn kb-btn-secondary text-sm">
              분석 기록
            </Link>
            <Link href="/my/recommendations" className="kb-btn kb-btn-secondary text-sm">
              추천 기록
            </Link>
            <Link href="/my/settings" className="kb-btn kb-btn-ghost text-sm">
              설정
            </Link>
          </div>
          {!dashboard?.sessions.length ? (
            <Link href="/onboarding" className="mt-3 inline-block text-sm font-medium text-[var(--brand)] underline-offset-4 hover:underline">
              피부 관리 설정하기
            </Link>
          ) : null}
          <button
            type="button"
            onClick={importLatestAnalysis}
            className="kb-btn kb-btn-secondary mt-4 text-sm"
          >
            최근 분석 결과 저장·추적 시작
          </button>
        </div>
      </section>

      <p className="mt-8 text-xs text-[var(--text-subtle)]">
        의료 진단·치료를 제공하지 않습니다. 심한 증상은 전문가·응급서비스에
        문의하세요. 로그인 시 서버에 저장되며, 미로그인 시 이 기기에만
        저장됩니다.
      </p>
    </main>
  );
}
