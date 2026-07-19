"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { hydrateCareDashboard } from "@/lib/care/client-hydrate";
import { loadCareStore, saveCareStore } from "@/lib/care";
import {
  buildProductFeedback,
  feedbackCompletionLabel,
  upsertProductFeedback,
} from "@/lib/care/productFeedback";
import type { CareAnalysisSession, CareFeedback } from "@/lib/care/types";
import { RANKED_PRODUCTS_STORAGE_KEY } from "@/lib/recommend/types";
import { MyCareNav } from "../MyCareNav";

type RankedItem = {
  id?: string;
  product?: { id?: string; name?: string; name_ko?: string | null; brand?: string };
  name?: string;
  name_ko?: string | null;
  brand?: string;
};

type FeedbackDraft = {
  used: boolean | null;
  purchased: boolean | null;
  satisfaction: number;
  irritation: boolean | null;
  stopReason: string;
  repurchaseIntent: boolean | null;
  concernChange: string;
};

const emptyDraft = (): FeedbackDraft => ({
  used: null,
  purchased: null,
  satisfaction: 5,
  irritation: null,
  stopReason: "",
  repurchaseIntent: null,
  concernChange: "",
});

function productId(item: RankedItem): string {
  return String(item.product?.id ?? item.id ?? "").trim();
}

function productName(item: RankedItem): string {
  return item.product?.name_ko || item.product?.name || item.name_ko || item.name || productId(item) || "제품명 확인 필요";
}

function productBrand(item: RankedItem): string | null {
  return item.product?.brand || item.brand || null;
}

export default function MyRecommendationsPage() {
  const [session, setSession] = useState<CareAnalysisSession | null>(null);
  const [ranked, setRanked] = useState<RankedItem[]>([]);
  const [feedback, setFeedback] = useState<CareFeedback[]>([]);
  const [drafts, setDrafts] = useState<Record<string, FeedbackDraft>>({});
  const [savedProductId, setSavedProductId] = useState<string | null>(null);

  useEffect(() => {
    void hydrateCareDashboard().then((h) => setSession(h.dashboard.sessions[0] ?? null));
    const store = loadCareStore();
    setFeedback(store.feedback ?? []);
    try {
      const parsed = JSON.parse(window.localStorage.getItem(RANKED_PRODUCTS_STORAGE_KEY) || "[]");
      setRanked(Array.isArray(parsed) ? parsed.slice(0, 5) : []);
    } catch {
      setRanked([]);
    }
  }, []);

  const products = useMemo(() => {
    if (ranked.length > 0) return ranked.filter((item) => productId(item));
    return (session?.rankedProductIds ?? []).map((id) => ({ id }));
  }, [ranked, session]);

  function patchDraft(id: string, patch: Partial<FeedbackDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? emptyDraft()), ...patch },
    }));
  }

  function saveFeedback(id: string) {
    const draft = drafts[id] ?? emptyDraft();
    const nextFeedback = buildProductFeedback(
      {
        productId: id,
        used: draft.used,
        purchased: draft.purchased,
        satisfaction: draft.satisfaction,
        irritation: draft.irritation,
        stopReason: draft.stopReason,
        repurchaseIntent: draft.repurchaseIntent,
        concernChange: draft.concernChange,
      },
      {
        id: `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      }
    );
    const store = loadCareStore();
    const next = {
      ...store,
      feedback: upsertProductFeedback(store.feedback ?? [], nextFeedback),
    };
    saveCareStore(next);
    setFeedback(next.feedback);
    setSavedProductId(id);
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-[#FAF7F5] px-4 py-10 text-gray-900">
      <h1 className="text-2xl font-bold">최근 추천과 사용 기록</h1>
      <MyCareNav current="/my/recommendations" />
      <p className="mt-2 text-sm text-gray-600">
        당시 추천 결과를 보존하고, 실제 사용·구매·자극 경험을 기록합니다. 이 기록은 이후 추천 품질과 루틴 조정에 사용됩니다.
      </p>

      {products.length > 0 ? (
        <div className="mt-6 space-y-4">
          {products.map((item) => {
            const id = productId(item);
            const existing = feedback.find((entry) => entry.productId === id) ?? null;
            const draft = drafts[id] ?? emptyDraft();
            return (
              <article key={id} className="rounded-2xl border border-[#E8DFD8] bg-white p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{productName(item)}</h2>
                    {productBrand(item) ? <p className="mt-1 text-xs text-gray-500">{productBrand(item)}</p> : null}
                  </div>
                  <span className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600">
                    {feedbackCompletionLabel(existing)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="font-medium">구매했나요?</span>
                    <select className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2" value={draft.purchased === null ? "" : draft.purchased ? "yes" : "no"} onChange={(e) => patchDraft(id, { purchased: e.target.value === "" ? null : e.target.value === "yes" })}>
                      <option value="">선택</option><option value="yes">구매함</option><option value="no">구매하지 않음</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="font-medium">사용했나요?</span>
                    <select className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2" value={draft.used === null ? "" : draft.used ? "yes" : "no"} onChange={(e) => patchDraft(id, { used: e.target.value === "" ? null : e.target.value === "yes" })}>
                      <option value="">선택</option><option value="yes">사용함</option><option value="no">아직 사용하지 않음</option>
                    </select>
                  </label>
                </div>

                {draft.used === true ? (
                  <div className="mt-4 space-y-4">
                    <label className="block">
                      <span className="font-medium">만족도 0–10</span>
                      <input type="range" min={0} max={10} className="mt-2 w-full" value={draft.satisfaction} onChange={(e) => patchDraft(id, { satisfaction: Number(e.target.value) })} />
                      <span className="text-xs tabular-nums text-gray-500">{draft.satisfaction}</span>
                    </label>
                    <label className="block">
                      <span className="font-medium">자극이 있었나요?</span>
                      <select className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2" value={draft.irritation === null ? "" : draft.irritation ? "yes" : "no"} onChange={(e) => patchDraft(id, { irritation: e.target.value === "" ? null : e.target.value === "yes" })}>
                        <option value="">선택</option><option value="yes">있었음</option><option value="no">없었음</option>
                      </select>
                    </label>
                    {draft.irritation === true ? (
                      <label className="block"><span className="font-medium">중단 이유·자극 증상</span><textarea className="mt-1 min-h-24 w-full rounded-lg border border-rose-200 px-3 py-2" maxLength={200} value={draft.stopReason} onChange={(e) => patchDraft(id, { stopReason: e.target.value })} /></label>
                    ) : null}
                    <label className="block"><span className="font-medium">피부 고민 변화</span><textarea className="mt-1 min-h-24 w-full rounded-lg border border-[#E8DFD8] px-3 py-2" maxLength={300} placeholder="예: 건조함이 줄었지만 볼의 붉은기는 비슷함" value={draft.concernChange} onChange={(e) => patchDraft(id, { concernChange: e.target.value })} /></label>
                    <label className="block"><span className="font-medium">다시 구매할 의향</span><select className="mt-1 w-full rounded-lg border border-[#E8DFD8] bg-white px-3 py-2" value={draft.repurchaseIntent === null ? "" : draft.repurchaseIntent ? "yes" : "no"} onChange={(e) => patchDraft(id, { repurchaseIntent: e.target.value === "" ? null : e.target.value === "yes" })}><option value="">선택</option><option value="yes">있음</option><option value="no">없음</option></select></label>
                  </div>
                ) : null}

                <button type="button" onClick={() => saveFeedback(id)} className="mt-4 rounded-lg bg-[#C2185B] px-4 py-2 font-semibold text-white">사용 경험 저장</button>
                {savedProductId === id ? <p className="mt-2 text-xs text-emerald-700">이 기기의 케어 기록에 저장했습니다.</p> : null}
                {existing?.irritation === true ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">자극 경험이 기록되어 있습니다. 증상이 지속되거나 심해지면 제품 사용을 중단하고 체크인 또는 전문가 확인을 우선하세요.</p> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm"><Link href="/analyze" className="text-[#8B6914] underline">분석하기</Link></p>
      )}
    </main>
  );
}
