import type {
  ExtractedCatalogProduct,
  QualityScore,
  RecommendationScore,
  RecommendationScoreInput,
  SkinClassification,
  ToneMatchResult,
} from "@/lib/pipeline/types";

const COLOR_HINTS =
  /\b(lipstick|lip\s*tint|foundation|concealer|cushion|blush|bronzer|eyeshadow|mascara|eyeliner|tint|bb\s*cream|cc\s*cream|shade)\b/i;

const SKINCARE_STEPS: Array<{ step: string; re: RegExp }> = [
  { step: "cleanser", re: /cleanser|cleansing|wash/i },
  { step: "toner", re: /toner|toning/i },
  { step: "essence", re: /essence/i },
  { step: "serum", re: /serum/i },
  { step: "ampoule", re: /ampoule|ampule/i },
  { step: "moisturizer", re: /moisturizer|moisturiser|cream|lotion/i },
  { step: "sunscreen", re: /sunscreen|sun\s*cream|spf/i },
  { step: "mask", re: /mask|pack/i },
  { step: "exfoliant", re: /exfoliat|peel|aha|bha|pha/i },
  { step: "eye care", re: /eye\s*(cream|serum|gel)/i },
  { step: "lip care", re: /lip\s*(balm|mask|sleeping)/i },
];

/**
 * Classify skincare/color product for skin type & concerns.
 * Marketing-only signals get low confidence.
 */
export function classifySkinMatch(
  product: ExtractedCatalogProduct
): SkinClassification {
  const text = `${product.productName} ${product.category ?? ""} ${product.description ?? ""}`;
  const skinTypes: string[] = [];
  const concerns: string[] = [];
  const usageAreas: string[] = ["face"];
  const routineSteps: string[] = [];
  const reasons: string[] = [];

  if (/sensitive|sooth|calm|cica|panthenol/i.test(text)) {
    skinTypes.push("sensitive");
    concerns.push("redness");
    reasons.push("민감/진정 키워드");
  }
  if (/oil\s*control|sebum|mattify|pore/i.test(text)) {
    skinTypes.push("oily");
    concerns.push("sebum", "pores");
    reasons.push("유분/모공 키워드");
  }
  if (/hydrat|moistur|dry|ceramide|barrier/i.test(text)) {
    skinTypes.push("dry");
    concerns.push("dehydration", "barrier");
    reasons.push("보습/장벽 키워드");
  }
  if (/acne|blemish|salicylic|tea\s*tree/i.test(text)) {
    concerns.push("acne-prone");
    reasons.push("트러블 키워드");
  }
  if (/brighten|pigment|dark\s*spot|niacinamide|vitamin\s*c/i.test(text)) {
    concerns.push("pigmentation", "dullness");
    reasons.push("톤/색소 키워드");
  }
  if (/wrinkle|retinol|peptide|aging|firm/i.test(text)) {
    concerns.push("fine-lines");
    reasons.push("안티에이징 키워드");
  }
  if (/eye/i.test(text)) usageAreas.push("eye");
  if (/lip/i.test(text)) usageAreas.push("lip");
  if (/body/i.test(text)) usageAreas.push("body");

  for (const { step, re } of SKINCARE_STEPS) {
    if (re.test(text)) routineSteps.push(step);
  }

  const marketingOnly =
    reasons.length > 0 &&
    !product.fullIngredientsText &&
    product.confidence < 0.7;

  const confidence = marketingOnly
    ? Math.min(0.45, product.confidence)
    : Math.min(0.75, 0.35 + reasons.length * 0.08);

  return {
    skinTypes: [...new Set(skinTypes)],
    concerns: [...new Set(concerns)],
    usageAreas: [...new Set(usageAreas)],
    routineSteps: [...new Set(routineSteps)],
    confidence,
    reasons,
    marketingOnly,
  };
}

/**
 * Tone/undertone relevance. Skincare defaults to not_applicable.
 */
export function scoreToneUndertone(
  product: ExtractedCatalogProduct
): ToneMatchResult {
  const text = `${product.productName} ${product.description ?? ""}`;
  if (COLOR_HINTS.test(text)) {
    const undertones: string[] = [];
    const depths: string[] = [];
    const reasons: string[] = [];
    const cautionReasons: string[] = [];

    if (/cool|rosy|pink/i.test(text)) {
      undertones.push("cool");
      reasons.push("cool/pink 표현");
    }
    if (/warm|golden|peach/i.test(text)) {
      undertones.push("warm");
      reasons.push("warm/golden 표현");
    }
    if (/neutral/i.test(text)) {
      undertones.push("neutral");
      reasons.push("neutral 표현");
    }
    if (/olive/i.test(text)) {
      undertones.push("olive");
      reasons.push("olive 표현");
    }
    if (/fair|light/i.test(text)) depths.push("light");
    if (/medium/i.test(text)) depths.push("medium");
    if (/deep|dark/i.test(text)) depths.push("deep");
    if (/white\s*cast/i.test(text)) {
      cautionReasons.push("white cast 언급");
    }

    const confidence = undertones.length || depths.length ? 0.55 : 0.25;
    return {
      productKind: "color",
      toneRelevance: confidence >= 0.5 ? "medium" : "low",
      depths: depths.length ? depths : ["unknown"],
      undertones: undertones.length ? undertones : ["unknown"],
      matchScore: confidence >= 0.5 ? 0.5 : null,
      confidence,
      reasons,
      cautionReasons,
    };
  }

  return {
    productKind: "skincare",
    toneRelevance: "not_applicable",
    depths: [],
    undertones: [],
    matchScore: null,
    confidence: 0.9,
    reasons: ["스킨케어 — 피부톤 강제 분류 안 함"],
    cautionReasons: [],
  };
}

export function computeQualityScore(input: {
  product: ExtractedCatalogProduct;
  hasIngredients: boolean;
  hasOfficialSource: boolean;
  dedupeOk: boolean;
  offerCount: number;
}): QualityScore {
  const dimensions = {
    identity: input.product.confidence,
    source: input.hasOfficialSource ? 0.85 : 0.4,
    ingredients: input.hasIngredients ? 0.8 : 0.2,
    offer: input.offerCount > 0 ? 0.7 : 0.1,
    evidence: 0.2,
    safety: input.hasIngredients ? 0.5 : 0.2,
    tone: 0.3,
    freshness: 0.7,
    dedupe: input.dedupeOk ? 0.85 : 0.4,
  };

  const score =
    Object.values(dimensions).reduce((a, b) => a + b, 0) /
    Object.keys(dimensions).length;

  const blockers: string[] = [];
  if (!input.hasOfficialSource) blockers.push("공식 소스 미확정");
  if (!input.hasIngredients) blockers.push("전성분 미확보");
  if (input.offerCount === 0) blockers.push("verified offer 없음 — publish 금지");
  if (!input.dedupeOk) blockers.push("중복 판정 미확정");

  let grade: QualityScore["grade"] = "D";
  if (score >= 0.8 && blockers.length === 0) grade = "A";
  else if (score >= 0.65) grade = "B";
  else if (score >= 0.5) grade = "C";
  else if (blockers.length) grade = "Review Required";

  return {
    grade,
    score,
    publishEligible: false, // policy: never auto-publish in this phase
    blockers: [...blockers, "자동 published 정책상 비활성"],
    dimensions,
  };
}

export function scorePersonalizedRecommendation(
  product: ExtractedCatalogProduct,
  skin: SkinClassification,
  tone: ToneMatchResult,
  user: RecommendationScoreInput
): RecommendationScore {
  const parts: Record<string, number> = {
    concern: 0,
    skinType: 0,
    tone: 0,
    confidence: product.confidence,
  };
  const recommendReasons: string[] = [];
  const cautionReasons: string[] = [];
  const missingData: string[] = [];
  const filterReasons: string[] = [];

  const allergies = (user.allergies ?? []).map((a) => a.toLowerCase());
  const avoid = (user.avoidIngredients ?? []).map((a) => a.toLowerCase());
  const hay = `${product.fullIngredientsText ?? ""} ${product.description ?? ""}`.toLowerCase();

  for (const a of allergies) {
    if (a && hay.includes(a)) filterReasons.push(`알레르기 충돌: ${a}`);
  }
  for (const a of avoid) {
    if (a && hay.includes(a)) filterReasons.push(`회피 성분: ${a}`);
  }

  if (user.skinType && skin.skinTypes.includes(user.skinType)) {
    parts.skinType = 0.8;
    recommendReasons.push(`피부타입 ${user.skinType} 매칭`);
  }
  for (const c of user.concerns ?? []) {
    if (skin.concerns.includes(c)) {
      parts.concern += 0.25;
      recommendReasons.push(`고민 ${c} 매칭`);
    }
  }
  parts.concern = Math.min(1, parts.concern);

  if (tone.toneRelevance === "not_applicable") {
    parts.tone = 0.5;
  } else if (
    user.undertone &&
    tone.undertones.includes(user.undertone)
  ) {
    parts.tone = 0.7;
    recommendReasons.push(`언더톤 ${user.undertone}`);
  } else {
    missingData.push("언더톤/쉐이드 정보 부족");
    parts.tone = 0.3;
  }

  if (!product.fullIngredientsText) missingData.push("전성분");
  if (skin.marketingOnly) cautionReasons.push("마케팅 문구 의존 분류");

  const hardFiltered = filterReasons.length > 0;
  const total = hardFiltered
    ? 0
    : (parts.concern + parts.skinType + parts.tone + parts.confidence) / 4;

  return {
    total,
    hardFiltered,
    filterReasons,
    parts,
    recommendReasons,
    cautionReasons,
    confidence: Math.min(product.confidence, skin.confidence),
    missingData,
  };
}
