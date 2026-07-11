import { fetchCandidateProducts } from "./fetchCandidateProducts";
import { rankProducts } from "./rankProducts";
import type { CandidateProduct, RankedProduct, Recommendation } from "./types";
import {
  RANKED_PRODUCTS_STORAGE_KEY,
  RANKED_PRODUCTS_TOP_N,
  RECOMMENDATION_STORAGE_KEY,
} from "./types";

/**
 * Recommendation 과 Top N 랭킹 결과를 LocalStorage에 함께 저장한다.
 * 키: skinRecommendation, skinRankedProducts
 */
function writeRecommendationAndRanked(
  recommendation: Recommendation,
  rankedJson: string
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RECOMMENDATION_STORAGE_KEY,
      JSON.stringify(recommendation)
    );
    window.localStorage.setItem(RANKED_PRODUCTS_STORAGE_KEY, rankedJson);
  } catch {
    // ignore quota/serialization errors
  }
}

/**
 * Phase 3B — Recommendation → 후보 로드 → 랭킹 → LocalStorage 저장.
 *
 * 반드시 두 키를 모두 저장한다:
 * - skinRecommendation (RECOMMENDATION_STORAGE_KEY)
 * - skinRankedProducts (RANKED_PRODUCTS_STORAGE_KEY)
 *
 * UI에 제품을 그리지 않는다. 저장만 수행한다.
 * 실패해도 호출측 분석 UI를 깨지 않도록 에러를 throw 하지 않고 로그만 남긴다.
 *
 * @returns 저장된 Top N (실패 시 빈 배열)
 */
export async function persistTopRankedProducts(
  recommendation: Recommendation
): Promise<RankedProduct<CandidateProduct>[]> {
  // 후보 조회 전에 Recommendation 을 먼저 저장 (조회 실패 시에도 키 존재 보장)
  writeRecommendationAndRanked(recommendation, "[]");

  try {
    // 1) Supabase 후보 제품 로드 (Phase 3A)
    const candidates = await fetchCandidateProducts();

    // 2) 성분 기반 점수 랭킹 (Phase 2)
    const ranked = rankProducts(recommendation, candidates);

    // 3) 상위 N개 + Recommendation 동시 저장
    const top = ranked.slice(0, RANKED_PRODUCTS_TOP_N);
    writeRecommendationAndRanked(recommendation, JSON.stringify(top));

    return top;
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[persistTopRankedProducts]", err.message);
    // 실패 시에도 두 키 유지 (랭킹은 빈 배열)
    writeRecommendationAndRanked(recommendation, "[]");
    return [];
  }
}

/** 랭킹 결과 LocalStorage 삭제 (분석 결과 초기화 시 함께 호출) */
export function clearPersistedRankedProducts(): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(RANKED_PRODUCTS_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}
