/**
 * Official functional claim validation for hair-loss support cosmetics.
 * Never invents claims; unverified claims cannot show badges or affect scores.
 */

export type FunctionalClaimSourceType =
  | "official_brand"
  | "official_retailer"
  | "regulatory"
  | "seller_copy"
  | "unknown";

export type HairLossFunctionalClaim = {
  claimType: "hair_loss_symptom_relief_functional_cosmetic" | "other";
  claimTextOriginal: string;
  country: string | null;
  sourceUrl: string | null;
  sourceType: FunctionalClaimSourceType;
  verifiedAt: string | null;
  verified: boolean;
};

export type FunctionalClaimValidation = {
  ok: boolean;
  verified: boolean;
  needsReview: boolean;
  allowUserBadge: boolean;
  allowScoreImpact: boolean;
  reasons: string[];
  claim: HairLossFunctionalClaim;
};

const TRUSTED: Set<FunctionalClaimSourceType> = new Set([
  "official_brand",
  "official_retailer",
  "regulatory",
]);

export function validateHairLossFunctionalClaim(input: {
  claimTextOriginal?: string | null;
  country?: string | null;
  sourceUrl?: string | null;
  sourceType?: FunctionalClaimSourceType | null;
  verifiedAt?: string | null;
}): FunctionalClaimValidation {
  const claimText = String(input.claimTextOriginal ?? "").trim();
  const sourceType = input.sourceType ?? "unknown";
  const sourceUrl = input.sourceUrl?.trim() || null;
  const reasons: string[] = [];

  if (!claimText) {
    reasons.push("missing_claim_text");
  }

  // Marketing volume / scalp strengthening is not a functional hair-loss claim
  if (/볼륨|volume/i.test(claimText) && !/탈모\s*증상\s*완화|기능성/.test(claimText)) {
    reasons.push("volume_is_not_hair_loss_functional");
  }
  if (/두피\s*강화/.test(claimText) && !/탈모\s*증상\s*완화|기능성/.test(claimText)) {
    reasons.push("scalp_strengthening_is_not_hair_growth");
  }
  if (/치료|발모\s*보장|완치/.test(claimText)) {
    reasons.push("treatment_language_forbidden");
  }

  const looksFunctional =
    /탈모\s*증상\s*완화|기능성\s*화장품|hair\s*loss\s*symptom/i.test(claimText);

  if (!looksFunctional && reasons.includes("volume_is_not_hair_loss_functional")) {
    const claim: HairLossFunctionalClaim = {
      claimType: "other",
      claimTextOriginal: claimText,
      country: input.country ?? null,
      sourceUrl,
      sourceType,
      verifiedAt: null,
      verified: false,
    };
    return {
      ok: false,
      verified: false,
      needsReview: false,
      allowUserBadge: false,
      allowScoreImpact: false,
      reasons,
      claim,
    };
  }

  if (!sourceUrl) reasons.push("missing_source_url");
  if (sourceType === "seller_copy") reasons.push("seller_copy_only");
  if (sourceType === "unknown") reasons.push("unknown_source_type");
  if (!TRUSTED.has(sourceType)) reasons.push("source_not_trusted");

  const verified =
    looksFunctional &&
    Boolean(sourceUrl) &&
    TRUSTED.has(sourceType) &&
    !reasons.includes("treatment_language_forbidden");

  const claim: HairLossFunctionalClaim = {
    claimType: "hair_loss_symptom_relief_functional_cosmetic",
    claimTextOriginal: claimText,
    country: input.country ?? null,
    sourceUrl,
    sourceType,
    verifiedAt: verified ? input.verifiedAt ?? new Date().toISOString() : null,
    verified,
  };

  return {
    ok: verified,
    verified,
    needsReview: !verified && looksFunctional,
    allowUserBadge: verified,
    allowScoreImpact: false, // never impact face or hair scores in this sprint
    reasons,
    claim,
  };
}

/** Medicine / pharmacy actives must not auto-enter cosmetic recommend pools. */
export function isLikelyMedicinalHairActive(inciOrName: string): boolean {
  const t = inciOrName.trim().toLowerCase();
  return (
    t.includes("ketoconazole") ||
    t.includes("케토코나졸") ||
    t.includes("minoxidil") ||
    t.includes("미녹시딜") ||
    t.includes("finasteride") ||
    t.includes("피나스테리드")
  );
}

export function needsRegulatoryReviewForActive(inciOrName: string): boolean {
  const t = inciOrName.trim().toLowerCase();
  if (isLikelyMedicinalHairActive(t)) return true;
  return (
    t.includes("zinc pyrithione") ||
    t.includes("pyrithione zinc") ||
    t.includes("징크피리치온")
  );
}
