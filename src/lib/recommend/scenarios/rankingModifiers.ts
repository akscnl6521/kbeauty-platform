import type { ScenarioRankingModifiers } from "./types";

export type RankableCandidate = {
  id: string;
  brand: string;
  price?: number | null;
  stockKnownInStock?: boolean;
  matchedAvoidIngredients?: string[];
  score: number;
};

/**
 * User axes re-rank within an existing scenario pool only.
 * They never create a new candidate pool.
 */
export function applyScenarioRankingModifiers<T extends RankableCandidate>(
  ranked: readonly T[],
  modifiers: ScenarioRankingModifiers = {}
): T[] {
  const avoid = new Set(
    (modifiers.avoidIngredients ?? [])
      .concat(modifiers.allergies ?? [])
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
  );

  const preferInStock =
    modifiers.purchaseAvailability === "in_stock_preferred";

  const scored = ranked.map((item) => {
    let delta = 0;

    if (preferInStock && item.stockKnownInStock === false) {
      delta -= 25;
    }
    if (preferInStock && item.stockKnownInStock === true) {
      delta += 5;
    }

    const hits = (item.matchedAvoidIngredients ?? []).filter((ing) =>
      avoid.has(ing.toLowerCase())
    );
    if (hits.length > 0) {
      delta -= 40 * hits.length;
    }

    if (modifiers.budgetRange === "low" && typeof item.price === "number") {
      delta += item.price <= 30000 ? 8 : -8;
    }
    if (modifiers.budgetRange === "high" && typeof item.price === "number") {
      delta += item.price >= 50000 ? 8 : 0;
    }

    return { item, adjusted: item.score + delta };
  });

  scored.sort((a, b) => b.adjusted - a.adjusted || b.item.score - a.item.score);
  return scored.map((row) => row.item);
}

export function rankingModifiersChangePool(): false {
  return false;
}
