"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  countdownLabel,
  loadCareStore,
  nextDueCheckIn,
  refreshCareDueState,
  saveAnalysisSessionFromLocalRecommendation,
  type CareStoreSnapshot,
} from "@/lib/care";
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
  const [store, setStore] = useState<CareStoreSnapshot | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setStore(refreshCareDueState());
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
      setStore(next);
      setSavedMsg("분석을 케어 기록으로 저장하고 Day 3/7/15/30 체크인을 예약했습니다.");
    } catch {
      setSavedMsg("가져오기에 실패했습니다.");
    }
  }

  const due = store ? nextDueCheckIn(store.checkIns) : null;
  const unread = store?.notifications.filter((n) => !n.read).length ?? 0;
  const activeItems =
    store?.routines[0]?.items.filter((i) => i.active).length ?? 0;

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-[#FAF7F5] px-4 py-10 text-gray-900">
      <h1 className="text-3xl font-bold tracking-tight">내 케어</h1>
      <p className="mt-2 text-sm text-gray-600">
        오늘은 무엇을 하면 될까요? 정상 흐름은 자동으로, 위험 신호만 강조합니다.
      </p>
      <MyCareNav current="/my" />

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
            {store?.sessions.length ?? 0}
          </p>
        </div>
      </section>

      <p className="mt-8 text-xs text-gray-500">
        의료 진단·치료를 제공하지 않습니다. 심한 증상은 전문가·응급서비스에
        문의하세요. 데이터는 현재 이 기기(local)에 저장되며, 서버 저장은
        migration 승인 후 활성화됩니다.
      </p>
    </main>
  );
}
