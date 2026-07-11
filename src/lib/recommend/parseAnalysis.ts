import type { AnalysisResult, Recommendation } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (trimmed) out.push(trimmed);
    } else if (typeof item === "number" && Number.isFinite(item)) {
      out.push(String(item));
    }
  }
  return out;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function readConfidence(raw: Record<string, unknown>): number | null {
  const candidates = [
    raw.confidence_score,
    raw.confidenceScore,
    raw.confidence,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) {
      // Allow 0–100 or 0–1
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
 * Heuristic confidence when the model does not return a score.
 * Based only on field completeness — not a medical certainty metric.
 */
function estimateConfidence(input: {
  skinType: string;
  skinConcerns: string[];
  recommendedIngredients: string[];
  ingredientsToAvoid: string[];
  hasSummary: boolean;
  hasRoutineTips: boolean;
}): number {
  let score = 0.35;
  if (input.skinType) score += 0.12;
  if (input.skinConcerns.length > 0) score += 0.18;
  if (input.recommendedIngredients.length > 0) score += 0.18;
  if (input.ingredientsToAvoid.length > 0) score += 0.05;
  if (input.hasSummary) score += 0.08;
  if (input.hasRoutineTips) score += 0.04;
  return clamp01(score);
}

function readSkinType(raw: Record<string, unknown>): string {
  const v = raw.skin_type ?? raw.skinType;
  return typeof v === "string" ? v.trim() : "";
}

function hasAnySummary(raw: Record<string, unknown>): boolean {
  return [raw.summary_en, raw.summary_ko, raw.summary_ja, raw.summary].some(
    (s) => typeof s === "string" && s.trim().length > 0
  );
}

/**
 * Normalize a loose AI JSON object into AnalysisResult for the existing UI.
 */
export function normalizeAnalysisResult(raw: unknown): AnalysisResult {
  const obj = isRecord(raw) ? raw : {};
  return {
    skin_type: readSkinType(obj),
    concerns: toStringArray(obj.concerns ?? obj.skin_concerns ?? obj.skinConcerns),
    ingredients: toStringArray(
      obj.ingredients ?? obj.recommended_ingredients ?? obj.recommendedIngredients
    ),
    summary_en:
      typeof obj.summary_en === "string"
        ? obj.summary_en
        : typeof obj.summaryEn === "string"
          ? obj.summaryEn
          : "",
    summary_ko:
      typeof obj.summary_ko === "string"
        ? obj.summary_ko
        : typeof obj.summaryKo === "string"
          ? obj.summaryKo
          : "",
    summary_ja:
      typeof obj.summary_ja === "string"
        ? obj.summary_ja
        : typeof obj.summaryJa === "string"
          ? obj.summaryJa
          : "",
    routine_tips: toStringArray(
      obj.routine_tips ?? obj.routineTips ?? obj.routine_tip
    ),
  };
}

/**
 * Convert AI analysis JSON into a structured Recommendation (Phase 1).
 * Does not query Supabase or rank products.
 */
export function toRecommendation(raw: unknown): Recommendation {
  const obj = isRecord(raw) ? raw : {};
  const analysis = normalizeAnalysisResult(obj);

  const skinConcerns = analysis.concerns;
  const recommendedIngredients = analysis.ingredients;
  const ingredientsToAvoid = toStringArray(
    obj.ingredients_to_avoid ??
      obj.ingredientsToAvoid ??
      obj.avoid_ingredients ??
      obj.avoidIngredients ??
      obj.ingredients_avoid
  );

  const explicit = readConfidence(obj);
  const confidenceScore =
    explicit ??
    estimateConfidence({
      skinType: analysis.skin_type,
      skinConcerns,
      recommendedIngredients,
      ingredientsToAvoid,
      hasSummary: hasAnySummary(obj),
      hasRoutineTips: analysis.routine_tips.length > 0,
    });

  return {
    skinConcerns,
    recommendedIngredients,
    ingredientsToAvoid,
    confidenceScore,
  };
}

/**
 * Parse model text (JSON or JSON embedded in prose) into Recommendation.
 */
export function parseAnalysisTextToRecommendation(contentText: string): {
  analysis: AnalysisResult;
  recommendation: Recommendation;
  raw: unknown;
} {
  let raw: unknown = null;
  try {
    raw = JSON.parse(contentText);
  } catch {
    const match = contentText.match(/\{[\s\S]*\}/);
    if (match) raw = JSON.parse(match[0]);
  }
  if (raw == null) {
    throw new Error("Failed to parse analysis result.");
  }
  const analysis = normalizeAnalysisResult(raw);
  const recommendation = toRecommendation(raw);
  return { analysis, recommendation, raw };
}
