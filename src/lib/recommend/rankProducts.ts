import {
  coerceIngredientList,
  coerceIngredientListUnknown,
  findMatchByCanonical,
  indexIngredients,
  toCanonical,
  type CanonicalIngredientRef,
} from "./normalizeIngredient";
import type { RankableProduct, RankedProduct, Recommendation } from "./types";

const MATCH_WEIGHT = 1;
const AVOID_PENALTY = 1.25;
const AVOID_RATIO_PENALTY = 0.35;

const DEV_LOG_LIMIT = 5;
let devLogCount = 0;

function collectProductIngredients(product: RankableProduct): string[] {
  const primary = coerceIngredientListUnknown(product.key_ingredients);
  const ja = coerceIngredientListUnknown(product.key_ingredients_ja);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...primary, ...ja]) {
    const key = name.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** 추천 쪽 캐논컬을 한 번만 계산 */
function indexRecommendation(recommendation: Recommendation): {
  recommended: { label: string; canonical: string }[];
  avoid: { label: string; canonical: string }[];
  concerns: { label: string; canonical: string }[];
} {
  return {
    recommended: recommendation.recommendedIngredients
      .map((label) => ({ label, canonical: toCanonical(label) }))
      .filter((x) => x.canonical),
    avoid: recommendation.ingredientsToAvoid
      .map((label) => ({ label, canonical: toCanonical(label) }))
      .filter((x) => x.canonical),
    concerns: recommendation.skinConcerns
      .map((label) => ({ label, canonical: toCanonical(label) }))
      .filter((x) => x.canonical),
  };
}

function scoreOneProduct<T extends RankableProduct>(
  recommendation: Recommendation,
  product: T,
  recIndex: ReturnType<typeof indexRecommendation>
): RankedProduct<T> {
  const productIngredients = collectProductIngredients(product);
  // 제품 성분은 제품당 1회만 캐논컬 인덱싱
  const productIndex: CanonicalIngredientRef[] =
    indexIngredients(productIngredients);

  const matchedIngredients: string[] = [];
  const matchedCanonical = new Set<string>();
  for (const rec of recIndex.recommended) {
    const hit = findMatchByCanonical(rec.canonical, productIndex);
    if (hit && !matchedCanonical.has(rec.canonical)) {
      matchedCanonical.add(rec.canonical);
      matchedIngredients.push(hit);
    }
  }

  const excludedIngredients: string[] = [];
  const excludedCanonical = new Set<string>();
  for (const avoid of recIndex.avoid) {
    const hit = findMatchByCanonical(avoid.canonical, productIndex);
    if (hit && !excludedCanonical.has(avoid.canonical)) {
      excludedCanonical.add(avoid.canonical);
      excludedIngredients.push(hit);
    }
  }

  const recommendedCount = recommendation.recommendedIngredients.length;
  const matchCount = matchedIngredients.length;
  const avoidCount = excludedIngredients.length;

  const matchRatio =
    recommendedCount > 0 ? matchCount / recommendedCount : 0;

  let score = matchCount * MATCH_WEIGHT + matchRatio;

  if (recIndex.concerns.length > 0 && product.skin_concern) {
    const concernHaystack = coerceIngredientList(product.skin_concern);
    if (concernHaystack.length === 0 && product.skin_concern) {
      concernHaystack.push(product.skin_concern);
    }
    const concernIndex = indexIngredients(concernHaystack);
    let concernHits = 0;
    for (const c of recIndex.concerns) {
      if (findMatchByCanonical(c.canonical, concernIndex)) concernHits += 1;
    }
    if (concernHits > 0) {
      score += 0.15 * (concernHits / recommendation.skinConcerns.length);
    }
  }

  // ingredientsToAvoid 감점 유지
  if (avoidCount > 0) {
    score -= avoidCount * AVOID_PENALTY;
    score -= avoidCount * AVOID_RATIO_PENALTY;
  }

  const confidenceFactor = 0.85 + 0.15 * recommendation.confidenceScore;
  score *= confidenceFactor;
  score = Math.round(score * 1000) / 1000;

  if (
    process.env.NODE_ENV === "development" &&
    typeof console !== "undefined" &&
    devLogCount < DEV_LOG_LIMIT
  ) {
    devLogCount += 1;
    console.log("[rankProducts:match]", {
      productId: product.id,
      productName: product.name ?? null,
      matchedIngredients,
      score,
      excludedIngredients,
      productCanonicals: productIndex.map((p) => p.canonical),
    });
  }

  return {
    product,
    score,
    matchedIngredients,
    excludedIngredients,
  };
}

/**
 * 제품 랭킹 — 캐논컬 성분 매칭 (Sprint 3 Phase 2C).
 * 시그니처 유지: rankProducts(recommendation, products)
 */
export function rankProducts<T extends RankableProduct>(
  recommendation: Recommendation,
  products: T[]
): RankedProduct<T>[] {
  if (!Array.isArray(products) || products.length === 0) {
    return [];
  }

  devLogCount = 0;
  const recIndex = indexRecommendation(recommendation);

  if (process.env.NODE_ENV === "development") {
    console.log("[rankProducts] start", {
      recommendedIngredients: recommendation.recommendedIngredients,
      recommendedCanonicals: recIndex.recommended.map((r) => r.canonical),
      ingredientsToAvoid: recommendation.ingredientsToAvoid,
      productCount: products.length,
    });
  }

  const ranked = products.map((product) =>
    scoreOneProduct(recommendation, product, recIndex)
  );

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.matchedIngredients.length !== a.matchedIngredients.length) {
      return b.matchedIngredients.length - a.matchedIngredients.length;
    }
    return String(a.product.id).localeCompare(String(b.product.id));
  });

  return ranked;
}
