/**
 * Sprint 3 Phase 2B — 개발 전용 성분 필드 형식 감사.
 * 점수·UI·스키마를 바꾸지 않고, Supabase products 의 실제 표기만 요약한다.
 */

import { coerceIngredientListUnknown } from "./normalizeIngredient";
import { normalizeIngredientKey } from "./normalizeIngredient";

/** fetch / 감사에 넘기는 한 행의 성분 원본 필드 */
export type IngredientAuditRow = {
  productId: string;
  key_ingredients: unknown;
  key_ingredients_ja: unknown;
};

export type IngredientFormatAuditSummary = {
  productCount: number;
  /** 파싱 후 고유 라벨 (원문) */
  uniqueLabels: string[];
  uniqueLabelCount: number;
  /** 정규화 키 → 원문 라벨들 (중복·이표기) */
  duplicatesAfterNormalization: Record<string, string[]>;
  duplicateNormalizedKeyCount: number;
  /** 언어 추정 샘플 */
  variants: {
    korean: string[];
    english: string[];
    japanese: string[];
    mixedOrOther: string[];
  };
  /** 원본 필드 형태 카운트 */
  rawFieldShapes: {
    nullOrUndefined: number;
    emptyArray: number;
    stringArray: number;
    jsonArrayString: number;
    jsonObjectString: number;
    postgresArrayLiteral: number;
    commaSeparatedString: number;
    plainString: number;
    other: number;
  };
  /** 비어 있거나 파싱 결과가 없는 제품 id 샘플 */
  emptyOrUnknownProductIds: string[];
  /** 기타/알 수 없는 원본 값 샘플 */
  unknownValueSamples: string[];
};

const HANGUL = /[\uac00-\ud7af]/;
const KANA = /[\u3040-\u30ff]/;
const CJK = /[\u3400-\u9fff]/;
const LATIN = /[a-zA-Z]/;

function classifyLabelLanguage(
  label: string
): "korean" | "english" | "japanese" | "mixedOrOther" {
  const hasKo = HANGUL.test(label);
  const hasJa = KANA.test(label) || (CJK.test(label) && !hasKo && !LATIN.test(label));
  const hasEn = LATIN.test(label);

  if (hasKo && !hasEn && !KANA.test(label)) return "korean";
  if (hasJa && !hasKo && !hasEn) return "japanese";
  if (hasEn && !hasKo && !KANA.test(label) && !CJK.test(label)) return "english";
  if (hasEn && !hasKo && !KANA.test(label)) return "english";
  return "mixedOrOther";
}

function describeRawShape(value: unknown): keyof IngredientFormatAuditSummary["rawFieldShapes"] {
  if (value == null) return "nullOrUndefined";
  if (Array.isArray(value)) {
    return value.length === 0 ? "emptyArray" : "stringArray";
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return "nullOrUndefined";
    if (t.startsWith("[") && t.endsWith("]")) return "jsonArrayString";
    if (t.startsWith("{") && t.endsWith("}") && !t.includes("=")) {
      // Postgres {a,b} vs JSON object {"a":1}
      if (t.includes(":")) return "jsonObjectString";
      return "postgresArrayLiteral";
    }
    if (t.startsWith("{") && t.endsWith("}")) return "jsonObjectString";
    if (/[,;/|]/.test(t)) return "commaSeparatedString";
    return "plainString";
  }
  return "other";
}

function samplePush(list: string[], value: string, max = 40) {
  if (list.length >= max) return;
  if (!list.includes(value)) list.push(value);
}

/**
 * 후보 제품(또는 raw 행)의 성분 필드 형식을 요약한다.
 * 추천 점수 계산에는 사용하지 않는다.
 */
export function auditIngredientFormats(
  rows: IngredientAuditRow[]
): IngredientFormatAuditSummary {
  const unique = new Set<string>();
  const byNormalized = new Map<string, Set<string>>();
  const variants = {
    korean: [] as string[],
    english: [] as string[],
    japanese: [] as string[],
    mixedOrOther: [] as string[],
  };
  const rawFieldShapes: IngredientFormatAuditSummary["rawFieldShapes"] = {
    nullOrUndefined: 0,
    emptyArray: 0,
    stringArray: 0,
    jsonArrayString: 0,
    postgresArrayLiteral: 0,
    jsonObjectString: 0,
    commaSeparatedString: 0,
    plainString: 0,
    other: 0,
  };
  const emptyOrUnknownProductIds: string[] = [];
  const unknownValueSamples: string[] = [];

  for (const row of rows) {
    const fields: unknown[] = [row.key_ingredients, row.key_ingredients_ja];
    let anyLabel = false;

    for (const field of fields) {
      const shape = describeRawShape(field);
      rawFieldShapes[shape] += 1;

      if (shape === "other") {
        samplePush(
          unknownValueSamples,
          `${row.productId}:${Object.prototype.toString.call(field)}`
        );
      }

      const labels = coerceIngredientListUnknown(field);
      if (labels.length > 0) anyLabel = true;

      for (const label of labels) {
        unique.add(label);
        const norm = normalizeIngredientKey(label);
        if (norm) {
          if (!byNormalized.has(norm)) byNormalized.set(norm, new Set());
          byNormalized.get(norm)!.add(label);
        }
        const lang = classifyLabelLanguage(label);
        samplePush(variants[lang], label);
      }
    }

    const bothEmpty =
      (row.key_ingredients == null ||
        (Array.isArray(row.key_ingredients) &&
          row.key_ingredients.length === 0) ||
        (typeof row.key_ingredients === "string" &&
          !row.key_ingredients.trim())) &&
      (row.key_ingredients_ja == null ||
        (Array.isArray(row.key_ingredients_ja) &&
          row.key_ingredients_ja.length === 0) ||
        (typeof row.key_ingredients_ja === "string" &&
          !row.key_ingredients_ja.trim()));

    if (bothEmpty || !anyLabel) {
      samplePush(emptyOrUnknownProductIds, row.productId, 30);
    }
  }

  const duplicatesAfterNormalization: Record<string, string[]> = {};
  let duplicateNormalizedKeyCount = 0;
  for (const [norm, labels] of byNormalized) {
    if (labels.size > 1) {
      duplicateNormalizedKeyCount += 1;
      duplicatesAfterNormalization[norm] = [...labels].slice(0, 10);
    }
  }

  const uniqueLabels = [...unique].sort((a, b) => a.localeCompare(b));

  return {
    productCount: rows.length,
    uniqueLabels: uniqueLabels.slice(0, 200),
    uniqueLabelCount: uniqueLabels.length,
    duplicatesAfterNormalization,
    duplicateNormalizedKeyCount,
    variants,
    rawFieldShapes,
    emptyOrUnknownProductIds,
    unknownValueSamples,
  };
}

/**
 * 개발 환경에서만 콘솔에 감사 요약을 출력한다.
 * production 에서는 no-op.
 */
export function logIngredientFormatAudit(
  summary: IngredientFormatAuditSummary
): void {
  if (process.env.NODE_ENV !== "development") return;

  console.log("[ingredientFormatAudit] summary", {
    productCount: summary.productCount,
    uniqueLabelCount: summary.uniqueLabelCount,
    duplicateNormalizedKeyCount: summary.duplicateNormalizedKeyCount,
    rawFieldShapes: summary.rawFieldShapes,
    emptyOrUnknownProductIds: summary.emptyOrUnknownProductIds,
    unknownValueSamples: summary.unknownValueSamples,
    variants: {
      koreanSample: summary.variants.korean.slice(0, 15),
      englishSample: summary.variants.english.slice(0, 15),
      japaneseSample: summary.variants.japanese.slice(0, 15),
      mixedOrOtherSample: summary.variants.mixedOrOther.slice(0, 15),
      koreanCount: summary.variants.korean.length,
      englishCount: summary.variants.english.length,
      japaneseCount: summary.variants.japanese.length,
      mixedOrOtherCount: summary.variants.mixedOrOther.length,
    },
    // 중복 이표기 샘플 (정규화 후 같은 키)
    duplicateSamples: Object.fromEntries(
      Object.entries(summary.duplicatesAfterNormalization).slice(0, 20)
    ),
    uniqueLabelsSample: summary.uniqueLabels.slice(0, 40),
  });
}
