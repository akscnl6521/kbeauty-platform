import type { ManagementLevel, Recommendation } from "@/lib/recommend";
import { AnalyzeSkinError } from "./errors";

const MANAGEMENT_LEVELS: readonly ManagementLevel[] = [
  "cosmetic_care",
  "observe",
  "combined_care",
  "expert_first",
  "urgent_check",
] as const;

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

function readOptionalString(
  src: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const v = src[key];
    if (typeof v === "string") return v.trim();
  }
  return undefined;
}

function readManagementLevel(src: Record<string, unknown>): ManagementLevel {
  const raw = src.managementLevel ?? src.management_level;
  if (typeof raw === "string") {
    const v = raw.trim() as ManagementLevel;
    if ((MANAGEMENT_LEVELS as readonly string[]).includes(v)) {
      return v;
    }
  }
  return "observe";
}

/**
 * 프로바이더 원본 → Recommendation 검증·정규화.
 * 필수 4필드만 엄격 검증. Master Plan 확장 필드는 선택·관대 정규화.
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

  const skinType = readOptionalString(src, "skinType", "skin_type");
  const summaryKo = readOptionalString(
    src,
    "summaryKo",
    "summary_ko",
    "summaryKO"
  );
  const summaryEn = readOptionalString(
    src,
    "summaryEn",
    "summary_en",
    "summaryEN"
  );
  const summaryJa = readOptionalString(
    src,
    "summaryJa",
    "summary_ja",
    "summaryJA"
  );

  // 새 배열 필드: 없거나 잘못되면 빈 배열 (오류 아님)
  const manageableWithCosmetics = normalizeStringArray(
    src.manageableWithCosmetics ?? src.manageable_with_cosmetics
  );
  const cosmeticLimitations = normalizeStringArray(
    src.cosmeticLimitations ?? src.cosmetic_limitations
  );
  const morningRoutine = normalizeStringArray(
    src.morningRoutine ?? src.morning_routine
  );
  const eveningRoutine = normalizeStringArray(
    src.eveningRoutine ?? src.evening_routine
  );
  const precautions = normalizeStringArray(src.precautions);
  const notRecommendedReasons = normalizeStringArray(
    src.notRecommendedReasons ?? src.not_recommended_reasons
  );
  const expertReferralReasons = normalizeStringArray(
    src.expertReferralReasons ?? src.expert_referral_reasons
  );
  const allergyIngredients = normalizeStringArray(
    src.allergyIngredients ?? src.allergy_ingredients
  );
  const avoidedIngredients = normalizeStringArray(
    src.avoidedIngredients ?? src.avoided_ingredients
  );

  const hasExtendedHints =
    skinType !== undefined ||
    "managementLevel" in src ||
    "management_level" in src ||
    "manageableWithCosmetics" in src ||
    "manageable_with_cosmetics" in src ||
    "cosmeticLimitations" in src ||
    "cosmetic_limitations" in src ||
    "morningRoutine" in src ||
    "morning_routine" in src ||
    "eveningRoutine" in src ||
    "evening_routine" in src ||
    "precautions" in src ||
    "notRecommendedReasons" in src ||
    "not_recommended_reasons" in src ||
    "expertReferralReasons" in src ||
    "expert_referral_reasons" in src ||
    summaryKo !== undefined ||
    summaryEn !== undefined ||
    summaryJa !== undefined;

  const base: Recommendation = {
    skinConcerns,
    recommendedIngredients,
    ingredientsToAvoid,
    confidenceScore: confidence,
    ...(allergyIngredients.length ? { allergyIngredients } : {}),
    ...(avoidedIngredients.length ? { avoidedIngredients } : {}),
  };

  // 확장 필드가 전혀 없는 레거시 응답은 필수 4필드만 반환 (하위 호환)
  if (!hasExtendedHints) {
    return base;
  }

  return {
    ...base,
    skinType: skinType ?? "",
    managementLevel: readManagementLevel(src),
    manageableWithCosmetics,
    cosmeticLimitations,
    morningRoutine,
    eveningRoutine,
    precautions,
    notRecommendedReasons,
    expertReferralReasons,
    summaryKo: summaryKo ?? "",
    summaryEn: summaryEn ?? "",
    summaryJa: summaryJa ?? "",
  };
}
