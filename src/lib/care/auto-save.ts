import { saveAnalysisSessionFromLocalRecommendation, loadCareStore } from "@/lib/care/local-store";
import type { Recommendation } from "@/lib/recommend/types";

const ANALYSIS_STORAGE_KEY = "skinAnalysisResult";

function normalizedStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function careFingerprint(
  recommendation: Recommendation,
  rankedProductIds: string[]
): string {
  return JSON.stringify({
    concerns: normalizedStrings(recommendation.skinConcerns),
    recommendedIngredients: normalizedStrings(
      recommendation.recommendedIngredients
    ),
    allergyIngredients: normalizedStrings(recommendation.allergyIngredients),
    avoidedIngredients: normalizedStrings(recommendation.avoidedIngredients),
    managementLevel: recommendation.managementLevel ?? null,
    confidenceScore:
      typeof recommendation.confidenceScore === "number"
        ? Math.round(recommendation.confidenceScore * 1000) / 1000
        : null,
    rankedProductIds: [...new Set(rankedProductIds)].sort((a, b) =>
      a.localeCompare(b)
    ),
  });
}

function sessionFingerprint(session: {
  recommendationSnapshot?: Record<string, unknown> | null;
  rankedProductIds?: string[] | null;
}): string | null {
  const snapshot = session.recommendationSnapshot;
  if (!snapshot || typeof snapshot !== "object") return null;
  const recommendation = snapshot as unknown as Recommendation;
  if (!Array.isArray(recommendation.skinConcerns)) return null;
  return careFingerprint(recommendation, session.rankedProductIds ?? []);
}

/**
 * 분석 완료 직후 브라우저 케어 기록을 자동 생성한다.
 * 같은 추천·같은 제품 조합은 중복 저장하지 않는다.
 * 서버 동기화는 /my hydration/API 흐름에서 별도로 처리한다.
 */
export function autoSaveCompletedAnalysisToCare(input: {
  recommendation: Recommendation;
  rankedProductIds: string[];
  country?: string | null;
}): { saved: boolean; sessionCount: number } {
  if (typeof window === "undefined") return { saved: false, sessionCount: 0 };

  const store = loadCareStore();
  const fingerprint = careFingerprint(
    input.recommendation,
    input.rankedProductIds
  );
  const duplicate = store.sessions.some(
    (session) => sessionFingerprint(session) === fingerprint
  );
  if (duplicate) {
    return { saved: false, sessionCount: store.sessions.length };
  }

  let analysis: Record<string, unknown> = {};
  try {
    const raw = window.localStorage.getItem(ANALYSIS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      analysis = parsed as Record<string, unknown>;
    }
  } catch {
    // 손상된 분석 캐시는 무시하고 추천 스냅샷만 저장한다.
  }

  const next = saveAnalysisSessionFromLocalRecommendation({
    analysis,
    recommendation: input.recommendation as unknown as Record<string, unknown>,
    rankedProductIds: [...new Set(input.rankedProductIds)].filter(Boolean),
    allergyIngredients: input.recommendation.allergyIngredients ?? [],
    avoidedIngredients: input.recommendation.avoidedIngredients ?? [],
    concerns: input.recommendation.skinConcerns ?? [],
    skinType: input.recommendation.skinType ?? null,
    sensitivity: null,
    undertone: null,
    toneDepth: null,
    country: input.country ?? "KR",
    consentCareTracking: true,
  });

  return { saved: true, sessionCount: next.sessions.length };
}
