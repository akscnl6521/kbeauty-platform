/**
 * Representative safe recommendation flows for mascara / lip / shampoo-scalp.
 * Attribute ranking + safety gates. Fixtures never claim purchase-verified SKUs.
 */

import {
  rankLipProducts,
  rankMascaraProducts,
  type LipRankInput,
  type MakeupRankable,
  type MascaraRankInput,
} from "@/lib/catalog/makeup/rankMakeup";
import {
  rankScalpProducts,
  type ScalpRankableProduct,
  type ScalpRankInput,
} from "@/lib/catalog/scalpHair/rankScalpHair";
import type { HairLossObservation } from "@/lib/catalog/scalpHair/types";
import { assessHairLossObservationSafety } from "@/lib/catalog/scalpHair/types";
import type { RecommendationEligibility } from "@/lib/catalog/commonProduct";
import type { ProductAutomationCandidate } from "./types";

export type SafeRecommendItem = {
  id: string;
  name: string;
  category: string;
  score: number;
  matchedTags: string[];
  eligibility: RecommendationEligibility;
  isFixtureAttributeExample: boolean;
  purchaseClaimAllowed: false;
};

export type SafeRecommendResult = {
  domain: "mascara" | "lip" | "shampoo_scalp";
  productRecommendationAllowed: boolean;
  blockReason: string | null;
  items: SafeRecommendItem[];
  disclaimer: string;
};

const DISCLAIMER =
  "속성 매칭·픽스처 후보입니다. 공식 출처 검수와 verified offer 전에는 구매 가능 제품으로 표시하지 않습니다.";

function toMakeupRankable(
  c: ProductAutomationCandidate
): MakeupRankable & { name: string; eligibility: RecommendationEligibility } {
  return {
    id: c.candidateId,
    category: c.category,
    name: c.product.productNameKo || c.product.productNameRaw,
    eligibility: c.eligibility,
    waterproof: c.categoryAttributes.waterproof ?? null,
    mascaraEffects: c.categoryAttributes.mascaraEffects,
    lipEffects: c.categoryAttributes.lipEffects,
    undertoneFit: c.categoryAttributes.undertoneFit,
    finish: c.categoryAttributes.finish ?? null,
    shadeFamily: c.categoryAttributes.shadeFamily ?? null,
  };
}

function toScalpRankable(
  c: ProductAutomationCandidate
): ScalpRankableProduct & { name: string; eligibility: RecommendationEligibility } {
  return {
    id: c.candidateId,
    category: c.category,
    name: c.product.productNameKo || c.product.productNameRaw,
    eligibility: c.eligibility,
    scalpTypes: (c.categoryAttributes.scalpTypes ?? []) as ScalpRankableProduct["scalpTypes"],
    scalpConcerns: (c.categoryAttributes.scalpConcerns ??
      []) as ScalpRankableProduct["scalpConcerns"],
    functionalClaimVerified: c.categoryAttributes.functionalClaimVerified === true,
  };
}

function mapRanked<T extends { id: string; category?: string | null; name?: string; eligibility?: RecommendationEligibility }>(
  ranked: Array<{ product: T; score: number; matchedTags: string[] }>,
  isFixture: boolean
): SafeRecommendItem[] {
  return ranked.map((r) => ({
    id: r.product.id,
    name: r.product.name ?? r.product.id,
    category: String(r.product.category ?? "unknown"),
    score: r.score,
    matchedTags: r.matchedTags,
    eligibility: r.product.eligibility ?? "verification_required",
    isFixtureAttributeExample: isFixture,
    purchaseClaimAllowed: false as const,
  }));
}

/**
 * Pool may include automation candidates or attribute demos.
 * recommendation_ready is required only when claiming commerce;
 * attribute examples may still rank with verification_required.
 */
export function safeRecommendMascara(input: {
  quiz: MascaraRankInput;
  candidates: ProductAutomationCandidate[];
  /** Acute eye injury / infection signals — stop product ranking. */
  acuteEyeSignal?: boolean;
}): SafeRecommendResult {
  if (input.acuteEyeSignal) {
    return {
      domain: "mascara",
      productRecommendationAllowed: false,
      blockReason: "acute_eye_signal_professional_first",
      items: [],
      disclaimer: DISCLAIMER,
    };
  }
  const pool = input.candidates
    .filter((c) => c.extractorId === "mascara" || c.category === "mascara")
    .map(toMakeupRankable);
  const ranked = rankMascaraProducts(input.quiz, pool);
  return {
    domain: "mascara",
    productRecommendationAllowed: true,
    blockReason: null,
    items: mapRanked(ranked, input.candidates.every((c) => c.isFixture)),
    disclaimer: DISCLAIMER,
  };
}

export function safeRecommendLip(input: {
  quiz: LipRankInput;
  candidates: ProductAutomationCandidate[];
}): SafeRecommendResult {
  const pool = input.candidates
    .filter((c) => c.extractorId === "lip" || c.category.includes("lip"))
    .map(toMakeupRankable);
  const ranked = rankLipProducts(input.quiz, pool);
  return {
    domain: "lip",
    productRecommendationAllowed: true,
    blockReason: null,
    items: mapRanked(ranked, input.candidates.every((c) => c.isFixture)),
    disclaimer: DISCLAIMER,
  };
}

export function safeRecommendShampooScalp(input: {
  quiz: ScalpRankInput;
  candidates: ProductAutomationCandidate[];
  hairLossObservation?: HairLossObservation | null;
}): SafeRecommendResult {
  const observation = input.hairLossObservation ?? input.quiz.hairLossObservation ?? null;
  const safety = assessHairLossObservationSafety(observation);
  if (
    safety.level === "urgent_check" ||
    safety.level === "professional_consultation"
  ) {
    return {
      domain: "shampoo_scalp",
      productRecommendationAllowed: false,
      blockReason: `safety_${safety.level}`,
      items: [],
      disclaimer: DISCLAIMER,
    };
  }

  const pool = input.candidates
    .filter((c) => c.extractorId === "hair_scalp")
    .map(toScalpRankable);
  const ranked = rankScalpProducts(
    { ...input.quiz, hairLossObservation: observation },
    pool
  );
  return {
    domain: "shampoo_scalp",
    productRecommendationAllowed: true,
    blockReason: null,
    items: mapRanked(ranked, input.candidates.every((c) => c.isFixture)),
    disclaimer: DISCLAIMER,
  };
}

/** Admin/Staging linkage: only non-blocked candidates enter review lists. */
export function candidatesEligibleForAdminReview(
  candidates: ProductAutomationCandidate[]
): ProductAutomationCandidate[] {
  return candidates.filter(
    (c) => c.reviewStatus !== "blocked" && c.autoPromote === false
  );
}
