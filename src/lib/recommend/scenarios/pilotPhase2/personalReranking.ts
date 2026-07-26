import { toCanonicalConcern } from "@/lib/recommend/concernAliases";
import type { RankedProduct, Recommendation } from "@/lib/recommend/types";
import { applyScenarioRankingModifiers } from "../rankingModifiers";
import { assertAffiliateScoreNotUsed } from "../poolRules";
import type { RankableProduct } from "@/lib/recommend/types";

function skinTypeFitBoost(
  skinType: string | undefined | null,
  product: RankableProduct
): number {
  const st = (skinType ?? "").toLowerCase();
  const concerns = String(product.skin_concern ?? "").toLowerCase();
  let delta = 0;
  if (st.includes("dry") || st.includes("건")) {
    if (concerns.includes("dry") || concerns.includes("건조")) delta += 0.15;
  }
  if (st.includes("oily") || st.includes("지성")) {
    if (concerns.includes("acne") || concerns.includes("pore")) delta += 0.15;
  }
  if (st.includes("sensitive") || st.includes("민감")) {
    if (concerns.includes("sensit") || concerns.includes("민감")) delta += 0.15;
  }
  return delta;
}

function evidenceConfidenceBoost(
  recommendation: Recommendation,
  matchedIngredients: string[]
): number {
  const linkCount = recommendation.evidenceLinks?.length ?? 0;
  if (linkCount === 0) return 0;
  const ratio =
    matchedIngredients.length /
    Math.max(1, recommendation.recommendedIngredients.length);
  return Math.min(0.5, linkCount * 0.05 + ratio * 0.2);
}

function concernFitBoost(
  recommendation: Recommendation,
  product: RankableProduct
): number {
  const userConcerns = (recommendation.skinConcerns ?? [])
    .map((c) => toCanonicalConcern(c))
    .filter(Boolean);
  const productConcerns = String(product.skin_concern ?? "")
    .split(/[,;/|]/)
    .map((c) => toCanonicalConcern(c.trim()))
    .filter(Boolean);
  let hits = 0;
  for (const uc of userConcerns) {
    if (productConcerns.includes(uc)) hits += 1;
  }
  return hits * 0.1;
}

/**
 * Personal re-ranking within scenario pool only.
 * Allowed: concern/skin/sensitivity fit, avoid/allergies (pre-filtered),
 * routine hints, body area, country offer (pre-filter), budget, evidence confidence.
 * Forbidden: affiliate/ad/commission.
 */
export function applyPilotPersonalReranking<T extends RankableProduct>(
  recommendation: Recommendation,
  ranked: RankedProduct<T>[],
  modifiers: {
    budgetRange?: string | null;
    country?: string | null;
  } = {}
): RankedProduct<T>[] {
  assertAffiliateScoreNotUsed(undefined);

  const withPersonalScore = ranked.map((row) => {
    let score = row.score;
    score += skinTypeFitBoost(recommendation.skinType, row.product);
    score += concernFitBoost(recommendation, row.product);
    score += evidenceConfidenceBoost(recommendation, row.matchedIngredients);
    return { ...row, score };
  });

  const modifierInput = {
    avoidIngredients: recommendation.avoidedIngredients,
    allergies: recommendation.allergyIngredients,
    budgetRange: modifiers.budgetRange ?? null,
    country: modifiers.country ?? null,
    purchaseAvailability: "in_stock_preferred" as const,
  };

  type ModifierRow = RankedProduct<T> & {
    id: string;
    brand: string;
    price: number | null | undefined;
    matchedAvoidIngredients: string[];
  };

  const forModifiers: ModifierRow[] = withPersonalScore.map((row) => ({
    ...row,
    id: String(row.product.id),
    brand: row.product.brand ?? "",
    price: row.product.price_usd,
    matchedAvoidIngredients: row.excludedIngredients,
  }));

  const reranked = applyScenarioRankingModifiers(forModifiers, modifierInput);

  return reranked.map((row) => ({
    product: row.product,
    score: row.score,
    matchedIngredients: row.matchedIngredients,
    excludedIngredients: row.excludedIngredients,
  }));
}
