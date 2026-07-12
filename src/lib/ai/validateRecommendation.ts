import type { Recommendation } from "@/lib/recommend";
import { AnalyzeSkinError } from "./errors";
import type { NormalizedRecommendation } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 문자열만 남기고 trim · 빈값 제거 · 중복 제거(대소문자 무시, 첫 표기 유지) */
export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return NaN;
  return Math.min(1, Math.max(0, n));
}

function readConfidence(raw: Record<string, unknown>): number | null {
  const candidates = [
    raw.confidenceScore,
    raw.confidence_score,
    raw.confidence,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) {
      return clamp01(c > 1 ? c / 100 : c);
    }
    if (typeof c === "string" && c.trim() !== "") {
      const n = Number(c);
      if (Number.isFinite(n)) return clamp01(n > 1 ? n / 100 : n);
    }
  }
  return null;
}

/**
 * 프로바이더 원본 → Recommendation 검증·정규화.
 * 잘못된 형태면 PARSE 오류.
 */
export function validateRecommendation(raw: unknown): Recommendation {
  if (!isRecord(raw)) {
    throw new AnalyzeSkinError(
      "Malformed provider response: expected an object.",
      500,
      "PARSE"
    );
  }

  // recommendation 중첩 또는 평탄 JSON 모두 허용
  const nested = isRecord(raw.recommendation) ? raw.recommendation : null;
  const src = nested ?? raw;

  const skinConcerns = normalizeStringArray(
    src.skinConcerns ?? src.skin_concerns ?? src.concerns
  );
  const recommendedIngredients = normalizeStringArray(
    src.recommendedIngredients ??
      src.recommended_ingredients ??
      src.ingredients
  );
  const ingredientsToAvoid = normalizeStringArray(
    src.ingredientsToAvoid ??
      src.ingredients_to_avoid ??
      src.avoid_ingredients ??
      src.avoidIngredients
  );

  // 배열 필드가 아예 없으면(키·값 모두 없음) 거절 — 세 배열이 전부 비어도 거절
  const hasConcernKey =
    "skinConcerns" in src ||
    "skin_concerns" in src ||
    "concerns" in src;
  const hasIngredientKey =
    "recommendedIngredients" in src ||
    "recommended_ingredients" in src ||
    "ingredients" in src;
  const hasAvoidKey =
    "ingredientsToAvoid" in src ||
    "ingredients_to_avoid" in src ||
    "avoid_ingredients" in src ||
    "avoidIngredients" in src;

  if (!hasConcernKey && !hasIngredientKey && !hasAvoidKey) {
    throw new AnalyzeSkinError(
      "Malformed provider response: missing recommendation fields.",
      500,
      "PARSE"
    );
  }

  if (
    skinConcerns.length === 0 &&
    recommendedIngredients.length === 0 &&
    ingredientsToAvoid.length === 0
  ) {
    throw new AnalyzeSkinError(
      "Malformed provider response: empty recommendation arrays.",
      500,
      "PARSE"
    );
  }

  const confidence = readConfidence(src) ?? readConfidence(raw);
  if (confidence === null || Number.isNaN(confidence)) {
    throw new AnalyzeSkinError(
      "Malformed provider response: invalid confidenceScore.",
      500,
      "PARSE"
    );
  }

  const normalized: NormalizedRecommendation = {
    skinConcerns,
    recommendedIngredients,
    ingredientsToAvoid,
    confidenceScore: confidence,
  };

  return normalized;
}
