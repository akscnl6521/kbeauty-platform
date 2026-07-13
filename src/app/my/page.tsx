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

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-[#FAF7F5] px-4 py-10 text-gray-900">
      <h1 className="text-3xl font-bold tracking-tight">내 케어</h1>
      <p className="mt-2 text-sm text-gray-600">
        오늘은 무엇을 하면 될까요? 정상 흐름은 자동으로, 위험 신호만 강조합니다.
      </p>
      <MyCareNav current="/my" />

      <p className="mt-2 text-xs text-gray-500">데이터 출처: {sourceLabel}</p>

      {savedMsg ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {savedMsg}
        </p>
      ) : null}

      <section className="mt-8 rounded-lg border border-[#E8DFD8] bg-white px-4 py-4">
        <h2 className="text-lg font-semibold">다음 할 일</h2>
        {due ? (
          <div className="mt-3 text-sm">
            <p>
              Day {due.day} 체크인 · {countdownLabel(due.dueAt)} · {due.status}
            </p>
            <Link
              href={`/my/check-ins/${due.id}`}
              className="mt-3 inline-block rounded-lg bg-[#8B6914] px-4 py-2 text-white"
            >
              체크인 하기
            </Link>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-600">
            예정된 체크인이 없습니다. 분석을 저장하면 자동 예약됩니다.
          </p>
        )}
        <button
          type="button"
          onClick={importLatestAnalysis}
          className="mt-4 rounded-lg border border-[#E8DFD8] px-3 py-2 text-sm"
        >
          최근 분석 결과 저장·추적 시작
        </button>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-3 text-sm">
        <div className="rounded-lg border border-[#E8DFD8] bg-white px-3 py-3">
          <p className="text-xs text-gray-500">알림</p>
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
        의료 진단·치료를 제공하지 않습니다. 심한 증상은 전문가·응급서비스에
        문의하세요. 로그인 시 서버에 저장되며, 미로그인 시 이 기기에만
        저장됩니다.
      </p>
    </main>
  );
}
