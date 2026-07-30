/**
 * Known functional / active / moisturizing / soothing / barrier ingredients.
 * Used only to mark is_key when the token already appears in the full INCI list.
 * Never invent ingredient names that are not in the declared list.
 */

const KEY_ACTIVE_DICTIONARY: Array<{
  /** Normalized match keys (lowercase, spaces). */
  keys: string[];
  /** Canonical display name when matched. */
  displayName: string;
  roles: Array<
    | "active"
    | "moisturizing"
    | "soothing"
    | "barrier"
    | "antioxidant"
    | "exfoliating"
    | "brightening"
  >;
  confidence: number;
}> = [
  { keys: ["niacinamide"], displayName: "Niacinamide", roles: ["active", "brightening"], confidence: 0.95 },
  { keys: ["glycerin", "glycerol"], displayName: "Glycerin", roles: ["moisturizing"], confidence: 0.9 },
  { keys: ["hyaluronic acid", "sodium hyaluronate", "hydrolyzed hyaluronic acid"], displayName: "Hyaluronic Acid / Sodium Hyaluronate", roles: ["moisturizing"], confidence: 0.95 },
  { keys: ["panthenol", "d panthenol", "dexpanthenol"], displayName: "Panthenol", roles: ["soothing", "moisturizing"], confidence: 0.92 },
  { keys: ["ceramide np", "ceramide ap", "ceramide eop", "ceramide ns", "ceramides"], displayName: "Ceramide", roles: ["barrier"], confidence: 0.95 },
  { keys: ["cholesterol"], displayName: "Cholesterol", roles: ["barrier"], confidence: 0.85 },
  { keys: ["centella asiatica", "centella asiatica extract", "madecassoside", "asiaticoside", "asiatic acid", "madecassic acid"], displayName: "Centella / Madecassoside", roles: ["soothing"], confidence: 0.93 },
  { keys: ["allantoin"], displayName: "Allantoin", roles: ["soothing"], confidence: 0.88 },
  { keys: ["tranexamic acid"], displayName: "Tranexamic Acid", roles: ["brightening", "active"], confidence: 0.95 },
  { keys: ["ascorbic acid", "sodium ascorbyl phosphate", "3 o ethyl ascorbic acid", "ascorbyl glucoside", "ascorbyl tetraisopalmitate"], displayName: "Vitamin C derivative", roles: ["antioxidant", "brightening"], confidence: 0.92 },
  { keys: ["tocopherol", "tocopheryl acetate"], displayName: "Tocopherol", roles: ["antioxidant"], confidence: 0.88 },
  { keys: ["retinol", "retinal", "retinaldehyde", "retinyl palmitate"], displayName: "Retinoid", roles: ["active"], confidence: 0.95 },
  { keys: ["salicylic acid", "betaine salicylate"], displayName: "Salicylic Acid / Betaine Salicylate", roles: ["exfoliating", "active"], confidence: 0.93 },
  { keys: ["glycolic acid", "lactic acid", "mandelic acid", "pha", "gluconolactone"], displayName: "AHA / PHA", roles: ["exfoliating"], confidence: 0.9 },
  { keys: ["azelaic acid", "potassium azeloyl diglycinate"], displayName: "Azelaic Acid", roles: ["active", "brightening"], confidence: 0.92 },
  { keys: ["snail secretion filtrate"], displayName: "Snail Secretion Filtrate", roles: ["moisturizing", "soothing"], confidence: 0.9 },
  { keys: ["beta glucan", "beta-glucan"], displayName: "Beta-Glucan", roles: ["soothing", "moisturizing"], confidence: 0.9 },
  { keys: ["squalane"], displayName: "Squalane", roles: ["moisturizing", "barrier"], confidence: 0.88 },
  { keys: ["zinc pca", "zinc oxide"], displayName: "Zinc compound", roles: ["soothing"], confidence: 0.85 },
  { keys: ["adenosine"], displayName: "Adenosine", roles: ["active"], confidence: 0.9 },
  { keys: ["peptide", "copper tripeptide", "palmitoyl pentapeptide", "acetyl hexapeptide"], displayName: "Peptide", roles: ["active"], confidence: 0.8 },
  { keys: ["green tea extract", "camellia sinensis leaf extract"], displayName: "Green Tea Extract", roles: ["antioxidant", "soothing"], confidence: 0.85 },
];

export type KeyIngredientHit = {
  /** Exact token from the declared full ingredient list */
  tokenFromList: string;
  normalizedName: string;
  displayName: string;
  roles: string[];
  confidence: number;
  orderInList: number;
  evidence: "dictionary_and_present_in_full_list";
};

function normalizeKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[_\-·•|/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Select key ingredients only if they appear in the parsed full list
 * and match the known functional dictionary. No invented names.
 */
export function extractKeyIngredientsFromFullList(
  fullListTokens: Array<{ token: string; normalizedName: string; order: number }>
): KeyIngredientHit[] {
  const hits: KeyIngredientHit[] = [];
  const usedOrders = new Set<number>();

  for (const entry of KEY_ACTIVE_DICTIONARY) {
    for (const item of fullListTokens) {
      if (usedOrders.has(item.order)) continue;
      const n = normalizeKey(item.normalizedName);
      const matched = entry.keys.some(
        (k) => n === k || n.includes(k) || k.includes(n)
      );
      // Prefer exact/strong contain without matching tiny substrings
      const strong =
        entry.keys.some((k) => n === k) ||
        entry.keys.some((k) => k.length >= 5 && n.includes(k));
      if (!matched || !strong) continue;

      hits.push({
        tokenFromList: item.token,
        normalizedName: item.normalizedName,
        displayName: entry.displayName,
        roles: [...entry.roles],
        confidence: entry.confidence,
        orderInList: item.order,
        evidence: "dictionary_and_present_in_full_list",
      });
      usedOrders.add(item.order);
      break;
    }
  }

  return hits.sort((a, b) => a.orderInList - b.orderInList);
}

/**
 * 전성분 문자열 배열 → `products.key_ingredients` 에 넣을 값.
 *
 * 추천·안전 필터는 `key_ingredients` 만 읽는데 수집기는 `full_ingredients` 만
 * 채우기 때문에, 그 사이를 잇는다. 반환값은 사전 표시명이 아니라 **전성분에 적힌
 * 원문 토큰**이다 — 나중에 원문과 대조할 수 있어야 하고, 제품이 선언하지 않은
 * 이름이 들어가서도 안 된다.
 */
export function deriveKeyIngredientsFromFullList(
  fullIngredients: readonly string[]
): string[] {
  const tokens = fullIngredients
    .map((raw, index) => ({ token: raw.trim(), order: index }))
    .filter((t) => t.token.length > 0)
    .map((t) => ({ ...t, normalizedName: t.token }));

  return extractKeyIngredientsFromFullList(tokens).map((hit) => hit.tokenFromList);
}
