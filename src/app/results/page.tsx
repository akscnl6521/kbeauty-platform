"use client";

import Head from "next/head";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useCountry } from "@/hooks/useCountry";
import { useLocale } from "@/hooks/useLocale";
import { RecommendedProductCard } from "@/components/recommendation/RecommendedProductCard";
import {
  displayIngredientNames,
  loadLatestRecommendationPipeline,
  productHasKrVerifiedCoreOffer,
  purgeLegacyRecommendationCaches,
  type CandidateProduct,
  type ManagementLevel,
  type RankedProduct,
  type Recommendation,
} from "@/lib/recommend";
import {
  displayBrandName,
  displayProductTitle,
  getCanonicalBrandName,
} from "@/lib/brand/displayBrandName";

function managementLevelLabelKo(level: ManagementLevel): string {
  const map: Record<ManagementLevel, string> = {
    cosmetic_care: "화장품 중심 관리 가능",
    observe: "사용 후 경과 관찰",
    combined_care: "화장품 관리와 전문가 상담 병행",
    expert_first: "전문가 상담 우선",
    urgent_check: "신속한 의료기관 확인 권장",
  };
  return map[level];
}

function isRiskManagementLevel(
  level: ManagementLevel | undefined
): level is "expert_first" | "urgent_check" {
  return level === "expert_first" || level === "urgent_check";
}

function pickKoreanSummary(rec: Recommendation): string {
  return (rec.summaryKo ?? "").trim();
}

function nonEmptyList(value: string[] | undefined | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((s) => s.trim()).filter(Boolean);
}

function confidencePercent(score: number): number {
  if (!Number.isFinite(score)) return 0;
  const clamped = Math.min(1, Math.max(0, score));
  return Math.round(clamped * 100);
}

/** 값이 있을 때만 제목+본문을 렌더 */
function GuideBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-gray-700">{children}</div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={`${item}-${i}`} className="flex gap-2">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#C2185B]/70" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={`${item}-${i}`}>{item}</li>
      ))}
    </ol>
  );
}

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
          <p className="text-sm text-gray-500">추천을 불러오는 중…</p>
        </div>
      }
    >
      <ResultsPageInner />
    </Suspense>
  );
}

function ResultsPageInner() {
  const searchParams = useSearchParams();
  const { countryCode, setShippingCountry } = useCountry();
  const { locale, setLocale } = useLocale();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [openReasonIds, setOpenReasonIds] = useState<string[]>([]);
  /** 전체 제품 탐색: 처음엔 일부만, 더 보기로 확장 */
  const [catalogExpanded, setCatalogExpanded] = useState(false);
  const CATALOG_PREVIEW_COUNT = 6;

  // Sprint 4 Phase 1 — LocalStorage 추천 파이프라인 결과
  const [savedRecommendation, setSavedRecommendation] =
    useState<Recommendation | null>(null);
  const [rankedProducts, setRankedProducts] = useState<
    RankedProduct<CandidateProduct>[]
  >([]);
  const [storageReady, setStorageReady] = useState(false);

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
      const brand = displayBrandName(p.brand, "en") ?? p.brand ?? "";
      const ingredientsEn = (p.key_ingredients ?? []).join(" ");
      const ingredientsJa = (p.key_ingredients_ja ?? []).join(" ");
      const haystack =
        `${nameEn} ${nameKo} ${nameJa} ${brand} ${p.brand ?? ""} ${ingredientsEn} ${ingredientsJa}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [quizFilteredProducts, searchQuery, favoriteIds, showFavoritesOnly]);

  /** Top 5와 중복되지 않는 탐색용 목록 */
  const browseProducts = useMemo(() => {
    const rankedIds = new Set(rankedProducts.map((r) => r.product.id));
    return filteredProducts.filter((p) => !rankedIds.has(p.id));
  }, [filteredProducts, rankedProducts]);

  const visibleBrowseProducts = useMemo(() => {
    if (catalogExpanded) return browseProducts;
    return browseProducts.slice(0, CATALOG_PREVIEW_COUNT);
  }, [browseProducts, catalogExpanded]);

  useEffect(() => {
    if (filteredProducts.length > 0) {
      // no-op: keep effect dependency stable without logs
    }
  }, [filteredProducts, locale]);

  const displayProductName = (product: ProductRow) =>
    displayProductTitle({
      name: product.name,
      nameKo: product.name_ko,
      nameJa: product.name_ja,
      brand: product.brand,
      locale,
    });

  const messages = LOCALE_MESSAGES[locale];
  const searchPlaceholder =
    locale === "ko"
      ? "제품명 또는 성분으로 검색해보세요"
      : locale === "ja"
        ? "製品を検索..."
        : "Search products...";
  const subtitle =
    locale === "ko"
      ? "이 결과는 피부톤, 피부 고민, 언더톤, 가격대와 AI 분석 정보를 기준으로 정리되었습니다."
      : locale === "ja"
        ? "肌トーン・肌悩み・アンダートーン・価格帯とAIガイド情報を基準に整理した結果です。"
        : "Results organized by skin tone, concerns, undertone, price tier, and AI guide insights.";

  const aiApplied = searchParams.get("ai") === "1";
  const aiBadgeText =
    locale === "ko" ? "AI 분석 반영됨" : locale === "ja" ? "AIガイド適用" : "AI Guide Applied";

  const hasSavedRecommendation =
    (savedRecommendation != null &&
      (savedRecommendation.skinConcerns.length > 0 ||
        savedRecommendation.recommendedIngredients.length > 0 ||
        savedRecommendation.confidenceScore > 0)) ||
    rankedProducts.length > 0;

  // Sprint 4 Phase 2: 항상 최신 skinRecommendation + skinRankedProducts 만 사용
  useEffect(() => {
    const refreshFromStorage = () => {
      purgeLegacyRecommendationCaches();
      const { recommendation, rankedProducts: ranked, analysis } =
        loadLatestRecommendationPipeline();

      if (process.env.NODE_ENV === "development") {
        console.log("[results]", {
          recommendation,
          rankedProducts: ranked,
          analysis,
        });
      }

      setSavedRecommendation(recommendation);
      setRankedProducts(ranked);
      setStorageReady(true);
    };

    refreshFromStorage();

    const onVisible = () => {
      if (document.visibilityState === "visible") refreshFromStorage();
    };

    window.addEventListener("focus", refreshFromStorage);
    window.addEventListener("pageshow", refreshFromStorage);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("focus", refreshFromStorage);
      window.removeEventListener("pageshow", refreshFromStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [searchParams]);

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
        const rows = ((data as ProductRow[]) ?? []).map((row) => ({
          ...row,
          brand: getCanonicalBrandName(row.brand) ?? row.brand,
        }));
        setProducts(rows);
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
        <p className="text-sm text-gray-500">
          {locale === "ko"
            ? "추천을 불러오는 중…"
            : locale === "ja"
              ? "おすすめを読み込み中…"
              : "Loading recommendations..."}
        </p>
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
          {locale === "ko"
            ? "퀴즈로 돌아가기"
            : locale === "ja"
              ? "クイズに戻る"
              : "Back to Quiz"}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A]">
      <Head>
        <title>
          {locale === "ko"
            ? `${messages.results_title} | K-Beauty Match`
            : locale === "ja"
              ? `${messages.results_title} | K-Beauty Match`
              : `${messages.results_title} | K-Beauty Match`}
        </title>
        <meta
          name="description"
          content={
            locale === "ko"
              ? "피부 분석과 성분 정보를 바탕으로 정리한 K-뷰티 추천 결과입니다."
              : locale === "ja"
                ? "肌分析と成分情報をもとに整理したK-Beautyおすすめ結果です。"
                : "Personalized K-beauty product recommendations with ingredient research and where to buy in your country."
          }
        />
      </Head>
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col overflow-x-hidden px-4 py-8 sm:px-6 sm:py-10">
        {/* Header */}
        <header className="mb-6 flex min-w-0 flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#B8860B]">
              {locale === "ko"
                ? "K-뷰티 추천"
                : locale === "ja"
                  ? "K-Beautyおすすめ"
                  : "K-Beauty Recommendations"}
            </p>
            <h1 className="mt-3 font-['Playfair_Display',serif] text-2xl font-semibold tracking-tight text-[#1A1A1A] sm:text-3xl md:text-4xl">
              {messages.results_title}
            </h1>
            <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
            {aiApplied ? (
              <div className="mt-3">
                <span className="inline-flex rounded-full border border-pink-200 bg-white px-3 py-1 text-xs font-semibold text-[#C2185B]">
                  {aiBadgeText}
                </span>
              </div>
            ) : null}
            <Link
              href="/login?next=%2Fonboarding"
              className="touch-target mt-4 inline-flex items-center rounded-lg bg-[#C2185B] px-4 py-2 text-sm font-semibold text-white"
            >
              내 피부 관리 시작하기
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setLocale("en")}
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
              onClick={() => setLocale("ja")}
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
              onClick={() => setLocale("ko")}
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

        {/* AI 피부 관리 정보 + 랭킹 제품 (기존 카드 유지) */}
        {storageReady ? (
          <section className="mb-10" aria-label="AI recommendation">
            {hasSavedRecommendation ? (
              <div className="space-y-8">
                {savedRecommendation ? (
                  <div className="space-y-6 border-b border-pink-100 pb-8">
                    {(() => {
                      const summaryKo = pickKoreanSummary(savedRecommendation);
                      const skinType =
                        savedRecommendation.skinType?.trim() ?? "";
                      const concerns = nonEmptyList(
                        savedRecommendation.skinConcerns
                      );
                      const recommended = nonEmptyList(
                        savedRecommendation.recommendedIngredients
                      );
                      const avoid = nonEmptyList(
                        savedRecommendation.ingredientsToAvoid
                      );
                      const allergyTags = nonEmptyList(
                        savedRecommendation.allergyIngredients
                      );
                      const avoidedTags = nonEmptyList(
                        savedRecommendation.avoidedIngredients
                      );
                      const safetyExcluded =
                        typeof savedRecommendation.safetyExcludedCount ===
                          "number" &&
                        savedRecommendation.safetyExcludedCount > 0
                          ? savedRecommendation.safetyExcludedCount
                          : 0;
                      const safetyIncomplete =
                        typeof savedRecommendation.safetyIncompleteCount ===
                          "number" &&
                        savedRecommendation.safetyIncompleteCount > 0
                          ? savedRecommendation.safetyIncompleteCount
                          : 0;
                      const showSafetyNotice =
                        allergyTags.length > 0 ||
                        avoidedTags.length > 0 ||
                        safetyExcluded > 0 ||
                        safetyIncomplete > 0;
                      const currentProducts =
                        savedRecommendation.currentProducts ?? [];
                      const currentRoutineIssues = nonEmptyList(
                        savedRecommendation.currentRoutineIssues
                      );
                      const duplicateFunctions = nonEmptyList(
                        savedRecommendation.duplicateFunctions
                      );
                      const routineSimplificationSuggestions = nonEmptyList(
                        savedRecommendation.routineSimplificationSuggestions
                      );
                      const currentProductWarnings = nonEmptyList(
                        savedRecommendation.currentProductWarnings
                      );
                      const suggestedMorningOrder = nonEmptyList(
                        savedRecommendation.suggestedMorningOrder
                      );
                      const suggestedEveningOrder = nonEmptyList(
                        savedRecommendation.suggestedEveningOrder
                      );
                      const hasIrritationReaction = currentProducts.some(
                        (p) =>
                          p.reaction === "stinging" ||
                          p.reaction === "redness" ||
                          p.reaction === "breakout"
                      );
                      const hasNameOnlyProduct = currentProducts.some(
                        (p) =>
                          !p.keyIngredients || p.keyIngredients.length === 0
                      );
                      const showCurrentRoutine =
                        currentProducts.length > 0 ||
                        currentRoutineIssues.length > 0 ||
                        duplicateFunctions.length > 0 ||
                        routineSimplificationSuggestions.length > 0 ||
                        currentProductWarnings.length > 0 ||
                        suggestedMorningOrder.length > 0 ||
                        suggestedEveningOrder.length > 0;
                      const manageable = nonEmptyList(
                        savedRecommendation.manageableWithCosmetics
                      );
                      const limitations = nonEmptyList(
                        savedRecommendation.cosmeticLimitations
                      );
                      const morning = nonEmptyList(
                        savedRecommendation.morningRoutine
                      );
                      const evening = nonEmptyList(
                        savedRecommendation.eveningRoutine
                      );
                      // suggested*가 있으면 일반 루틴과 중복 노출하지 않음 (섹션당 1회)
                      const morningSteps =
                        suggestedMorningOrder.length > 0
                          ? suggestedMorningOrder
                          : morning;
                      const eveningSteps =
                        suggestedEveningOrder.length > 0
                          ? suggestedEveningOrder
                          : evening;
                      const precautions = nonEmptyList(
                        savedRecommendation.precautions
                      );
                      const notRecommended = nonEmptyList(
                        savedRecommendation.notRecommendedReasons
                      );
                      const expertReasons = nonEmptyList(
                        savedRecommendation.expertReferralReasons
                      );
                      const level = savedRecommendation.managementLevel;
                      const risk = isRiskManagementLevel(level);
                      const confidence = confidencePercent(
                        savedRecommendation.confidenceScore
                      );

                      return (
                        <>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#C2185B]">
                              {locale === "ko"
                                ? "AI 피부 분석"
                                : locale === "ja"
                                  ? "AI肌分析"
                                  : "AI Skin Guide"}
                            </p>
                            <h2 className="mt-2 font-['Playfair_Display',serif] text-2xl font-semibold text-gray-900 sm:text-3xl">
                              {locale === "ko"
                                ? "피부 관리 가이드"
                                : locale === "ja"
                                  ? "スキンケアガイド"
                                  : "Skin Care Guide"}
                            </h2>
                            <p className="mt-2 text-xs text-gray-500">
                              {locale === "ko"
                                ? "의료 진단이 아닌 K-Beauty 정보 안내입니다."
                                : locale === "ja"
                                  ? "医療診断ではなく、K-Beauty情報ガイドです。"
                                  : "Informational K-Beauty guidance — not a medical diagnosis."}
                            </p>
                          </div>

                          {/* 위험 단계: 결과 최상단 강조 */}
                          {risk ? (
                            <div
                              className="border-l-2 border-[#8B1E3F] bg-[#FDF6F8] py-4 pl-4 pr-3"
                              role="status"
                            >
                              <p className="text-sm font-semibold text-[#8B1E3F]">
                                {managementLevelLabelKo(level)}
                              </p>
                              <p className="mt-1.5 text-sm leading-relaxed text-gray-700">
                                {locale === "ko"
                                  ? "제품 구매보다 안전한 확인이 먼저입니다. 아래 정보는 참고용이며, 증상을 진단하거나 치료를 대체하지 않습니다."
                                  : locale === "ja"
                                    ? "商品購入より安全確認が優先です。以下は参考情報であり、診断や治療の代わりにはなりません。"
                                    : "Safety checks come before shopping. Guidance below is informational and does not diagnose or treat conditions."}
                              </p>
                            </div>
                          ) : null}

                          {summaryKo ? (
                            <GuideBlock title="한국어 분석 요약">
                              <p className="max-w-3xl">{summaryKo}</p>
                            </GuideBlock>
                          ) : null}

                          {level ? (
                            <GuideBlock title="관리 단계">
                              <p
                                className={`font-medium tracking-wide ${
                                  risk ? "text-[#8B1E3F]" : "text-[#C2185B]"
                                }`}
                              >
                                {managementLevelLabelKo(level)}
                              </p>
                            </GuideBlock>
                          ) : null}

                          {skinType ? (
                            <GuideBlock title="피부 타입">
                              <p>{skinType}</p>
                            </GuideBlock>
                          ) : null}

                          {showSafetyNotice ? (
                            <div className="space-y-4 border-l-2 border-pink-200 bg-pink-50/40 py-4 pl-4 pr-3">
                              {allergyTags.length > 0 ? (
                                <GuideBlock title="입력한 알레르기 성분">
                                  <BulletList
                                    items={displayIngredientNames(
                                      allergyTags,
                                      locale
                                    )}
                                  />
                                </GuideBlock>
                              ) : null}
                              {avoidedTags.length > 0 ? (
                                <GuideBlock title="입력한 회피 성분">
                                  <BulletList
                                    items={displayIngredientNames(
                                      avoidedTags,
                                      locale
                                    )}
                                  />
                                </GuideBlock>
                              ) : null}
                              <p className="text-sm leading-relaxed text-gray-700">
                                {locale === "ko"
                                  ? "입력한 알레르기·회피 성분을 기준으로 추천 후보를 필터링했습니다."
                                  : locale === "ja"
                                    ? "入力したアレルギー・回避成分を基準に推薦候補をフィルタリングしました。"
                                    : "Candidate products were filtered using your allergy and avoided ingredient lists."}
                              </p>
                              {safetyExcluded > 0 || safetyIncomplete > 0 ? (
                                <p className="text-xs text-gray-600">
                                  {locale === "ko"
                                    ? [
                                        safetyExcluded > 0
                                          ? `알레르기·회피 매칭으로 제외 ${safetyExcluded}건`
                                          : null,
                                        safetyIncomplete > 0
                                          ? `성분 정보 부족으로 핵심 추천에서 제외 ${safetyIncomplete}건`
                                          : null,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ")
                                    : locale === "ja"
                                      ? [
                                          safetyExcluded > 0
                                            ? `アレルギー・回避一致で除外 ${safetyExcluded}件`
                                            : null,
                                          safetyIncomplete > 0
                                            ? `成分情報不足でコア推薦から除外 ${safetyIncomplete}件`
                                            : null,
                                        ]
                                          .filter(Boolean)
                                          .join(" · ")
                                      : [
                                          safetyExcluded > 0
                                            ? `${safetyExcluded} excluded by allergy/avoid match`
                                            : null,
                                          safetyIncomplete > 0
                                            ? `${safetyIncomplete} excluded from core picks (incomplete ingredients)`
                                            : null,
                                        ]
                                          .filter(Boolean)
                                          .join(" · ")}
                                </p>
                              ) : null}
                              <p className="text-xs text-gray-500">
                                {locale === "ko"
                                  ? "제품 전성분은 변경될 수 있으므로, 구매 전 공식 전성분을 다시 확인하세요. 의료적 안전을 보장하지 않습니다."
                                  : locale === "ja"
                                    ? "製品の全成分は変わることがあるため、購入前に公式全成分を再確認してください。医療的安全性を保証するものではありません。"
                                    : "Full formulas can change — recheck the brand’s official ingredient list before purchase. This does not guarantee medical safety."}
                              </p>
                            </div>
                          ) : null}

                          {showCurrentRoutine ? (
                            <div className="space-y-5 border-t border-pink-100 pt-6">
                              <div>
                                <h3 className="text-sm font-semibold text-gray-900">
                                  {locale === "ko"
                                    ? "현재 루틴 점검"
                                    : locale === "ja"
                                      ? "現在のルーティン点検"
                                      : "Current Routine Check"}
                                </h3>
                                <p className="mt-1 text-xs text-gray-500">
                                  {locale === "ko"
                                    ? "등록한 제품과 입력 성분만 근거로 한 참고 안내입니다."
                                    : locale === "ja"
                                      ? "登録製品と入力成分のみに基づく参考案内です。"
                                      : "Guidance based only on products and ingredients you entered."}
                                </p>
                              </div>

                              {hasIrritationReaction ? (
                                <div
                                  className="border-l-2 border-[#8B1E3F] bg-[#FDF6F8] py-3 pl-4 pr-3"
                                  role="status"
                                >
                                  <p className="text-sm font-semibold text-[#8B1E3F]">
                                    {locale === "ko"
                                      ? "자극 반응이 있는 제품이 있습니다"
                                      : locale === "ja"
                                        ? "刺激反応がある製品があります"
                                        : "A product reaction was reported"}
                                  </p>
                                  <p className="mt-1 text-sm text-gray-700">
                                    {locale === "ko"
                                      ? "새 제품 추가보다 사용 중단 검토와 루틴 단순화를 우선하세요."
                                      : locale === "ja"
                                        ? "新しい製品追加より、使用中止の検討とルーティン単純化を優先してください。"
                                        : "Prioritize pausing and simplifying before adding new products."}
                                  </p>
                                </div>
                              ) : null}

                              {currentProducts.length > 0 ? (
                                <GuideBlock
                                  title={
                                    locale === "ko"
                                      ? "등록한 현재 제품"
                                      : locale === "ja"
                                        ? "登録中の使用製品"
                                        : "Registered current products"
                                  }
                                >
                                  <ul className="space-y-2">
                                    {currentProducts.map((p) => (
                                      <li
                                        key={p.id}
                                        className="text-sm text-gray-700"
                                      >
                                        <span className="font-medium text-gray-900">
                                          {p.brandName
                                            ? `${displayBrandName(p.brandName, locale) ?? p.brandName} · ${p.productName}`
                                            : p.productName}
                                        </span>
                                        <span className="mt-0.5 block text-xs text-gray-500">
                                          {[
                                            p.category,
                                            p.usageTime === "morning"
                                              ? locale === "ko"
                                                ? "아침"
                                                : "AM"
                                              : p.usageTime === "evening"
                                                ? locale === "ko"
                                                  ? "저녁"
                                                  : "PM"
                                                : p.usageTime === "both"
                                                  ? locale === "ko"
                                                    ? "아침·저녁"
                                                    : "AM/PM"
                                                  : null,
                                            p.reaction === "stinging" ||
                                            p.reaction === "redness" ||
                                            p.reaction === "breakout"
                                              ? locale === "ko"
                                                ? `반응: ${p.reaction}`
                                                : `reaction: ${p.reaction}`
                                              : null,
                                          ]
                                            .filter(Boolean)
                                            .join(" · ")}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </GuideBlock>
                              ) : null}

                              {hasNameOnlyProduct ? (
                                <p className="text-xs text-gray-500">
                                  {locale === "ko"
                                    ? "제품명만 입력된 항목은 전성분을 추측하지 않았습니다."
                                    : locale === "ja"
                                      ? "製品名のみの項目は全成分を推測していません。"
                                      : "Products with only a name were not assigned guessed full formulas."}
                                </p>
                              ) : null}

                              {duplicateFunctions.length > 0 ? (
                                <GuideBlock title="중복 기능">
                                  <BulletList items={duplicateFunctions} />
                                </GuideBlock>
                              ) : null}
                              {currentRoutineIssues.length > 0 ? (
                                <GuideBlock title="현재 루틴 문제">
                                  <BulletList items={currentRoutineIssues} />
                                </GuideBlock>
                              ) : null}
                              {routineSimplificationSuggestions.length > 0 ? (
                                <GuideBlock title="단순화 제안">
                                  <BulletList
                                    items={routineSimplificationSuggestions}
                                  />
                                </GuideBlock>
                              ) : null}
                              {currentProductWarnings.length > 0 ? (
                                <GuideBlock title="현재 제품 주의사항">
                                  <BulletList items={currentProductWarnings} />
                                </GuideBlock>
                              ) : null}
                            </div>
                          ) : null}

                          {/* 프로필: 고민·성분 */}
                          {(concerns.length > 0 ||
                            recommended.length > 0 ||
                            avoid.length > 0) && (
                            <div className="space-y-5">
                              {concerns.length > 0 ? (
                                <GuideBlock title="주요 피부 고민">
                                  <BulletList items={concerns} />
                                </GuideBlock>
                              ) : null}
                              {recommended.length > 0 ? (
                                <GuideBlock title="추천 성분">
                                  <BulletList
                                    items={displayIngredientNames(
                                      recommended,
                                      locale
                                    )}
                                  />
                                </GuideBlock>
                              ) : null}
                              {avoid.length > 0 ? (
                                <GuideBlock title="피해야 할 성분">
                                  <BulletList
                                    items={displayIngredientNames(
                                      avoid,
                                      locale
                                    )}
                                  />
                                </GuideBlock>
                              ) : null}
                            </div>
                          )}

                          {manageable.length > 0 ? (
                            <GuideBlock title="화장품으로 관리 가능한 범위">
                              <BulletList items={manageable} />
                            </GuideBlock>
                          ) : null}

                          {/* 아침·저녁 루틴: suggested* 우선, 없으면 morning/evening (중복 섹션 금지) */}
                          {(morningSteps.length > 0 || eveningSteps.length > 0) && (
                            <div className="space-y-5">
                              {morningSteps.length > 0 ? (
                                <GuideBlock
                                  title={
                                    suggestedMorningOrder.length > 0
                                      ? "권장 아침 사용 순서"
                                      : "아침 루틴"
                                  }
                                >
                                  <NumberedList items={morningSteps} />
                                </GuideBlock>
                              ) : null}
                              {eveningSteps.length > 0 ? (
                                <GuideBlock
                                  title={
                                    suggestedEveningOrder.length > 0
                                      ? "권장 저녁 사용 순서"
                                      : "저녁 루틴"
                                  }
                                >
                                  <NumberedList items={eveningSteps} />
                                </GuideBlock>
                              ) : null}
                            </div>
                          )}

                          {precautions.length > 0 ? (
                            <GuideBlock title="주의사항">
                              <BulletList items={precautions} />
                            </GuideBlock>
                          ) : null}

                          {notRecommended.length > 0 ? (
                            <GuideBlock title="추천하지 않는 이유">
                              <BulletList items={notRecommended} />
                            </GuideBlock>
                          ) : null}

                          {/* 제품 추천보다 먼저: 한계·전문가 상담 */}
                          {(limitations.length > 0 ||
                            expertReasons.length > 0) && (
                            <div className="space-y-5 border-t border-pink-50 pt-5">
                              {limitations.length > 0 ? (
                                <GuideBlock title="화장품의 한계">
                                  <BulletList items={limitations} />
                                </GuideBlock>
                              ) : null}
                              {expertReasons.length > 0 ? (
                                <GuideBlock title="전문가 상담 이유">
                                  <BulletList items={expertReasons} />
                                </GuideBlock>
                              ) : null}
                            </div>
                          )}

                          {confidence > 0 ? (
                            <GuideBlock title="분석 신뢰도">
                              <p>{confidence}%</p>
                            </GuideBlock>
                          ) : null}

                          <Link
                            href="/analyze"
                            className="inline-block text-xs font-semibold text-[#C2185B] underline hover:no-underline"
                          >
                            {locale === "ko"
                              ? "분석 다시 하기"
                              : locale === "ja"
                                ? "再分析する"
                                : "Re-analyze"}
                          </Link>
                        </>
                      );
                    })()}
                  </div>
                ) : null}

                {/* AI 핵심 추천 Top 5 — 한국 verified offer 제품만 */}
                {rankedProducts.length > 0 ? (
                  <div className="rounded-2xl border border-[#C2185B]/25 bg-gradient-to-b from-pink-50/80 to-white p-4 sm:p-6">
                    <h3 className="font-['Playfair_Display',serif] text-xl font-semibold text-gray-900 sm:text-2xl">
                      {locale === "ko"
                        ? "나를 위한 핵심 추천 제품"
                        : locale === "ja"
                          ? "あなたへのコアおすすめ"
                          : "Your core recommendations"}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
                      {isRiskManagementLevel(
                        savedRecommendation?.managementLevel
                      )
                        ? locale === "ko"
                          ? "AI 피부 분석 성분 매칭 기반의 참고용 Top 5입니다. 구매 유도가 아닌 정보 안내이며, 의료 진단을 대체하지 않습니다."
                          : locale === "ja"
                            ? "AI肌分析の成分マッチに基づく参考Top5です。購入誘導ではなく情報案内であり、医療診断の代わりにはなりません。"
                            : "Top 5 matched from your AI skin analysis. For reference only — not a purchase push or medical diagnosis."
                        : locale === "ko"
                          ? "한국에서 판매처·원화 가격·재고·구매 링크가 확인된 제품만 표시합니다."
                          : locale === "ja"
                            ? "韓国で販売先・KRW価格・在庫・購入リンクが確認できた製品のみ表示します。"
                            : "Only products with verified KR retailers, KRW price, stock, and purchase links."}
                    </p>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-semibold text-gray-600">
                        {locale === "ko"
                          ? "배송 국가 (구매처 기준)"
                          : locale === "ja"
                            ? "配送国（購入先基準）"
                            : "Shipping country (retailers)"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            { code: "KR" as const, label: "KR" },
                            { code: "US" as const, label: "US" },
                            { code: "JP" as const, label: "JP" },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.code}
                            type="button"
                            onClick={() => setShippingCountry(opt.code)}
                            className={`min-h-9 rounded-full px-3.5 text-xs font-semibold transition ${
                              countryCode === opt.code
                                ? "bg-[#C2185B] text-white"
                                : "border border-pink-200 bg-white text-gray-700 hover:bg-pink-50"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-gray-500">
                      {locale === "ko"
                        ? "핵심 추천은 한국 verified offer 제품만 포함합니다."
                        : locale === "ja"
                          ? "コアおすすめは韓国verified offer製品のみです。"
                          : "Core picks include only KR verified-offer products."}
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {rankedProducts.map((ranked, index) => (
                        <RecommendedProductCard
                          key={ranked.product.id}
                          rank={index + 1}
                          ranked={ranked}
                          locale={locale}
                          countryCode={countryCode ?? "KR"}
                        />
                      ))}
                    </div>
                  </div>
                ) : storageReady && savedRecommendation != null ? (
                  <div className="rounded-2xl border border-pink-100 bg-pink-50/40 p-5 sm:p-6">
                    <h3 className="font-['Playfair_Display',serif] text-xl font-semibold text-gray-900">
                      {locale === "ko"
                        ? "나를 위한 핵심 추천 제품"
                        : locale === "ja"
                          ? "あなたへのコアおすすめ"
                          : "Your core recommendations"}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-gray-700">
                      {locale === "ko"
                        ? "현재 확인된 판매처 정보가 없습니다. 마지막 확인: 미확인 (한국 verified offer·원화 가격·재고가 확인된 추천 제품이 아직 없습니다)."
                        : locale === "ja"
                          ? "確認済みの販売先情報がありません。最終確認: 未確認（韓国verified offer・KRW価格・在庫が確認できたおすすめはまだありません）。"
                          : "No verified retailer information available. Last checked: unknown (no core picks with verified KR offers yet)."}
                    </p>
                    <Link
                      href="/analyze"
                      className="mt-4 inline-block text-xs font-semibold text-[#C2185B] underline hover:no-underline"
                    >
                      {locale === "ko"
                        ? "분석 다시 하기"
                        : locale === "ja"
                          ? "再分析する"
                          : "Re-analyze"}
                    </Link>
                  </div>
                ) : null}

                {!savedRecommendation && rankedProducts.length > 0 ? (
                  <div className="pt-2">
                    <Link
                      href="/analyze"
                      className="text-xs font-semibold text-[#C2185B] underline hover:no-underline"
                    >
                      {locale === "ko"
                        ? "분석 다시 하기"
                        : locale === "ja"
                          ? "再分析する"
                          : "Re-analyze"}
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : aiApplied ? (
              <div className="border border-pink-100 bg-pink-50/40 px-6 py-8 text-center">
                <p className="text-base font-medium text-gray-800">
                  {locale === "ko"
                    ? "저장된 AI 추천 결과가 없습니다"
                    : locale === "ja"
                      ? "保存されたAIおすすめがありません"
                      : "No saved AI recommendation found"}
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  {locale === "ko"
                    ? "피부 분석을 먼저 진행해 주세요. 결과가 이 페이지에 표시됩니다."
                    : locale === "ja"
                      ? "先に肌分析を行ってください。結果がこのページに表示されます。"
                      : "Run a skin analysis first. Results will appear here."}
                </p>
                <Link href="/analyze" className="mt-5 inline-block">
                  <span className="inline-flex items-center justify-center rounded-full bg-[#C2185B] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#a3154f]">
                    {locale === "ko"
                      ? "AI 분석으로 이동"
                      : locale === "ja"
                        ? "AI分析へ"
                        : "Go to AI Analyze"}
                  </span>
                </Link>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* 일반 제품 탐색 — Top 5와 시각적으로 분리 */}
        <section
          className="mt-4 flex-1 border-t border-pink-100 pt-10"
          aria-label="Browse products"
        >
          <div className="mb-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gray-400">
              {locale === "ko"
                ? "탐색"
                : locale === "ja"
                  ? "探索"
                  : "Browse"}
            </p>
            <h2 className="mt-2 font-['Playfair_Display',serif] text-xl font-semibold text-gray-900 sm:text-2xl">
              {locale === "ko"
                ? "다른 제품 둘러보기"
                : locale === "ja"
                  ? "ほかの製品を見る"
                  : "Browse more products"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-500">
              {locale === "ko"
                ? "핵심 추천과 별도로, 관심 있는 제품을 검색·즐겨찾기하며 둘러볼 수 있습니다."
                : locale === "ja"
                  ? "コアおすすめとは別に、検索やお気に入りで製品を探せます。"
                  : "Separate from your core picks — search and favorite products to explore."}
            </p>
          </div>

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
          {browseProducts.length === 0 ? (
            <div className="rounded-2xl border border-pink-100 bg-pink-50/40 p-8 text-center">
              <p className="text-base font-medium text-gray-700">
                {locale === "ko"
                  ? "더 둘러볼 제품이 없습니다"
                  : locale === "ja"
                    ? "他に表示する製品がありません"
                    : "No more products to browse"}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {locale === "ko"
                  ? "검색어를 바꾸거나 퀴즈 조건을 조정해 보세요."
                  : locale === "ja"
                    ? "検索条件やクイズ条件を変えてみてください。"
                    : "Try a different search or quiz filters."}
              </p>
              <Link href="/quiz" className="mt-4 inline-block">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full bg-[#C2185B] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#a3154f]"
                >
                  {locale === "ko"
                    ? "퀴즈 다시 하기"
                    : locale === "ja"
                      ? "クイズをやり直す"
                      : "Retake quiz"}
                </button>
              </Link>
            </div>
          ) : (
          <>
          <div className="grid gap-6 md:grid-cols-3">
            {visibleBrowseProducts.map((product) => {
              const keyIngredients = displayIngredientNames(
                product.key_ingredients ?? [],
                locale
              );

              // slug는 항상 영문 key_ingredients[0]을 변환해 사용 (배지 표시는 keyIngredients로 locale 구분)
              const firstIngredientSlug =
                product.key_ingredients && product.key_ingredients.length > 0
                  ? ingredientNameToSlug(product.key_ingredients[0])
                  : "";

              const isFavorite = favoriteIds.includes(product.id);
              const hasKrVerifiedOffer = productHasKrVerifiedCoreOffer(
                product as CandidateProduct
              );

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
                    {displayBrandName(product.brand, locale) ?? product.brand}
                  </div>
                  {!hasKrVerifiedOffer ? (
                    <p className="mb-2 inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                      {locale === "ko"
                        ? "현재 확인된 판매처 정보가 없습니다"
                        : locale === "ja"
                          ? "確認済みの販売先情報がありません"
                          : "No verified retailer information"}
                    </p>
                  ) : null}
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
          {!catalogExpanded &&
          browseProducts.length > CATALOG_PREVIEW_COUNT ? (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setCatalogExpanded(true)}
                className="inline-flex items-center justify-center rounded-full border border-pink-200 bg-white px-6 py-2.5 text-sm font-semibold text-[#C2185B] transition hover:bg-pink-50"
              >
                {locale === "ko"
                  ? `더 보기 (${browseProducts.length - CATALOG_PREVIEW_COUNT})`
                  : locale === "ja"
                    ? `もっと見る (${browseProducts.length - CATALOG_PREVIEW_COUNT})`
                    : `Show more (${browseProducts.length - CATALOG_PREVIEW_COUNT})`}
              </button>
            </div>
          ) : null}
          {catalogExpanded &&
          browseProducts.length > CATALOG_PREVIEW_COUNT ? (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setCatalogExpanded(false)}
                className="inline-flex items-center justify-center rounded-full border border-pink-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-pink-50"
              >
                {locale === "ko"
                  ? "접기"
                  : locale === "ja"
                    ? "閉じる"
                    : "Show less"}
              </button>
            </div>
          ) : null}
          </>
          )}
        </section>

        {/* Footer actions */}
        <footer className="mt-12 flex items-center justify-between border-t border-gray-100 pt-6">
          <p className="text-xs text-gray-500">
            {locale === "ko"
              ? "이 추천은 참고용 출발점입니다. 새 제품은 반드시 패치 테스트를 하세요."
              : locale === "ja"
                ? "このおすすめは参考の出発点です。新しい製品は必ずパッチテストを。"
                : "These recommendations are a starting point. Always patch test new products."}
          </p>
          <Link href="/quiz">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-[#C2185B] bg-white px-5 py-2 text-xs font-semibold text-[#C2185B] transition hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {locale === "ko"
                ? "처음부터 다시"
                : locale === "ja"
                  ? "最初から"
                  : "Start Over"}
            </button>
          </Link>
        </footer>
      </main>
    </div>
  );
}

