/**
 * Link known ingredient tokens to existing evidence/caution catalogs.
 * Does not invent medical claims. Conflict → needs_review.
 */

export type EvidenceLinkHint = {
  token: string;
  cautionTags: string[];
  evidenceHints: string[];
  confidence: number;
  needsReview: boolean;
  reasons: string[];
};

const CAUTION_MAP: Array<{ re: RegExp; tags: string[] }> = [
  { re: /parfum|fragrance|향료/i, tags: ["fragrance"] },
  { re: /alcohol\s*denat|ethanol|alcohol/i, tags: ["alcohol"] },
  { re: /essential\s*oil|라벤더|티트리/i, tags: ["essential_oil"] },
  { re: /retinol|retinal|retinoid/i, tags: ["retinoid", "pregnancy_caution", "photosensitivity"] },
  { re: /ascorbic\s*acid|vitamin\s*c|아스코르/i, tags: ["vitamin_c"] },
  { re: /salicylic|glycolic|lactic\s*acid|aha|bha|pha/i, tags: ["exfoliating_acid"] },
];

/**
 * Produce caution/evidence hints from normalized ingredient tokens.
 * Actual DB joins happen in commit workflows using existing ingredient_* tables.
 */
export function linkIngredientSafetyHints(tokens: string[]): EvidenceLinkHint[] {
  return tokens.map((token) => {
    const cautionTags: string[] = [];
    const evidenceHints: string[] = [];
    const reasons: string[] = [];

    for (const { re, tags } of CAUTION_MAP) {
      if (re.test(token)) {
        cautionTags.push(...tags);
        reasons.push(`주의 패턴 매칭: ${tags.join(",")}`);
      }
    }

    if (/niacinamide|ceramide|panthenol|hyaluronic/i.test(token)) {
      evidenceHints.push("common_skincare_active");
      reasons.push("일반 스킨케어 활성 성분 힌트");
    }

    const needsReview = cautionTags.includes("retinoid") && cautionTags.includes("exfoliating_acid");
    if (needsReview) reasons.push("활성 성분 조합 충돌 가능 → needs_review");

    return {
      token,
      cautionTags: [...new Set(cautionTags)],
      evidenceHints,
      confidence: cautionTags.length || evidenceHints.length ? 0.55 : 0.2,
      needsReview,
      reasons,
    };
  });
}
