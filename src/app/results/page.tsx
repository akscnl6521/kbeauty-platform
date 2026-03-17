"use client";

import Head from "next/head";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProductRow = {
  id: string;
  name: string;
  name_ja: string | null;
  name_ko: string | null;
  brand: string;
  category: string | null;
  skin_concern: string | null;
  skin_tone: string | null;
  key_ingredients: string[] | null;
  key_ingredients_ja: string[] | null;
  price_usd: number | null;
  recommendation_reason: string | null;
  recommendation_reason_ko: string | null;
  recommendation_reason_ja: string | null;
  slug: string | null;
  link_sephora: string | null;
  link_amazon_us: string | null;
  link_amazon_jp: string | null;
  link_qoo10: string | null;
  link_oliveyoung: string | null;
  link_coupang: string | null;
  link_yesstyle: string | null;
};

type Locale = "en" | "ja" | "ko";

type Messages = {
  results_title: string;
  view_ingredients: string;
};

const LOCALE_MESSAGES: Record<Locale, Messages> = {
  en: {
    results_title: "Your K-Beauty Matches",
    view_ingredients: "View Ingredients",
  },
  ja: {
    results_title: "あなたへのK-ビューティーおすすめ",
    view_ingredients: "成分を見る",
  },
  ko: {
    results_title: "나에게 맞는 K-뷰티 정보",
    view_ingredients: "성분 보기",
  },
};

function priceTierText(priceUsd: number | null, locale: Locale): string | null {
  if (priceUsd == null) return null;
  const tier = priceUsd <= 20 ? "low" : priceUsd <= 50 ? "mid" : "premium";
  if (locale === "ko") {
    if (tier === "low") return "가격대: 저가";
    if (tier === "mid") return "가격대: 중가";
    return "가격대: 프리미엄";
  }
  if (locale === "ja") {
    if (tier === "low") return "価格帯: 低価格";
    if (tier === "mid") return "価格帯: 中価格";
    return "価格帯: プレミアム";
  }
  if (tier === "low") return "Price tier: Budget";
  if (tier === "mid") return "Price tier: Mid-range";
  return "Price tier: Premium";
}

/** 성분명 → URL slug. 매핑 없이 소문자+공백을 하이픈으로 변환해 항상 문자열 반환. */
function ingredientNameToSlug(name: string): string {
  if (!name || typeof name !== "string") return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function parseArrayField(value: string | null | string[]): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(String);
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function matchesTone(skinTone: string | null, selectedTone: string): boolean {
  const tones = parseArrayField(skinTone);
  return tones.length === 0 || tones.some((t) => t === selectedTone);
}

function matchesConcern(
  skinConcern: string | null,
  selectedConcern: string
): boolean {
  const concerns = parseArrayField(skinConcern);
  return concerns.length === 0 || concerns.some((c) => c === selectedConcern);
}

function matchesBudget(priceUsd: number | null, budget: string): boolean {
  if (priceUsd == null) return false;
  switch (budget) {
    case "low":
      return priceUsd <= 20;
    case "mid":
      return priceUsd > 20 && priceUsd <= 50;
    case "premium":
      return priceUsd > 50;
    default:
      return true;
  }
}

// 결과 카드 속성/성분 한국어 매핑 (locale ko일 때 사용)
const RESULTS_ATTR_KO: Record<string, string> = {
  Redness: "붉은기",
  Dryness: "건조함",
  Acne: "여드름",
  Dullness: "칙칙함",
  "Anti-aging": "노화 방지",
  "Anti-Aging": "노화 방지",
  REDNESS: "붉은기",
  DRYNESS: "건조함",
  ACNE: "여드름",
  DULLNESS: "칙칙함",
  "ANTI-AGING": "노화 방지",
  Light: "밝은",
  Medium: "중간",
  Dark: "어두운",
  Warm: "웜톤",
  Cool: "쿨톤",
  Neutral: "중립",
  LIGHT: "밝은",
  MEDIUM: "중간",
  DARK: "어두운",
  WARM: "웜톤",
  COOL: "쿨톤",
  NEUTRAL: "중립",
};

const INGREDIENT_NAME_KO: Record<string, string> = {
  "Centella Asiatica": "센텔라 아시아티카",
  "Niacinamide": "나이아신아마이드",
  "Peptide": "펩타이드",
  "Peptides": "펩타이드",
  "Ceramide": "세라마이드",
  "Ceramides": "세라마이드",
  "Hyaluronic Acid": "히알루론산",
  "Vitamin C": "비타민 C",
  "Retinol": "레티놀",
  "AHA": "AHA",
  "BHA": "BHA",
  "Panthenol": "판테놀",
  "Green Tea": "녹차",
  "Snail Mucin": "달팽이 점액",
  "Cica": "시카",
  "Centella": "센텔라",
  "Alpha Arbutin": "알파 아르부틴",
  "Tranexamic Acid": "트라넥삼산",
  "Adenosine": "아데노신",
};

function formatAttributeValue(value: string, locale: Locale): string {
  if (locale !== "ko") return value;
  const trimmed = value.trim();
  return (
    RESULTS_ATTR_KO[trimmed] ??
    RESULTS_ATTR_KO[trimmed.toUpperCase()] ??
    RESULTS_ATTR_KO[trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()] ??
    trimmed
  );
}

function formatAttributeDisplay(
  concern: string | null,
  tone: string | null,
  locale: Locale
): string {
  const parts: string[] = [];
  if (concern) {
    parts.push(
      parseArrayField(concern)
        .map((v) => formatAttributeValue(v, locale))
        .join(", ")
    );
  }
  if (tone) {
    parts.push(
      parseArrayField(tone)
        .map((v) => formatAttributeValue(v, locale))
        .join(", ")
    );
  }
  return parts.join(" · ");
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <p className="text-sm text-gray-500">Loading recommendations...</p>
        </div>
      }
    >
      <ResultsPageInner />
    </Suspense>
  );
}

function ResultsPageInner() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [openReasonIds, setOpenReasonIds] = useState<string[]>([]);

  const tone = searchParams.get("tone");
  const concern = searchParams.get("concern");
  const budget = searchParams.get("budget");

  // 설문 조건(tone/concern/budget) 기반 1차 필터
  const quizFilteredProducts = useMemo(() => {
    if (!tone && !concern && !budget) return products;

    return products.filter((p) => {
      if (tone && !matchesTone(p.skin_tone, tone)) return false;
      if (concern && !matchesConcern(p.skin_concern, concern)) return false;
      if (budget && !matchesBudget(p.price_usd, budget)) return false;
      return true;
    });
  }, [products, tone, concern, budget]);

  // 검색어 + 즐겨찾기 기반 2차 필터 (name/name_ko/name_ja/brand, favorites)
  const filteredProducts = useMemo(() => {
    const favoritesSet = new Set(favoriteIds);
    const query = searchQuery.trim().toLowerCase();
    if (!query && !showFavoritesOnly) return quizFilteredProducts;

    return quizFilteredProducts.filter((p) => {
      if (showFavoritesOnly && !favoritesSet.has(p.id)) return false;

      if (!query) return true;

      const nameEn = p.name ?? "";
      const nameKo = p.name_ko ?? "";
      const nameJa = p.name_ja ?? "";
      const brand = p.brand ?? "";
      const ingredientsEn = (p.key_ingredients ?? []).join(" ");
      const ingredientsJa = (p.key_ingredients_ja ?? []).join(" ");
      const haystack =
        `${nameEn} ${nameKo} ${nameJa} ${brand} ${ingredientsEn} ${ingredientsJa}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [quizFilteredProducts, searchQuery, favoriteIds, showFavoritesOnly]);

  useEffect(() => {
    if (filteredProducts.length > 0) {
      console.log(
        "첫번째 제품 key_ingredients_ja:",
        filteredProducts[0].key_ingredients_ja
      );
      console.log("현재 locale:", locale);
    }
  }, [filteredProducts, locale]);

  const displayProductName = (product: ProductRow) =>
    locale === "ja" && product.name_ja
      ? product.name_ja
      : locale === "ko" && product.name_ko
      ? product.name_ko
      : product.name;

  const messages = LOCALE_MESSAGES[locale];
  const searchPlaceholder =
    locale === "ko"
      ? "제품명 또는 성분으로 검색해보세요"
      : locale === "ja"
        ? "製品を検索..."
        : "Search products...";
  const subtitle =
    locale === "ko"
      ? "피부톤, 피부 고민, 언더톤, 가격대를 기준으로 정리된 결과입니다"
      : locale === "ja"
        ? "肌トーン・肌悩み・アンダートーン・価格帯を基準に整理した結果です"
        : "Results organized by skin tone, concerns, undertone, and price tier.";

  // 즐겨찾기 로드
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

  const toggleFavorite = (productId: string) => {
    setFavoriteIds((prev) => {
      const exists = prev.includes(productId);
      const next = exists ? prev.filter((id) => id !== productId) : [...prev, productId];
      try {
        window.localStorage.setItem("favoriteProductIds", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleReason = (productId: string) => {
    setOpenReasonIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("locale");
      if (saved === "en" || saved === "ja" || saved === "ko") {
        setLocale(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error: fetchError } = await supabase
          .from("products")
          .select(
            "id, name, name_ja, name_ko, brand, category, skin_concern, skin_tone, key_ingredients, key_ingredients_ja, price_usd, recommendation_reason, recommendation_reason_ko, recommendation_reason_ja, slug, link_sephora, link_amazon_us, link_amazon_jp, link_qoo10, link_oliveyoung, link_coupang, link_yesstyle"
          )
          .limit(10000);

        if (fetchError) {
          console.error("[Supabase products fetch error]", fetchError);
          setError(fetchError.message);
          return;
        }
        setProducts((data as ProductRow[]) ?? []);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        console.error("[Supabase products fetch exception]", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-gray-500">Loading recommendations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6">
        <p className="text-sm text-red-600">{error}</p>
        <Link
          href="/quiz"
          className="text-sm font-semibold text-[#C2185B] underline hover:no-underline"
        >
          Back to Quiz
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A]">
      <Head>
        <title>Your K-Beauty Matches | KBEAUTY GUIDE</title>
        <meta
          name="description"
          content="Personalized K-beauty product recommendations with ingredient research and where to buy in your country."
        />
      </Head>
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#B8860B]">
              K-Beauty Recommendations
            </p>
            <h1 className="mt-3 font-['Playfair_Display',serif] text-3xl font-semibold tracking-tight text-[#1A1A1A] md:text-4xl">
              {messages.results_title}
            </h1>
            <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => {
                setLocale("en");
                try {
                  window.localStorage.setItem("locale", "en");
                } catch {
                  // ignore
                }
              }}
              className={`rounded-full px-3 py-1 transition ${
                locale === "en"
                  ? "bg-[#C2185B] text-white"
                  : "border border-pink-200 text-gray-700 hover:bg-pink-50"
              }`}
            >
              🇺🇸
            </button>
            <button
              type="button"
              onClick={() => {
                setLocale("ja");
                try {
                  window.localStorage.setItem("locale", "ja");
                } catch {
                  // ignore
                }
              }}
              className={`rounded-full px-3 py-1 transition ${
                locale === "ja"
                  ? "bg-[#C2185B] text-white"
                  : "border border-pink-200 text-gray-700 hover:bg-pink-50"
              }`}
            >
              🇯🇵
            </button>
            <button
              type="button"
              onClick={() => {
                setLocale("ko");
                try {
                  window.localStorage.setItem("locale", "ko");
                } catch {
                  // ignore
                }
              }}
              className={`rounded-full px-3 py-1 transition ${
                locale === "ko"
                  ? "bg-[#C2185B] text-white"
                  : "border border-pink-200 text-gray-700 hover:bg-pink-50"
              }`}
            >
              🇰🇷
            </button>
          </div>
        </header>

        {/* Product cards */}
        <section className="flex-1">
          {/* Search + favorites toggle just above grid */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-full border border-pink-200 bg-white px-5 py-3 text-sm text-gray-900 shadow-sm focus:border-[#C2185B] focus:outline-none focus:ring-1 focus:ring-[#C2185B]"
            />
            <div className="flex items-center gap-2 sm:mt-0">
              <button
                type="button"
                onClick={() => setShowFavoritesOnly((prev) => !prev)}
                className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold transition ${
                  showFavoritesOnly
                    ? "bg-[#C2185B] text-white"
                    : "border border-pink-200 text-gray-700 hover:bg-pink-50"
                }`}
              >
                {locale === "ko"
                  ? "즐겨찾기"
                  : locale === "ja"
                    ? "お気に入り"
                    : "Favorites"}
              </button>
              <Link
                href="/routine"
                className="inline-flex items-center justify-center rounded-full bg-[#C2185B] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#a3154f]"
              >
                {locale === "ko"
                  ? "내 루틴 보기"
                  : locale === "ja"
                    ? "ルーティンを見る"
                    : "My Routine"}
              </Link>
            </div>
          </div>
          {filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-pink-100 bg-pink-50/40 p-8 text-center">
              <p className="text-base font-medium text-gray-700">
                조건에 맞는 제품이 없습니다
              </p>
              <p className="mt-2 text-sm text-gray-500">
                다른 조건으로 퀴즈를 다시 진행해 보세요.
              </p>
              <Link href="/quiz" className="mt-4 inline-block">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full bg-[#C2185B] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#a3154f]"
                >
                  퀴즈 다시 하기
                </button>
              </Link>
            </div>
          ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {filteredProducts.map((product) => {
              const keyIngredients =
                locale === "ja" && product.key_ingredients_ja?.length
                  ? product.key_ingredients_ja
                  : product.key_ingredients ?? [];

              // slug는 항상 영문 key_ingredients[0]을 변환해 사용 (배지 표시는 keyIngredients로 locale 구분)
              const firstIngredientSlug =
                product.key_ingredients && product.key_ingredients.length > 0
                  ? ingredientNameToSlug(product.key_ingredients[0])
                  : "";

              const isFavorite = favoriteIds.includes(product.id);

              return (
                <article
                  key={product.id}
                  className="relative flex h-full flex-col rounded-3xl border border-[#F3E5F5] bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.06)] transition-transform duration-200 hover:-translate-y-1"
                >
                  <button
                    type="button"
                    onClick={() => toggleFavorite(product.id)}
                    className="absolute right-4 top-4 text-xl"
                    aria-label="저장"
                    title="저장"
                  >
                    <span className={isFavorite ? "text-[#C2185B]" : "text-gray-300"}>
                      {"🔖"}
                    </span>
                  </button>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#B8860B]">
                    {product.brand}
                  </div>
                  <h2 className="mb-2 text-lg font-semibold text-gray-900">
                    {displayProductName(product)}
                  </h2>
                  {(product.skin_concern || product.skin_tone) && (
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-gray-500">
                      {formatAttributeDisplay(
                        product.skin_concern,
                        product.skin_tone,
                        locale
                      )}
                    </p>
                  )}

                  {priceTierText(product.price_usd, locale) ? (
                    <p className="mb-3 text-xs font-medium text-gray-500">
                      {priceTierText(product.price_usd, locale)}
                    </p>
                  ) : null}

                  {keyIngredients.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {keyIngredients.map((ing, idx) => (
                        <span
                          key={idx}
                          className="rounded-full bg-[#C2185B] px-3 py-1 text-xs font-medium text-white"
                        >
                          {ing}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => toggleReason(product.id)}
                        className="inline-flex items-center justify-center rounded-full bg-[#C2185B] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#a3154f]"
                      >
                        추천 이유 보기
                      </button>
                      {product.key_ingredients?.length && firstIngredientSlug ? (
                        <Link
                          href={`/ingredients/${firstIngredientSlug}`}
                          className="inline-flex items-center justify-center rounded-full border border-[#C2185B] bg-transparent px-4 py-2 text-xs font-semibold text-[#C2185B] transition hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFAF8]"
                        >
                          성분 설명 보기
                        </Link>
                      ) : null}
                    </div>

                    {openReasonIds.includes(product.id) &&
                      ((locale === "ko" && product.recommendation_reason_ko) ||
                        (locale === "ja" && product.recommendation_reason_ja) ||
                        product.recommendation_reason) && (
                        <div className="mt-3 rounded-2xl border border-pink-100 bg-pink-50/40 p-4">
                          <p className="text-sm leading-relaxed text-gray-700">
                            {locale === "ja" && product.recommendation_reason_ja
                              ? product.recommendation_reason_ja
                              : locale === "ko" &&
                                product.recommendation_reason_ko
                              ? product.recommendation_reason_ko
                              : product.recommendation_reason}
                          </p>
                        </div>
                      )}
                  </div>

                  <div className="mt-auto">
                    {/* 정보형 UI로 전환: 구매 버튼 제거 */}
                  </div>
                </article>
              );
            })}
          </div>
          )}
        </section>

        {/* Footer actions */}
        <footer className="mt-12 flex items-center justify-between border-t border-gray-100 pt-6">
          <p className="text-xs text-gray-500">
            These recommendations are a starting point. Always patch test new
            products.
          </p>
          <Link href="/quiz">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-[#C2185B] bg-white px-5 py-2 text-xs font-semibold text-[#C2185B] transition hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Start Over
            </button>
          </Link>
        </footer>
      </main>
    </div>
  );
}

