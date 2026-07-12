/**
 * Shared types for the recommendation pipeline (Phase 1+).
 * Ranking / product search types will extend these later.
 */

/** Raw AI analysis payload shape used by the analyze UI. */
export type AnalysisResult = {
  skin_type: string;
  concerns: string[];
  ingredients: string[];
  summary_en: string;
  summary_ko: string;
  summary_ja: string;
  routine_tips: string[];
};

/**
 * Structured recommendation derived from AI analysis.
 * Product search / ranking consume the required fields;
 * optional Master Plan fields are additive for UI/care guidance.
 */
export type ManagementLevel =
  | "cosmetic_care"
  | "observe"
  | "combined_care"
  | "expert_first"
  | "urgent_check";

/** 현재 사용 제품 사용 시점 */
export type CurrentProductUsageTime = "morning" | "evening" | "both";

/** 현재 사용 제품에 대한 사용자 반응 (자가 보고) */
export type CurrentProductReaction =
  | "comfortable"
  | "dryness"
  | "stinging"
  | "redness"
  | "breakout"
  | "unknown";

/**
 * 피부 분석 단계에서 사용자가 등록하는 현재 사용 제품.
 * 이번 단계는 직접 입력만 — 이후 DB 검색 연동을 위해 id·카테고리 필드를 유지한다.
 */
export type CurrentProductInput = {
  id: string;
  productName: string;
  brandName?: string;
  category?: string;
  usageTime?: CurrentProductUsageTime;
  usageFrequency?: string;
  keyIngredients?: string[];
  reaction?: CurrentProductReaction;
};

export interface Recommendation {
  /** Normalized skin concerns (e.g. Redness, Dryness). */
  skinConcerns: string[];
  /** Ingredients suggested for the profile. */
  recommendedIngredients: string[];
  /** Ingredients to avoid or de-prioritize. */
  ingredientsToAvoid: string[];
  /** Confidence in [0, 1]. */
  confidenceScore: number;

  /** 사용자가 입력한 알레르기 성분 (선택) */
  allergyIngredients?: string[];
  /** 사용자가 입력한 회피 성분 (선택) */
  avoidedIngredients?: string[];
  /** 안전 필터로 제외된 후보 수 (선택) */
  safetyExcludedCount?: number;
  /** 성분 정보 부족으로 핵심 추천에서 제외된 후보 수 (선택) */
  safetyIncompleteCount?: number;

  /** 사용자가 등록한 현재 사용 제품 (선택) */
  currentProducts?: CurrentProductInput[];
  /** 현재 루틴에서 보이는 문제 */
  currentRoutineIssues?: string[];
  /** 중복 기능 안내 */
  duplicateFunctions?: string[];
  /** 루틴 단순화 제안 */
  routineSimplificationSuggestions?: string[];
  /** 현재 제품 관련 주의 */
  currentProductWarnings?: string[];
  /** 권장 아침 사용 순서 */
  suggestedMorningOrder?: string[];
  /** 권장 저녁 사용 순서 */
  suggestedEveningOrder?: string[];

  /** 추정 피부 타입 안내 (진단 아님) */
  skinType?: string;
  /** 화장품 관리 가능 수준 분류 */
  managementLevel?: ManagementLevel;
  /** 화장품으로 관리 가능해 보이는 범위 */
  manageableWithCosmetics?: string[];
  /** 화장품만으로 한계가 있는 부분 */
  cosmeticLimitations?: string[];
  morningRoutine?: string[];
  eveningRoutine?: string[];
  precautions?: string[];
  notRecommendedReasons?: string[];
  expertReferralReasons?: string[];
  summaryKo?: string;
  summaryEn?: string;
  summaryJa?: string;
}

/** localStorage key for the structured recommendation (Phase 1). */
export const RECOMMENDATION_STORAGE_KEY = "skinRecommendation";

/** Existing analyze UI storage key — keep writing AnalysisResult here. */
export const ANALYSIS_RESULT_STORAGE_KEY = "skinAnalysisResult";

/** POST /api/analyze 응답 source (mock|ollama|openai|anthropic) 저장 키 */
export const ANALYZE_SOURCE_STORAGE_KEY = "skinAnalyzeSource";

/**
 * Phase 3B — 랭킹 Top N 제품 저장 키.
 * analyze UI에는 아직 표시하지 않고, 이후 results 연결용으로만 보관한다.
 */
export const RANKED_PRODUCTS_STORAGE_KEY = "skinRankedProducts";

/** Top N 개수 (Phase 3B 고정) */
export const RANKED_PRODUCTS_TOP_N = 5;

/**
 * 랭킹 입력용 최소 제품 형태 (Phase 2).
 * Supabase 행을 그대로 넘겨도 되고, 테스트용 mock도 가능.
 * UI/DB 계층과 분리하기 위해 여기만 정의한다.
 */
export interface RankableProduct {
  id: string;
  /** 제품 주요 성분 (배열 또는 DB에서 온 문자열) */
  key_ingredients?: string[] | string | null;
  /** 일본어 성분 표기가 있으면 매칭에 함께 사용 */
  key_ingredients_ja?: string[] | string | null;
  /** 피부 고민 태그 (선택 — 향후 가산에 사용 가능) */
  skin_concern?: string | null;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  price_usd?: number | null;
}

/**
 * rankProducts() 한 건의 결과.
 * 원본 제품 + 점수 + 매칭/제외 성분 목록.
 */
export interface RankedProduct<T extends RankableProduct = RankableProduct> {
  product: T;
  /** 추천 적합도 점수 (높을수록 우선). 보통 0 이상. */
  score: number;
  /** recommendation.recommendedIngredients 와 교집합으로 매칭된 성분 */
  matchedIngredients: string[];
  /** recommendation.ingredientsToAvoid 와 교집합으로 걸린 성분 */
  excludedIngredients: string[];
}

/**
 * Phase 3A / Sprint 3 Phase 3A — Supabase에서 로드한 후보 제품.
 * RankableProduct(랭킹) + 표시·구매링크 필드.
 * 이미지 컬럼은 프로젝트 코드에 존재하지 않아 포함하지 않는다.
 */
export interface CandidateProduct extends RankableProduct {
  id: string;
  name: string | null;
  name_ko: string | null;
  name_ja: string | null;
  brand: string | null;
  category: string | null;
  skin_concern: string | null;
  skin_tone: string | null;
  key_ingredients: string[] | null;
  key_ingredients_ja: string[] | null;
  price_usd: number | null;
  recommendation_reason: string | null;
  recommendation_reason_ko: string | null;
  recommendation_reason_ja: string | null;
  /** 제품 slug (results 페이지와 동일 컬럼) */
  slug: string | null;
  /** 구매/마켓 링크 — results/page.tsx 에서 확인된 컬럼만 */
  link_sephora: string | null;
  link_amazon_us: string | null;
  link_amazon_jp: string | null;
  link_qoo10: string | null;
  link_oliveyoung: string | null;
  link_coupang: string | null;
  link_yesstyle: string | null;
}

/** fetchCandidateProducts 옵션 */
export type FetchCandidateProductsOptions = {
  /** 최대 행 수 (기본 10000 — 기존 results 페이지와 동일 상한) */
  limit?: number;
};
