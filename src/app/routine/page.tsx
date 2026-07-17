"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/hooks/useLocale";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { supabase } from "@/lib/supabase";
import {
  displayBrandName,
  displayProductTitle,
} from "@/lib/brand/displayBrandName";
import { RANKED_PRODUCTS_STORAGE_KEY } from "@/lib/recommend/types";

type Locale = "en" | "ja" | "ko";

type ProductRow = {
  id: string;
  name: string;
  name_ja: string | null;
  name_ko: string | null;
  brand: string;
  category: string | null;
  price_usd: number | null;
};

const ROUTINE_ORDER: string[] = [
  "Cleanser",
  "Toner",
  "Serum",
  "Essence",
  "Ampoule",
  "Cream",
  "SPF",
  "Other",
];

const ROUTINE_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    Cleanser: "Cleanser",
    Toner: "Toner",
    Serum: "Serum",
    Essence: "Essence",
    Ampoule: "Ampoule",
    Cream: "Cream / Moisturizer",
    SPF: "SPF / Sunscreen",
    Other: "Others",
  },
  ko: {
    Cleanser: "클렌저",
    Toner: "토너",
    Serum: "세럼",
    Essence: "에센스",
    Ampoule: "앰플",
    Cream: "크림 / 보습제",
    SPF: "자외선 차단제 (SPF)",
    Other: "기타",
  },
  ja: {
    Cleanser: "クレンザー",
    Toner: "トナー",
    Serum: "セラム",
    Essence: "エッセンス",
    Ampoule: "アンプル",
    Cream: "クリーム / 保湿",
    SPF: "日焼け止め (SPF)",
    Other: "その他",
  },
};

const TITLE_LABELS: Record<Locale, string> = {
  en: "My K-Beauty Routine",
  ko: "나의 K-뷰티 루틴",
  ja: "私のK-ビューティールーティン",
};

const EMPTY_LABELS: Record<Locale, string> = {
  en: "No routine products yet. Finish a quiz or analysis for Top5 picks, or heart products on Results.",
  ko: "루틴에 넣을 제품이 없습니다. 문진·분석으로 Top5를 만들거나, 결과에서 하트를 눌러 주세요.",
  ja: "ルーティン用の製品がありません。問診・分析でTop5を作るか、結果でハートを押してください。",
};

function formatPrice(
  priceUsd: number | null,
  locale: Locale,
  rates: { krw: number; jpy: number }
): string | null {
  if (priceUsd == null) return null;
  switch (locale) {
    case "ko": {
      const krw = Math.round(priceUsd * rates.krw);
      return `₩${krw.toLocaleString("ko-KR")}`;
    }
    case "ja": {
      const jpy = Math.round(priceUsd * rates.jpy);
      return `¥${jpy.toLocaleString("ja-JP")}`;
    }
    default:
      return `$${priceUsd.toFixed(2)}`;
  }
}

function mapCategoryToStep(raw: string | null): string {
  if (!raw) return "Other";
  const lower = raw.toLowerCase();
  if (
    lower.includes("cleanser") ||
    lower.includes("cleansing") ||
    lower.includes("wash") ||
    lower.includes("balm")
  ) {
    return "Cleanser";
  }
  if (lower.includes("toner")) return "Toner";
  if (lower.includes("serum")) return "Serum";
  if (lower.includes("essence")) return "Essence";
  if (lower.includes("ampoule") || lower.includes("ampule")) return "Ampoule";
  if (
    lower.includes("cream") ||
    lower.includes("lotion") ||
    lower.includes("moistur")
  ) {
    return "Cream";
  }
  if (
    lower.includes("spf") ||
    lower.includes("sunscreen") ||
    lower.includes("sun_") ||
    lower.includes("sun-") ||
    lower.includes("sun gel") ||
    lower === "sun"
  ) {
    return "SPF";
  }
  return "Other";
}

function readRankedProductIds(): string[] {
  try {
    const raw = window.localStorage.getItem(RANKED_PRODUCTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const ids: string[] = [];
    for (const row of parsed) {
      const id =
        row &&
        typeof row === "object" &&
        row.product &&
        typeof row.product === "object"
          ? (row.product as { id?: unknown }).id
          : null;
      if (typeof id === "string" && id.trim()) ids.push(id.trim());
      else if (typeof id === "number" && Number.isFinite(id)) {
        ids.push(String(id));
      }
    }
    return ids;
  } catch {
    return [];
  }
}

function readFavoriteIds(): string[] {
  try {
    const stored = window.localStorage.getItem("favoriteProductIds");
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v) =>
        typeof v === "string" || typeof v === "number" ? String(v) : ""
      )
      .filter(Boolean);
  } catch {
    return [];
  }
}

export default function RoutinePage() {
  const { locale } = useLocale();
  const { krw, jpy } = useExchangeRate();
  const [productIds, setProductIds] = useState<string[]>([]);
  const [rankedCount, setRankedCount] = useState(0);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ranked = readRankedProductIds();
    const favorites = readFavoriteIds();
    setRankedCount(ranked.length);
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const id of [...ranked, ...favorites]) {
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(id);
    }
    setProductIds(merged);
  }, []);

  useEffect(() => {
    if (productIds.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchProducts() {
      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from("products")
          .select("id, name, name_ja, name_ko, brand, category, price_usd")
          .in("id", productIds);

        if (fetchError) {
          console.error("[Supabase routine fetch error]", fetchError);
          if (!cancelled) setError(fetchError.message);
          return;
        }

        const byId = new Map(
          ((data as ProductRow[]) ?? []).map((p) => [String(p.id), p])
        );
        const ordered = productIds
          .map((id) => byId.get(id))
          .filter((p): p is ProductRow => p != null);
        if (!cancelled) setProducts(ordered);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        console.error("[Supabase routine fetch exception]", err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [productIds]);

  const groupedByStep = useMemo(() => {
    const groups: Record<string, ProductRow[]> = {};
    for (const step of ROUTINE_ORDER) {
      groups[step] = [];
    }
    for (const p of products) {
      const step = mapCategoryToStep(p.category);
      if (!groups[step]) groups[step] = [];
      groups[step].push(p);
    }
    return groups;
  }, [products]);

  const hasAnyProduct = products.length > 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-gray-500">
          {locale === "ko"
            ? "루틴을 불러오는 중…"
            : locale === "ja"
              ? "ルーティンを読み込み中…"
              : "Loading routine..."}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6">
        <p className="text-sm text-red-600">{error}</p>
        <Link
          href="/results"
          className="text-sm font-semibold text-[#C2185B] underline hover:no-underline"
        >
          {locale === "ko"
            ? "결과로 돌아가기"
            : locale === "ja"
              ? "結果に戻る"
              : "Back to Results"}
        </Link>
      </div>
    );
  }

  const title = TITLE_LABELS[locale];

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <Head>
        <title>{`${title} | K-Beauty Match`}</title>
        <meta
          name="description"
          content={
            locale === "ko"
              ? "핵심 추천·즐겨찾기 제품을 하루 루틴 순서로 정리한 가이드입니다."
              : locale === "ja"
                ? "コアおすすめ・お気に入りを1日ルーティン順に整理したガイドです。"
                : "Day routine guide from your core Top5 picks and favorites."
          }
        />
      </Head>
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#C2185B]">
              {locale === "ko"
                ? "하루 루틴"
                : locale === "ja"
                  ? "1日ルーティン"
                  : "K-Beauty Routine"}
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
              {title}
            </h1>
            {hasAnyProduct ? (
              <p className="mt-2 text-sm text-gray-600">
                {rankedCount > 0
                  ? locale === "ko"
                    ? `핵심 추천 ${rankedCount}개를 루틴 순서로 먼저 배치했습니다. 즐겨찾기도 함께 포함됩니다.`
                    : locale === "ja"
                      ? `コアおすすめ${rankedCount}件をルーティン順に先に並べています。お気に入りも含みます。`
                      : `Core Top${rankedCount} picks lead the steps. Favorites are included too.`
                  : locale === "ko"
                    ? "즐겨찾기 제품을 루틴 순서로 정리했습니다."
                    : locale === "ja"
                      ? "お気に入り製品をルーティン順に整理しました。"
                      : "Favorites arranged in routine order."}
              </p>
            ) : null}
          </div>
          <Link
            href="/results"
            className="shrink-0 text-xs font-semibold text-[#C2185B] underline hover:no-underline"
          >
            {locale === "ko"
              ? "← 결과로 돌아가기"
              : locale === "ja"
                ? "← 結果に戻る"
                : "← Back to Results"}
          </Link>
        </header>

        {!hasAnyProduct ? (
          <div className="rounded-2xl border border-pink-100 bg-pink-50/40 p-8 text-center">
            <p className="text-base font-medium text-gray-700">
              {EMPTY_LABELS[locale]}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Link href="/quiz" className="inline-block">
                <span className="inline-flex items-center justify-center rounded-full bg-[#C2185B] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#a3154f]">
                  {locale === "ko"
                    ? "피부 문진"
                    : locale === "ja"
                      ? "肌問診"
                      : "Skin quiz"}
                </span>
              </Link>
              <Link href="/results" className="inline-block">
                <span className="inline-flex items-center justify-center rounded-full border border-pink-200 bg-white px-5 py-2 text-sm font-semibold text-gray-800 transition hover:bg-pink-50">
                  {locale === "ko"
                    ? "결과 페이지"
                    : locale === "ja"
                      ? "結果ページ"
                      : "Results"}
                </span>
              </Link>
            </div>
          </div>
        ) : (
          <section className="space-y-8">
            {ROUTINE_ORDER.map((step) => {
              const items = groupedByStep[step] ?? [];
              if (items.length === 0) return null;

              const stepLabel = ROUTINE_LABELS[locale][step] ?? step;

              return (
                <div key={step}>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-gray-700">
                    {stepLabel}
                  </h2>
                  <div className="grid gap-4 md:grid-cols-3">
                    {items.map((p) => {
                      const priceDisplay = formatPrice(p.price_usd, locale, {
                        krw,
                        jpy,
                      });
                      const displayName = displayProductTitle({
                        name: p.name,
                        nameKo: p.name_ko,
                        nameJa: p.name_ja,
                        brand: p.brand,
                        locale,
                      });

                      return (
                        <div
                          key={p.id}
                          className="flex h-full flex-col rounded-2xl border border-pink-100 bg-pink-50/40 p-4 text-sm"
                        >
                          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#C2185B]">
                            {displayBrandName(p.brand, locale) ?? p.brand}
                          </p>
                          <p className="mb-2 font-semibold text-gray-900">
                            {displayName}
                          </p>
                          {priceDisplay ? (
                            <p className="mt-auto text-xs font-medium text-gray-800">
                              {priceDisplay}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
