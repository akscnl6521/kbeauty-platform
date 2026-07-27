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
  faceExplorerZoneApplicationAreas,
  isFaceExplorerZone,
} from "@/lib/media/usageGuideApplicationArea";
import {
  displayIngredientNames,
  fetchOffersByProductIds,
  getShippingCountryLabel,
  loadLatestRecommendationPipeline,
  productHasKrVerifiedCoreOffer,
  purgeLegacyRecommendationCaches,
  type CandidateProduct,
  type ManagementLevel,
  type ProductOffer,
  type RankedProduct,
  type Recommendation,
} from "@/lib/recommend";
import {
  displayBrandName,
  displayProductTitle,
  getCanonicalBrandName,
  isKoreanBeautyBrand,
} from "@/lib/brand/displayBrandName";
import {
  evidenceCitationHref,
  evidenceLevelLabelKo,
} from "@/lib/evidence";
import { filterPublicCatalogProducts } from "@/lib/recommend/publicCatalogFilter";
import { ResultsDomainTabs } from "@/components/results/ResultsDomainTabs";

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

const REDNESS_NON_DIAGNOSIS_KO =
  "입력하신 내용은 붉어 보이는 피부 상태에 대한 참고 정보이며, 원인을 진단한 결과는 아닙니다.";

const EXPERT_MIN_CARE_STEPS_KO = [
  "부드러운 세안",
  "기본 보습",
  "자외선 차단",
  "새 제품·강한 각질 제거·고함량 활성 성분 추가는 상담 전까지 자제",
] as const;

function normalizeSafetyPhrase(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** 일반 비진단·상담 반복 문구 (구체적 이유와 구분) */
function isGenericSafetyBoilerplate(text: string): boolean {
  const n = normalizeSafetyPhrase(text);
  return (
    n.includes("원인을 진단한 결과는 아닙니다") ||
    n.includes("의료 진단이 아니며") ||
    n.includes("의료 진단이 아닌") ||
    n.includes("진단하거나 치료를 대체하지 않습니다") ||
    n.includes("not a medical diagnosis") ||
    n.includes("does not diagnose")
  );
}

function filterSafetyBoilerplate(
  items: string[],
  removeGeneric: boolean
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const t = item.trim();
    if (!t) continue;
    if (removeGeneric && isGenericSafetyBoilerplate(t)) continue;
    const key = normalizeSafetyPhrase(t);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function stripBoilerplateFromSummary(summary: string): string {
  const parts = summary
    .split(/(?<=[.。!?？])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const kept = parts.filter((s) => !isGenericSafetyBoilerplate(s));
  return (kept.length > 0 ? kept.join(" ") : summary).trim();
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

type ScenarioStatusBadge =
  | "scenario_matched"
  | "recommendations_ready"
  | "insufficient_verified_candidates"
  | "no_matching_scenario"
  | "safety_escalation";

function scenarioBadgeLabel(
  badge: ScenarioStatusBadge,
  locale: Locale
): string {
  if (locale !== "ko") {
    const labels: Record<ScenarioStatusBadge, string> = {
      scenario_matched: "Scenario matched",
      recommendations_ready: "Recommendations ready",
      insufficient_verified_candidates: "Verified products still limited",
      no_matching_scenario: "No matching scenario",
      safety_escalation: "Professional care first",
    };
    return labels[badge];
  }
  const labels: Record<ScenarioStatusBadge, string> = {
    scenario_matched: "scenario_matched",
    recommendations_ready: "recommendations_ready",
    insufficient_verified_candidates: "insufficient_verified_candidates",
    no_matching_scenario: "no_matching_scenario",
    safety_escalation: "safety_escalation",
  };
  return labels[badge];
}

function scenarioDisplayNameKo(scenarioId?: string | null): string | null {
  if (!scenarioId) return null;
  const labels: Record<string, string> = {
    "kr-redness-sensitive-cream": "민감·홍조 진정 크림",
    "pilot-dryness-barrier-serum": "건조·장벽 세럼",
    "kr-acne-pores-toner": "여드름·피지 토너",
    "kr-uv-sunscreen-sensitive": "민감 피부 선크림",
    "kr-aging-eye-cream": "탄력·건조 아이크림",
  };
  return labels[scenarioId] ?? scenarioId;
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
  /**
   * product_offers 병합분. 핵심 추천 경로(fetchCandidateProducts)와 동일한
   * 근거로 판매처 배지를 판정하기 위해 필요하다. 없으면
   * productHasKrVerifiedCoreOffer 가 항상 false 가 되어, 검증된 오퍼가 있는
   * 제품에도 "확인된 판매처 정보가 없습니다"가 뜬다.
   */
  offers?: ProductOffer[] | null;
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
  /** expert_first: 일반 제품 탐색 기본 접힘 */
  const [riskBrowseExpanded, setRiskBrowseExpanded] = useState(false);
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
  const areaParam = searchParams.get("area");
  const usageGuideApplicationAreas = useMemo(() => {
    if (!areaParam || !isFaceExplorerZone(areaParam)) return undefined;
    return faceExplorerZoneApplicationAreas(areaParam);
  }, [areaParam]);

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
      ? "이 결과는 피부톤, 피부 고민, 언더톤, 가격대와 문진·입력 기반 AI 가이드를 기준으로 정리되었습니다."
      : locale === "ja"
        ? "肌トーン・肌悩み・アンダートーン・価格帯と問診・入力ベースのAIガイド情報を基準に整理した結果です。"
        : "Results organized by skin tone, concerns, undertone, price tier, and questionnaire-based AI guide insights.";

  const aiApplied = searchParams.get("ai") === "1";
  const aiBadgeText =
    locale === "ko"
      ? "AI 가이드 반영됨"
      : locale === "ja"
        ? "AIガイド適用"
        : "AI Guide Applied";

  const hasSavedRecommendation =
    (savedRecommendation != null &&
      (savedRecommendation.skinConcerns.length > 0 ||
        savedRecommendation.recommendedIngredients.length > 0 ||
        savedRecommendation.confidenceScore > 0)) ||
    rankedProducts.length > 0;

  const isRiskResults = isRiskManagementLevel(
    savedRecommendation?.managementLevel
  );
  const scenarioPilot = savedRecommendation?.scenarioPilot;
  const scenarioPilotDetails = savedRecommendation?.scenarioPilotDetails;
  const scenarioMatched = Boolean(scenarioPilot?.scenarioId);
  const scenarioBadges: ScenarioStatusBadge[] = [];
  if (scenarioMatched) scenarioBadges.push("scenario_matched");
  if (isRiskResults) {
    scenarioBadges.push("safety_escalation");
  } else if (scenarioPilot?.status === "ok" && rankedProducts.length > 0) {
    scenarioBadges.push("recommendations_ready");
  } else if (
    scenarioPilot?.status === "insufficient_verified_candidates"
  ) {
    scenarioBadges.push("insufficient_verified_candidates");
  } else if (scenarioPilot?.status === "no_match") {
    scenarioBadges.push("no_matching_scenario");
  }
  const hideCatalogBrowse =
    isRiskResults ||
    scenarioPilot?.status === "insufficient_verified_candidates" ||
    scenarioPilot?.status === "no_match";

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
          .eq("active", true)
          .not("verified_at", "is", null)
          .limit(10000);

        if (fetchError) {
          console.error("[Supabase products fetch error]", fetchError);
          setError(fetchError.message);
          return;
        }
        const rows = filterPublicCatalogProducts(
          ((data as ProductRow[]) ?? []).map((row) => ({
            ...row,
            brand: getCanonicalBrandName(row.brand) ?? row.brand,
          }))
        );

        // 핵심 추천 경로와 같은 오퍼 근거를 붙인다. 실패해도 목록 자체는
        // 보여준다 — 그 경우 판매처 배지만 보수적으로 표시된다.
        let withOffers = rows;
        try {
          const offerMap = await fetchOffersByProductIds(
            rows.map((row) => String(row.id))
          );
          if (offerMap.size > 0) {
            withOffers = rows.map((row) => ({
              ...row,
              offers: offerMap.get(String(row.id)) ?? null,
            }));
          }
        } catch (offerError) {
          console.error("[product offers fetch failed]", offerError);
        }

        setProducts(withOffers);
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
                    <ResultsDomainTabs
                      skinTone={savedRecommendation.skinType?.trim() ?? ""}
                      undertone={
                        typeof (savedRecommendation as { undertone?: string })
                          .undertone === "string"
                          ? (savedRecommendation as { undertone?: string })
                              .undertone
                          : undefined
                      }
                      hasSkincare={rankedProducts.length > 0}
                      mascaraHints={[
                        "워터프루프·컬링·볼륨·롱래쉬 선호를 문진과 함께 반영합니다.",
                        "민감한 눈이면 워터프루프 세정 난이도를 먼저 확인하세요.",
                      ]}
                      lipHints={[
                        "언더톤·매트/글로시·착색 선호로 립 후보를 좁힙니다.",
                        "건조한 입술이면 매트보다 보습·글로시 속성을 우선합니다.",
                      ]}
                      scalpHints={[
                        "건성·지성·민감 두피와 비듬·손상·열 손상은 헤어 도메인에서 별도 매칭합니다.",
                      ]}
                      morningSteps={nonEmptyList(
                        savedRecommendation.suggestedMorningOrder
                      )}
                      eveningSteps={nonEmptyList(
                        savedRecommendation.suggestedEveningOrder
                      )}
                      cautions={nonEmptyList(
                        savedRecommendation.ingredientsToAvoid
                      ).slice(0, 6)}
                    />
                    {scenarioBadges.length > 0 ? (
                      <div className="rounded-3xl border border-[#C2185B]/15 bg-[#FCF7F8] p-4 sm:p-5">
                        <div className="flex flex-wrap gap-2">
                          {scenarioBadges.map((badge) => (
                            <span
                              key={badge}
                              className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${
                                badge === "safety_escalation"
                                  ? "bg-[#8B1E3F] text-white"
                                  : badge === "recommendations_ready"
                                    ? "bg-[#1f6b45] text-white"
                                    : "border border-[#C2185B]/20 bg-white text-[#7A2447]"
                              }`}
                            >
                              {scenarioBadgeLabel(badge, locale)}
                            </span>
                          ))}
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7A2447]">
                              {locale === "ko" ? "매칭된 피부 관리 상황" : "Matched care scenario"}
                            </p>
                            <p className="mt-1 text-base font-semibold text-gray-900">
                              {scenarioDisplayNameKo(scenarioPilot?.scenarioId) ??
                                (locale === "ko"
                                  ? "검증 시나리오 매칭 없음"
                                  : "No verified scenario match")}
                            </p>
                            {scenarioPilot?.matchReason ? (
                              <p className="mt-2 break-words text-xs leading-relaxed text-gray-600">
                                {locale === "ko"
                                  ? `매칭 근거: ${scenarioPilot.matchReason}`
                                  : `Match reason: ${scenarioPilot.matchReason}`}
                              </p>
                            ) : null}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-2xl bg-white px-3 py-2">
                              <p className="text-[11px] text-gray-500">
                                {locale === "ko" ? "검증 제품 수" : "Verified count"}
                              </p>
                              <p className="mt-1 font-semibold text-gray-900">
                                {scenarioPilot?.verifiedCount ?? rankedProducts.length}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white px-3 py-2">
                              <p className="text-[11px] text-gray-500">
                                {locale === "ko" ? "최종 추천 수" : "Top picks"}
                              </p>
                              <p className="mt-1 font-semibold text-gray-900">
                                {rankedProducts.length}
                              </p>
                            </div>
                            {scenarioPilot?.candidatePoolVersion ? (
                              <div className="col-span-2 rounded-2xl bg-white px-3 py-2">
                                <p className="text-[11px] text-gray-500">
                                  {locale === "ko" ? "추천 기준 스냅샷" : "Snapshot"}
                                </p>
                                <p className="mt-1 break-words text-xs text-gray-700">
                                  {scenarioPilot.candidatePoolVersion}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        {scenarioPilot?.userMessageKo ? (
                          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-relaxed text-amber-900">
                            {locale === "ko"
                              ? scenarioPilot.userMessageKo
                              : "Verified products are still being expanded for this situation."}
                          </div>
                        ) : null}
                        {scenarioPilotDetails ? (
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            {scenarioPilotDetails.recommendationReasons.length > 0 ? (
                              <GuideBlock
                                title={locale === "ko" ? "추천 이유" : "Why these products"}
                              >
                                <BulletList
                                  items={scenarioPilotDetails.recommendationReasons.slice(0, 5)}
                                />
                              </GuideBlock>
                            ) : null}
                            <GuideBlock
                              title={locale === "ko" ? "사용 범위와 한계" : "Scope and limits"}
                            >
                              <div className="space-y-2">
                                <p>{scenarioPilotDetails.expectedCosmeticScope}</p>
                                <p className="text-gray-600">
                                  {scenarioPilotDetails.limitations}
                                </p>
                              </div>
                            </GuideBlock>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
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
                      const hasRednessObservation = Boolean(
                        savedRecommendation.rednessObservation
                      );
                      const summaryDisplay = risk
                        ? stripBoilerplateFromSummary(summaryKo)
                        : summaryKo;
                      const precautionsDisplay = filterSafetyBoilerplate(
                        precautions,
                        risk
                      );
                      const notRecommendedDisplay = filterSafetyBoilerplate(
                        notRecommended,
                        risk
                      );
                      const expertReasonsDisplay = filterSafetyBoilerplate(
                        expertReasons,
                        risk
                      );
                      const limitationsDisplay = filterSafetyBoilerplate(
                        limitations,
                        risk
                      );
                      const confidence = confidencePercent(
                        savedRecommendation.confidenceScore
                      );

                      return (
                        <>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#C2185B]">
                              {locale === "ko"
                                ? "AI 피부 가이드"
                                : locale === "ja"
                                  ? "AIスキンガイド"
                                  : "AI Skin Guide"}
                            </p>
                            <h2 className="mt-2 font-['Playfair_Display',serif] text-2xl font-semibold text-gray-900 sm:text-3xl">
                              {locale === "ko"
                                ? "피부 관리 가이드"
                                : locale === "ja"
                                  ? "スキンケアガイド"
                                  : "Skin Care Guide"}
                            </h2>
                            {/* 전역 고지 1회 — redness 전용 문구와 중복하지 않음 */}
                            {!hasRednessObservation ? (
                              <p className="mt-2 text-xs text-gray-500">
                                {locale === "ko"
                                  ? "의료 진단이 아닌 K-Beauty 정보 안내입니다."
                                  : locale === "ja"
                                    ? "医療診断ではなく、K-Beauty情報ガイドです。"
                                    : "Informational K-Beauty guidance — not a medical diagnosis."}
                              </p>
                            ) : null}
                          </div>

                          {/* A. 상담 우선 → 구체 이유 → (redness) 비진단 고지 1회 */}
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
                                  ? "제품 선택보다 상태 확인이 우선입니다."
                                  : locale === "ja"
                                    ? "商品選びより状態確認が優先です。"
                                    : "Confirming your status comes before product choices."}
                              </p>
                              {expertReasonsDisplay.length > 0 ? (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8B1E3F]">
                                    {locale === "ko"
                                      ? "상담이 필요한 이유"
                                      : locale === "ja"
                                        ? "相談が必要な理由"
                                        : "Why counseling first"}
                                  </p>
                                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm leading-relaxed text-gray-700">
                                    {expertReasonsDisplay.map((reason) => (
                                      <li key={reason}>{reason}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          {hasRednessObservation ? (
                            <p className="max-w-3xl text-sm leading-relaxed text-gray-600">
                              {locale === "ko"
                                ? REDNESS_NON_DIAGNOSIS_KO
                                : locale === "ja"
                                  ? "入力内容は赤みに見える肌状態の参考情報であり、原因を診断した結果ではありません。"
                                  : "Your inputs are reference notes about how redness appears — not a diagnosis of its cause."}
                            </p>
                          ) : null}

                          {summaryDisplay ? (
                            <GuideBlock title="한국어 분석 요약">
                              <p className="max-w-3xl">{summaryDisplay}</p>
                            </GuideBlock>
                          ) : null}

                          {/* 일반 결과만 관리 단계 블록 (risk는 배너에 이미 표시) */}
                          {level && !risk ? (
                            <GuideBlock title="관리 단계">
                              <p className="font-medium tracking-wide text-[#C2185B]">
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
                                <GuideBlock
                                  title={
                                    risk
                                      ? "보조적으로 참고할 수 있는 성분"
                                      : "추천 성분"
                                  }
                                >
                                  {risk ? (
                                    <p className="mb-2 max-w-3xl text-sm leading-relaxed text-gray-600">
                                      새로운 활성 성분을 추가하기보다, 자극을
                                      줄이고 기본 보습을 유지하는 데 참고할 수
                                      있는 성분입니다.
                                    </p>
                                  ) : null}
                                  <BulletList
                                    items={displayIngredientNames(
                                      recommended,
                                      locale
                                    )}
                                  />
                                </GuideBlock>
                              ) : null}
                              {(savedRecommendation.evidenceLinks?.length ??
                                0) > 0 ? (
                                <GuideBlock title="증상 → 성분 공개 근거">
                                  <p className="mb-2 max-w-3xl text-sm leading-relaxed text-gray-600">
                                    {locale === "ko"
                                      ? "논문·공식 공개 출처를 성분–고민 힌트로만 표시합니다. 제품 전체 효능을 단정하지 않습니다."
                                      : "Public ingredient–concern citations only — not product cure claims."}
                                  </p>
                                  <ul className="space-y-2 text-sm text-gray-700">
                                    {(savedRecommendation.evidenceLinks ?? [])
                                      .slice(0, 6)
                                      .map((ev) => {
                                        const href = evidenceCitationHref(ev);
                                        return (
                                          <li key={ev.id}>
                                            <span className="font-medium">
                                              {ev.concernNameKo ??
                                                ev.concernCode}
                                            </span>
                                            {" → "}
                                            <span>
                                              {ev.ingredientNameKo ||
                                                ev.ingredientNameEn}
                                            </span>
                                            {" · "}
                                            <span className="text-gray-500">
                                              {evidenceLevelLabelKo(
                                                ev.evidenceLevel
                                              )}
                                            </span>
                                            {ev.pmid ? (
                                              <>
                                                {" · "}
                                                {href ? (
                                                  <a
                                                    href={href}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[#C2185B] underline hover:no-underline"
                                                  >
                                                    PMID {ev.pmid}
                                                  </a>
                                                ) : (
                                                  <span>PMID {ev.pmid}</span>
                                                )}
                                              </>
                                            ) : null}
                                          </li>
                                        );
                                      })}
                                  </ul>
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

                          {risk ? (
                            <GuideBlock title="상담 전 최소 관리">
                              <BulletList
                                items={[...EXPERT_MIN_CARE_STEPS_KO]}
                              />
                            </GuideBlock>
                          ) : (
                            <>
                              {manageable.length > 0 ? (
                                <GuideBlock title="화장품으로 관리 가능한 범위">
                                  <BulletList items={manageable} />
                                </GuideBlock>
                              ) : null}

                              {(morningSteps.length > 0 ||
                                eveningSteps.length > 0) && (
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
                            </>
                          )}

                          {precautionsDisplay.length > 0 ? (
                            <GuideBlock title="주의사항">
                              <BulletList items={precautionsDisplay} />
                            </GuideBlock>
                          ) : null}

                          {notRecommendedDisplay.length > 0 ? (
                            <GuideBlock title="추천하지 않는 이유">
                              <BulletList items={notRecommendedDisplay} />
                            </GuideBlock>
                          ) : null}

                          {(savedRecommendation.safetyExcludedItems?.length ?? 0) > 0 ? (
                            <GuideBlock title="추천 후보에서 제외된 제품">
                              <ul className="space-y-1.5">
                                {savedRecommendation.safetyExcludedItems!.map((item) => (
                                  <li
                                    key={item.productId}
                                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                                  >
                                    <span>{item.productName}</span>
                                    <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-600">
                                      {item.reason === "allergy_or_avoided"
                                        ? "알레르기·회피 성분 포함"
                                        : "성분 정보 부족"}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </GuideBlock>
                          ) : null}

                          {/* 한계·(일반만) 전문가 상담 — risk 상담 이유는 상단 배너에 표시 */}
                          {(limitationsDisplay.length > 0 ||
                            (!risk && expertReasonsDisplay.length > 0)) && (
                            <div className="space-y-5 border-t border-pink-50 pt-5">
                              {limitationsDisplay.length > 0 ? (
                                <GuideBlock title="화장품의 한계">
                                  <BulletList items={limitationsDisplay} />
                                </GuideBlock>
                              ) : null}
                              {!risk && expertReasonsDisplay.length > 0 ? (
                                <GuideBlock title="전문가 상담 이유">
                                  <BulletList items={expertReasonsDisplay} />
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

                {/* AI 핵심 추천 — expert_first는 구매 권유 대신 보조 관리용 한국 제품 */}
                {isRiskResults ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[#8B1E3F]/20 bg-[#FDF6F8] p-5 sm:p-6">
                      <h3 className="font-['Playfair_Display',serif] text-xl font-semibold text-gray-900 sm:text-2xl">
                        {locale === "ko"
                          ? "현재는 제품 선택보다 상태 확인이 우선입니다"
                          : locale === "ja"
                            ? "今は製品選びより状態確認が優先です"
                            : "Confirming your status comes before product choices"}
                      </h3>
                      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-700">
                        {locale === "ko"
                          ? "새 제품 구매는 전문가 상담 또는 상태가 안정된 뒤 검토하세요. 아래는 구매 권유가 아닌 보조 관리용 한국 제품 참고입니다."
                          : locale === "ja"
                            ? "新しい製品の購入は、専門家相談後または状態が安定してから検討してください。以下は購入推奨ではなく補助ケア用の韓国製品参考です。"
                            : "Review new purchases after counseling or once skin has stabilized. Below are supportive Korean-product references — not purchase pushes."}
                      </p>
                    </div>
                    {rankedProducts.length > 0 ? (
                      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
                        <h3 className="font-['Playfair_Display',serif] text-xl font-semibold text-gray-900 sm:text-2xl">
                          {locale === "ko"
                            ? "보조 관리용 한국 제품"
                            : locale === "ja"
                              ? "補助ケア用の韓国製品"
                              : "Supportive Korean products"}
                        </h3>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
                          {locale === "ko"
                            ? "자극이 강한 활성 성분은 제외했습니다. 성분·선택 항목과의 연결만 참고하세요."
                            : locale === "ja"
                              ? "刺激の強い活性成分は除外しています。成分と選択項目のつながりだけ参考にしてください。"
                              : "Strong actives are excluded. Use ingredient–selection links as reference only."}
                        </p>
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {rankedProducts.map((ranked, index) => (
                            <RecommendedProductCard
                              key={ranked.product.id}
                              rank={index + 1}
                              ranked={ranked}
                              locale={locale}
                              countryCode={countryCode ?? "KR"}
                              hidePurchaseCta
                              softCareMode
                              recommendation={savedRecommendation}
                              applicationAreas={usageGuideApplicationAreas}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : rankedProducts.length > 0 ? (
                  <div className="rounded-2xl border border-[#C2185B]/25 bg-gradient-to-b from-pink-50/80 to-white p-4 sm:p-6">
                    <h3 className="font-['Playfair_Display',serif] text-xl font-semibold text-gray-900 sm:text-2xl">
                      {locale === "ko"
                        ? "나를 위한 핵심 추천 제품"
                        : locale === "ja"
                          ? "あなたへのコアおすすめ"
                          : "Your core recommendations"}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
                      {locale === "ko"
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
                            { code: "KR" as const },
                            { code: "US" as const },
                            { code: "JP" as const },
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
                            {getShippingCountryLabel(opt.code, locale)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-gray-500">
                      {locale === "ko"
                        ? "피부 적합도와 성분 매칭을 통과하고, 한국 판매처·가격·재고가 확인된 제품만 핵심 추천에 표시합니다."
                        : locale === "ja"
                          ? "肌適合度と成分マッチを通過し、韓国の販売先・価格・在庫が確認できた製品のみコアおすすめに表示します。"
                          : "Core picks require skin-fit and ingredient match plus confirmed KR retailer, price, and stock."}
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {rankedProducts.map((ranked, index) => (
                        <RecommendedProductCard
                          key={ranked.product.id}
                          rank={index + 1}
                          ranked={ranked}
                          locale={locale}
                          countryCode={countryCode ?? "KR"}
                          recommendation={savedRecommendation}
                          applicationAreas={usageGuideApplicationAreas}
                        />
                      ))}
                    </div>
                  </div>
                ) : storageReady && savedRecommendation != null ? (
                  <div className="rounded-2xl border border-pink-100 bg-pink-50/40 p-5 sm:p-6">
                    <h3 className="font-['Playfair_Display',serif] text-xl font-semibold text-gray-900">
                      {locale === "ko"
                        ? scenarioPilot?.status ===
                          "insufficient_verified_candidates"
                          ? "검증 제품 보강 중"
                          : scenarioPilot?.status === "no_match"
                            ? "현재는 검증된 추천 시나리오와 맞지 않습니다"
                            : "나를 위한 핵심 추천 제품"
                        : locale === "ja"
                          ? "あなたへのコアおすすめ"
                          : "Your core recommendations"}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-gray-700">
                      {locale === "ko"
                        ? scenarioPilot?.userMessageKo ??
                          "현재 조건에 맞고 판매처까지 확인된 제품을 준비 중입니다."
                        : locale === "ja"
                          ? "現在の条件に合い、販売先まで確認できた製品を準備中です。"
                          : "We're preparing products that match your criteria and have a verified retailer."}
                    </p>
                    {scenarioPilot?.shortageReason ? (
                      <p className="mt-2 break-words text-sm leading-relaxed text-gray-600">
                        {locale === "ko"
                          ? `제외 사유: ${scenarioPilot.shortageReason}`
                          : `Reason: ${scenarioPilot.shortageReason}`}
                      </p>
                    ) : null}
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
                      ? "피부 가이드로 이동"
                      : locale === "ja"
                        ? "AI分析へ"
                        : "Go to AI Analyze"}
                  </span>
                </Link>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* 일반 제품 탐색 — expert_first는 기본 접힘 */}
        {!hideCatalogBrowse ? (
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
              {isRiskResults
                ? locale === "ko"
                  ? "상담 후 참고할 수 있는 일반 제품 정보"
                  : locale === "ja"
                    ? "相談後に参考にできる一般製品情報"
                    : "General product info after counseling"
                : locale === "ko"
                  ? "다른 제품 둘러보기"
                  : locale === "ja"
                    ? "ほかの製品を見る"
                    : "Browse more products"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-500">
              {isRiskResults
                ? locale === "ko"
                  ? "아래 정보는 현재 상태에 대한 구매 권유가 아닙니다."
                  : locale === "ja"
                    ? "以下の情報は、現在の状態に対する購入勧奨ではありません。"
                    : "The information below is not a purchase recommendation for your current status."
                : locale === "ko"
                  ? "핵심 추천과 별도로, 관심 있는 제품을 검색·즐겨찾기하며 둘러볼 수 있습니다."
                  : locale === "ja"
                    ? "コアおすすめとは別に、検索やお気に入りで製品を探せます。"
                    : "Separate from your core picks — search and favorite products to explore."}
            </p>
          </div>

          {isRiskResults && !riskBrowseExpanded ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-gray-600">
                {locale === "ko"
                  ? "상태가 안정된 뒤 제품 정보를 다시 확인할 수 있습니다. 필요하면 아래에서 참고용 정보를 펼칠 수 있습니다."
                  : locale === "ja"
                    ? "状態が安定してから製品情報を再確認できます。必要なら下から参考情報を開けます。"
                    : "You can revisit product info after your skin stabilizes. Expand below if you need reference details."}
              </p>
              <button
                type="button"
                aria-expanded={riskBrowseExpanded}
                aria-controls="expert-first-product-info"
                onClick={() => setRiskBrowseExpanded(true)}
                className="inline-flex items-center justify-center rounded-full border border-pink-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {locale === "ko"
                  ? "일반 제품 정보 펼치기"
                  : locale === "ja"
                    ? "一般製品情報を開く"
                    : "Show general product info"}
              </button>
            </div>
          ) : (
            <div
              id={isRiskResults ? "expert-first-product-info" : undefined}
            >
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
                  {!isRiskResults ? (
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
                  ) : (
                    <button
                      type="button"
                      aria-expanded={riskBrowseExpanded}
                      aria-controls="expert-first-product-info"
                      onClick={() => setRiskBrowseExpanded(false)}
                      className="inline-flex items-center justify-center rounded-full border border-pink-200 px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      {locale === "ko"
                        ? "접기"
                        : locale === "ja"
                          ? "閉じる"
                          : "Collapse"}
                    </button>
                  )}
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

                      const firstIngredientSlug =
                        product.key_ingredients &&
                        product.key_ingredients.length > 0
                          ? ingredientNameToSlug(product.key_ingredients[0])
                          : "";

                      const isFavorite = favoriteIds.includes(product.id);
                      const hasKrVerifiedOffer =
                        productHasKrVerifiedCoreOffer(
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
                            aria-label="제품 저장"
                            title="제품 저장"
                          >
                            <span
                              className={
                                isFavorite ? "text-[#C2185B]" : "text-gray-300"
                              }
                            >
                              {"🔖"}
                            </span>
                          </button>
                          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#B8860B]">
                            <span>
                              {displayBrandName(product.brand, locale) ??
                                product.brand}
                            </span>
                            {isKoreanBeautyBrand(product.brand) ? (
                              <span className="rounded-md border border-[#C2185B]/25 bg-[#C2185B]/08 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-[#C2185B]">
                                {locale === "ko" ? "한국 브랜드" : "K-Beauty"}
                              </span>
                            ) : null}
                          </div>
                          {!isRiskResults && !hasKrVerifiedOffer ? (
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

                          {!isRiskResults &&
                          priceTierText(product.price_usd, locale) ? (
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
                                {isRiskResults
                                  ? "제품 정보"
                                  : "추천 이유 보기"}
                              </button>
                              {product.key_ingredients?.length &&
                              firstIngredientSlug ? (
                                <Link
                                  href={`/ingredients/${firstIngredientSlug}`}
                                  className="inline-flex items-center justify-center rounded-full border border-[#C2185B] bg-transparent px-4 py-2 text-xs font-semibold text-[#C2185B] transition hover:bg-pink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2185B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFAF8]"
                                >
                                  성분 설명 보기
                                </Link>
                              ) : null}
                            </div>

                            {openReasonIds.includes(product.id) &&
                              ((locale === "ko" &&
                                product.recommendation_reason_ko) ||
                                (locale === "ja" &&
                                  product.recommendation_reason_ja) ||
                                product.recommendation_reason) && (
                                <div className="mt-3 rounded-2xl border border-pink-100 bg-pink-50/40 p-4">
                                  <p className="text-sm leading-relaxed text-gray-700">
                                    {locale === "ja" &&
                                    product.recommendation_reason_ja
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
            </div>
          )}
          </section>
        ) : null}

        {/* Footer actions */}
        <footer className="mt-12 flex items-center justify-between border-t border-gray-100 pt-6">
          <p className="text-xs text-gray-500">
            {isRiskResults
              ? locale === "ko"
                ? "이 안내는 참고용입니다. 새 제품 사용 전 전문가 상담을 우선하세요."
                : locale === "ja"
                  ? "この案内は参考用です。新しい製品使用前に専門家相談を優先してください。"
                  : "This guidance is for reference. Prioritize expert counseling before new products."
              : locale === "ko"
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

