"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/hooks/useLocale";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { supabase } from "@/lib/supabase";

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

type CountryCode = "US" | "JP" | "KR" | "OTHER";

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
  en: "No favorite products found. Tap the heart on the results page to add favorites!",
  ko: "즐겨찾기한 제품이 없습니다. 결과 페이지에서 하트를 눌러주세요!",
  ja: "お気に入りの製品がありません。結果ページでハートを押してください！",
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
  if (lower.includes("cleanser") || lower.includes("wash")) return "Cleanser";
  if (lower.includes("toner")) return "Toner";
  if (lower.includes("serum")) return "Serum";
  if (lower.includes("essence")) return "Essence";
  if (lower.includes("ampoule") || lower.includes("ampule")) return "Ampoule";
  if (lower.includes("cream") || lower.includes("lotion") || lower.includes("moistur")) {
    return "Cream";
  }
  if (lower.includes("spf") || lower.includes("sunscreen") || lower.includes("sun")) {
    return "SPF";
  }
  return "Other";
}

export default function RoutinePage() {
  const { locale } = useLocale();
  const { krw, jpy } = useExchangeRate();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load favorite ids from localStorage
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("favoriteProductIds");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setFavoriteIds(parsed.filter((v) => typeof v === "string"));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch products for favorites
  useEffect(() => {
    if (favoriteIds.length === 0) {
      setLoading(false);
      return;
    }

    async function fetchFavorites() {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("id, name, name_ja, name_ko, brand, category, price_usd")
          .in("id", favoriteIds);

        if (error) {
          console.error("[Supabase favorites fetch error]", error);
          setError(error.message);
          return;
        }

        setProducts((data as ProductRow[]) ?? []);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        console.error("[Supabase favorites fetch exception]", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchFavorites();
  }, [favoriteIds]);

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
        <p className="text-sm text-gray-500">Loading routine...</p>
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
          Back to Results
        </Link>
      </div>
    );
  }

  const title = TITLE_LABELS[locale];

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <Head>
        <title>{`${title} | KBEAUTY GUIDE`}</title>
        <meta
          name="description"
          content="Automatically organized K-beauty routine based on your favorite products."
        />
      </Head>
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#C2185B]">
              K-Beauty Routine
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
              {title}
            </h1>
          </div>
          <Link
            href="/results"
            className="text-xs font-semibold text-[#C2185B] underline hover:no-underline"
          >
            ← Back to Results
          </Link>
        </header>

        {!hasAnyProduct ? (
          <div className="rounded-2xl border border-pink-100 bg-pink-50/40 p-8 text-center">
            <p className="text-base font-medium text-gray-700">
              {EMPTY_LABELS[locale]}
            </p>
            <Link href="/results" className="mt-4 inline-block">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full bg-[#C2185B] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#a3154f]"
              >
                {locale === "ko"
                  ? "결과 페이지로 이동"
                  : locale === "ja"
                    ? "結果ページへ"
                    : "Go to Results"}
              </button>
            </Link>
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
                      const displayName =
                        locale === "ko" && p.name_ko
                          ? p.name_ko
                          : locale === "ja" && p.name_ja
                            ? p.name_ja
                            : p.name;

                      return (
                        <div
                          key={p.id}
                          className="flex h-full flex-col rounded-2xl border border-pink-100 bg-pink-50/40 p-4 text-sm"
                        >
                          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#C2185B]">
                            {p.brand}
                          </p>
                          <p className="mb-2 font-semibold text-gray-900">
                            {displayName}
                          </p>
                          {priceDisplay && (
                            <p className="mt-auto text-xs font-medium text-gray-800">
                              {priceDisplay}
                            </p>
                          )}
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

