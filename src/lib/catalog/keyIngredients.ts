/**
 * Known functional / active / moisturizing / soothing / barrier ingredients.
 * Used only to mark is_key when the token already appears in the full INCI list.
 * Never invent ingredient names that are not in the declared list.
 */

/**
 * 기능성 성분 사전.
 *
 * **한글 표기를 함께 둔다** — 국내몰에서 등록한 제품은 전성분이 한글이라, 영문 키만
 * 있으면 주요 성분을 하나도 못 뽑는다. 그러면 안전 필터가 `incomplete_info` 로
 * 추천 자격 자체를 주지 않는다 (2026-08-05: 국내 등록 후보 15건이 이 때문에 빠졌다).
 *
 * 한글 표기는 **지어내지 않았다.** 전부 우리 성분 사전(`ingredients.name_ko`,
 * 식약처 «화장품 원료성분정보» 출처)에서 조회해 확인한 값이다.
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
  { keys: ["niacinamide", "나이아신아마이드"], displayName: "Niacinamide", roles: ["active", "brightening"], confidence: 0.95 },
  { keys: ["glycerin", "glycerol", "글리세린"], displayName: "Glycerin", roles: ["moisturizing"], confidence: 0.9 },
  { keys: ["hyaluronic acid", "sodium hyaluronate", "hydrolyzed hyaluronic acid", "히알루론산", "소듐하이알루로네이트", "하이드롤라이즈드하이알루로닉애씨드", "하이알루로닉애씨드"], displayName: "Hyaluronic Acid / Sodium Hyaluronate", roles: ["moisturizing"], confidence: 0.95 },
  { keys: ["panthenol", "d panthenol", "dexpanthenol", "판테놀", "덱스판테놀"], displayName: "Panthenol", roles: ["soothing", "moisturizing"], confidence: 0.92 },
  { keys: ["ceramide np", "ceramide ap", "ceramide eop", "ceramide ns", "ceramides", "세라마이드엔피", "세라마이드에이피", "세라마이드이오피", "세라마이드엔에스"], displayName: "Ceramide", roles: ["barrier"], confidence: 0.95 },
  { keys: ["cholesterol", "콜레스테롤"], displayName: "Cholesterol", roles: ["barrier"], confidence: 0.85 },
  { keys: ["centella asiatica", "centella asiatica extract", "madecassoside", "asiaticoside", "asiatic acid", "madecassic acid", "병풀추출물", "마데카소사이드", "아시아티코사이드", "아시아틱애씨드", "마데카식애씨드"], displayName: "Centella / Madecassoside", roles: ["soothing"], confidence: 0.93 },
  { keys: ["allantoin", "알란토인"], displayName: "Allantoin", roles: ["soothing"], confidence: 0.88 },
  { keys: ["tranexamic acid", "트라넥사믹애씨드"], displayName: "Tranexamic Acid", roles: ["brightening", "active"], confidence: 0.95 },
  { keys: ["ascorbic acid", "sodium ascorbyl phosphate", "3 o ethyl ascorbic acid", "ascorbyl glucoside", "ascorbyl tetraisopalmitate", "아스코빅애씨드", "소듐아스코빌포스페이트", "아스코빌글루코사이드", "아스코빌테트라이소팔미테이트"], displayName: "Vitamin C derivative", roles: ["antioxidant", "brightening"], confidence: 0.92 },
  { keys: ["tocopherol", "tocopheryl acetate", "토코페롤", "토코페릴아세테이트"], displayName: "Tocopherol", roles: ["antioxidant"], confidence: 0.88 },
  { keys: ["retinol", "retinal", "retinaldehyde", "retinyl palmitate", "레티놀", "레틴알"], displayName: "Retinoid", roles: ["active"], confidence: 0.95 },
  { keys: ["salicylic acid", "betaine salicylate", "살리실산", "베타인살리실레이트"], displayName: "Salicylic Acid / Betaine Salicylate", roles: ["exfoliating", "active"], confidence: 0.93 },
  { keys: ["glycolic acid", "lactic acid", "mandelic acid", "pha", "gluconolactone", "글라이콜릭애씨드", "락틱애씨드", "만델릭애씨드", "글루코노락톤"], displayName: "AHA / PHA", roles: ["exfoliating"], confidence: 0.9 },
  { keys: ["azelaic acid", "potassium azeloyl diglycinate", "아젤라익애씨드"], displayName: "Azelaic Acid", roles: ["active", "brightening"], confidence: 0.92 },
  { keys: ["snail secretion filtrate", "달팽이 분비물 여과물", "달팽이분비물여과물"], displayName: "Snail Secretion Filtrate", roles: ["moisturizing", "soothing"], confidence: 0.9 },
  { keys: ["beta glucan", "beta-glucan", "베타글루칸"], displayName: "Beta-Glucan", roles: ["soothing", "moisturizing"], confidence: 0.9 },
  { keys: ["squalane", "스쿠알란"], displayName: "Squalane", roles: ["moisturizing", "barrier"], confidence: 0.88 },
  { keys: ["zinc pca", "zinc oxide", "징크피씨에이", "징크옥사이드"], displayName: "Zinc compound", roles: ["soothing"], confidence: 0.85 },
  { keys: ["adenosine", "아데노신"], displayName: "Adenosine", roles: ["active"], confidence: 0.9 },
  { keys: ["peptide", "copper tripeptide", "palmitoyl pentapeptide", "acetyl hexapeptide", "펩타이드"], displayName: "Peptide", roles: ["active"], confidence: 0.8 },
  { keys: ["green tea extract", "camellia sinensis leaf extract", "녹차추출물", "녹차 추출물", "녹차수"], displayName: "Green Tea Extract", roles: ["antioxidant", "soothing"], confidence: 0.85 },
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
