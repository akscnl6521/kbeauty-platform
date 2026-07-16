/**
 * Category / routine-step classification from product signals (no inventing).
 */

import type { ExtractedCatalogProduct } from "@/lib/pipeline/types";

export type CategoryClassification = {
  category: string | null;
  subcategory: string | null;
  routineStep: string | null;
  usageArea: string;
  confidence: number;
  reasons: string[];
  needsReview: boolean;
};

const RULES: Array<{
  category: string;
  subcategory?: string;
  routineStep: string;
  re: RegExp;
  weight: number;
}> = [
  { category: "cleanser", routineStep: "cleanser", re: /cleanser|cleansing|foam|wash|세안|클렌저/i, weight: 0.85 },
  { category: "toner", routineStep: "toner", re: /\btoner\b|토너|토닝/i, weight: 0.85 },
  { category: "essence", routineStep: "essence", re: /\bessence\b|에센스/i, weight: 0.8 },
  { category: "serum", routineStep: "serum", re: /\bserum\b|세럼/i, weight: 0.85 },
  { category: "ampoule", routineStep: "ampoule", re: /ampoule|ampule|앰플/i, weight: 0.85 },
  { category: "moisturizer", routineStep: "moisturizer", re: /moisturizer|moisturiser|cream|lotion|크림|로션|보습/i, weight: 0.75 },
  { category: "sunscreen", routineStep: "sunscreen", re: /sunscreen|sun\s*cream|spf|자외선|선크림/i, weight: 0.9 },
  { category: "mask", routineStep: "mask", re: /\bmask\b|sheet\s*mask|팩|마스크/i, weight: 0.8 },
  { category: "exfoliant", routineStep: "exfoliant", re: /exfoliat|peel|\baha\b|\bbha\b|\bpha\b|각질/i, weight: 0.85 },
  { category: "eye care", routineStep: "eye care", re: /eye\s*(cream|serum|gel)|아이크림/i, weight: 0.85 },
  { category: "lip care", routineStep: "lip care", re: /lip\s*(balm|mask|sleeping)|립밤|립마스크/i, weight: 0.85 },
  { category: "spot treatment", routineStep: "spot treatment", re: /spot|blemish|acne\s*patch|국소/i, weight: 0.7 },
  { category: "makeup/base", subcategory: "base", routineStep: "makeup", re: /foundation|cushion|bb\s*cream|cc\s*cream|프라이머|파운데이션/i, weight: 0.85 },
  { category: "makeup/color", subcategory: "color", routineStep: "makeup", re: /lipstick|lip\s*tint|blush|eyeshadow|mascara|concealer|틴트|블러셔/i, weight: 0.85 },
  { category: "body", routineStep: "body", re: /\bbody\b|바디/i, weight: 0.7 },
  { category: "scalp", routineStep: "scalp", re: /scalp|shampoo|두피|샴푸/i, weight: 0.75 },
];

export function classifyProductCategory(
  product: ExtractedCatalogProduct
): CategoryClassification {
  const text = [
    product.productName,
    product.category,
    product.description,
  ]
    .filter(Boolean)
    .join(" ");

  const hits: Array<{ rule: (typeof RULES)[0]; score: number }> = [];
  for (const rule of RULES) {
    if (rule.re.test(text)) hits.push({ rule, score: rule.weight });
  }

  if (!hits.length) {
    return {
      category: product.category,
      subcategory: null,
      routineStep: null,
      usageArea: "face",
      confidence: product.category ? 0.4 : 0.2,
      reasons: product.category
        ? ["출처 category 필드만 있음"]
        : ["카테고리 신호 부족"],
      needsReview: true,
    };
  }

  hits.sort((a, b) => b.score - a.score);
  const top = hits[0]!;
  const ambiguous =
    hits.length > 1 && Math.abs(hits[0]!.score - hits[1]!.score) < 0.08;

  let usageArea = "face";
  if (/eye/i.test(text)) usageArea = "eye";
  else if (/lip/i.test(text)) usageArea = "lip";
  else if (/body/i.test(text)) usageArea = "body";
  else if (/scalp|hair/i.test(text)) usageArea = "scalp";

  return {
    category: top.rule.category,
    subcategory: top.rule.subcategory ?? null,
    routineStep: top.rule.routineStep,
    usageArea,
    confidence: ambiguous ? top.score * 0.7 : top.score,
    reasons: hits.slice(0, 3).map((h) => `matched:${h.rule.category}`),
    needsReview: ambiguous || top.score < 0.7,
  };
}
