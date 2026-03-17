"use client";

import Head from "next/head";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useExchangeRate } from "@/hooks/useExchangeRate";
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

type CountryCode = "US" | "JP" | "KR" | "OTHER";

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
    results_title: "나에게 맞는 K-뷰티 제품",
    view_ingredients: "성분 보기",
  },
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

function buildPurchaseLinks(
  country: CountryCode,
  product: ProductRow
): { label: string; href: string }[] {
  const searchNameKr = product.name_ko ?? product.name;
  const searchNameDefault = product.name;
  const encodedForKr = encodeURIComponent(searchNameKr).replace(/%20/g, "+");
  const encodedDefault = encodeURIComponent(searchNameDefault).replace(/%20/g, "+");

  switch (country) {
    case "US": {
      const links: { label: string; href: string }[] = [];
      links.push({
        label: "Find on Sephora",
        href: product.link_sephora ?? `https://www.sephora.com/search?keyword=${encodedDefault}`,
      });
      links.push({
        label: "Find on Amazon",
        href: product.link_amazon_us ?? `https://www.amazon.com/s?k=${encodedDefault}`,
      });
      return links;
    }
    case "JP": {
      const links: { label: string; href: string }[] = [];
      links.push({
        label: "Qoo10で探す",
        href: product.link_qoo10 ?? `https://www.qoo10.jp/gmkt.inc/Search/Search.aspx?keyword=${encodedDefault}`,
      });
      links.push({
        label: "Amazon.co.jpで探す",
        href: product.link_amazon_jp ?? `https://www.amazon.co.jp/s?k=${encodedDefault}`,
      });
      return links;
    }
    case "KR": {
      const links: { label: string; href: string }[] = [];
      links.push({
        label: "올리브영에서 찾기",
        href: product.link_oliveyoung ?? `https://www.oliveyoung.co.kr/store/search/getSearchMain.do?query=${encodedForKr}`,
      });
      links.push({
        label: "쿠팡에서 찾기",
        href: product.link_coupang ?? `https://www.coupang.com/np/search?q=${encodedForKr}`,
      });
      links.push({
        label: "네이버쇼핑에서 찾기",
        href: `https://search.shopping.naver.com/search/all?query=${encodedForKr}`,
      });
      return links;
    }
    default:
      return [
        {
          label: "Find on YesStyle",
          href: product.link_yesstyle ?? `https://www.yesstyle.com/en/search.html?keyword=${encodedDefault}`,
        },
      ];
  }
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
  const [country, setCountry] = useState<CountryCode>("OTHER");
  const [locale, setLocale] = useState<Locale>("en");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const { krw, jpy } = useExchangeRate();

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
      const haystack = `${nameEn} ${nameKo} ${nameJa} ${brand}`.toLowerCase();
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
      ? "제품 검색..."
      : locale === "ja"
        ? "製品を検索..."
        : "Search products...";
  const exchangeRates = { krw, jpy };
  // 판매처는 IP 기반 country만 사용, locale은 화면 텍스트에만 영향
  const effectiveCountry: CountryCode = country;

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

  useEffect(() => {
    async function detectCountry() {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (!res.ok) return;
        const json = (await res.json()) as { country_code?: string };
        const code = json.country_code;
        if (code === "US") {
          setCountry("US");
        } else if (code === "JP") {
          setCountry("JP");
        } else if (code === "KR") {
          setCountry("KR");
        } else {
          setCountry("OTHER");
        }
      } catch {
        // 조용히 무시 (locale이 ko면 effectiveCountry로 KR 사용)
      }
    }

    detectCountry();
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
    <div className="min-h-screen bg-white font-sans text-gray-900">
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
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#C2185B]">
              K-Beauty Recommendations
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
              {messages.results_title}
            </h1>
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
            <button
              type="button"
              onClick={() => setShowFavoritesOnly((prev) => !prev)}
              className={`mt-1 inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold transition sm:mt-0 ${
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
              const priceDisplay = formatPrice(
                product.price_usd,
                locale,
                exchangeRates
              );
              const purchaseLinks = buildPurchaseLinks(effectiveCountry, product);

              const isFavorite = favoriteIds.includes(product.id);

              return (
                <article
                  key={product.id}
                  className="relative flex h-full flex-col rounded-3xl border border-pink-100 bg-pink-50/40 p-5 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleFavorite(product.id)}
                    className="absolute right-4 top-4 text-xl"
                    aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                  >
                    <span className={isFavorite ? "text-[#C2185B]" : "text-gray-300"}>
                      {isFavorite ? "❤️" : "🤍"}
                    </span>
                  </button>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#C2185B]">
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

                  {((locale === "ko" && product.recommendation_reason_ko) ||
                    (locale === "ja" && product.recommendation_reason_ja) ||
                    product.recommendation_reason) && (
                    <div className="mb-4">
                      <p className="text-sm leading-relaxed text-gray-700">
                        {locale === "ja" && product.recommendation_reason_ja
                          ? product.recommendation_reason_ja
                          : locale === "ko" && product.recommendation_reason_ko
                          ? product.recommendation_reason_ko
                          : product.recommendation_reason}
                      </p>
                      {locale === "ko" &&
                        !product.recommendation_reason_ko &&
                        product.recommendation_reason && (
                          <p className="mt-1 text-xs text-gray-500">
                            (영문으로 제공됩니다)
                          </p>
                        )}
                    </div>
                  )}

                  <div className="mt-auto">
                    {priceDisplay && (
                      <p className="mb-4 text-sm font-semibold text-gray-900">
                        {priceDisplay}
                      </p>
                    )}
                    <div className="flex flex-col gap-2 text-sm sm:flex-row">
                      {purchaseLinks.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex flex-1 items-center justify-center rounded-full bg-[#C2185B] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#a3154f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        >
                          {link.label}
                        </a>
                      ))}
                      {product.key_ingredients?.length && firstIngredientSlug ? (
                        <Link
                          href={`/ingredients/${firstIngredientSlug}`}
                          className="inline-flex flex-1 items-center justify-center rounded-full border border-[#C2185B] bg-white px-4 py-2 font-semibold text-[#C2185B] transition hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        >
                          {messages.view_ingredients}
                        </Link>
                      ) : null}
                    </div>
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

