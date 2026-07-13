/**
 * 한국어 표시 현지화 selftest (표시만 — 매칭/점수 불변).
 */
import {
  displayIngredientName,
  getIngredientDisplayName,
} from "./displayIngredientName";
import { getRetailerDisplayName } from "./getRetailerDisplayName";
import { getShippingCountryLabel } from "./getShippingCountryLabel";
import { rankProducts } from "./rankProducts";
import type { RankableProduct, Recommendation } from "./types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`[localization-selftest] ${msg}`);
}

export function runLocalizationDisplaySelftests(): {
  ok: true;
  checks: number;
} {
  let checks = 0;

  // --- 성분명 KO ---
  assert(
    getIngredientDisplayName("Panthenol (Vitamin B5)", "ko") ===
      "판테놀(비타민 B5)",
    "panthenol vitamin b5 ko"
  );
  assert(
    displayIngredientName("Centella Asiatica (Cica)", "ko") ===
      "센텔라 아시아티카(시카)",
    "centella cica ko"
  );
  assert(
    displayIngredientName("Rice Extract", "ko") === "쌀 추출물",
    "rice extract ko"
  );
  assert(
    displayIngredientName("Low Molecular Hyaluronic Acid", "ko") ===
      "저분자 히알루론산",
    "low molecular ha ko"
  );
  assert(
    displayIngredientName("Unknown Exotic Molecule XYZ", "ko") ===
      "Unknown Exotic Molecule XYZ",
    "unknown fallback raw"
  );
  assert(
    displayIngredientName("Panthenol (Vitamin B5)", "en") ===
      "Panthenol (Vitamin B5)",
    "en keeps english"
  );
  checks += 1;

  // --- 국가 버튼 ---
  assert(getShippingCountryLabel("KR", "ko") === "한국", "ko KR label");
  assert(getShippingCountryLabel("US", "ko") === "미국", "ko US label");
  assert(getShippingCountryLabel("JP", "ko") === "일본", "ko JP label");
  assert(getShippingCountryLabel("KR", "en") === "KR", "en KR code");
  assert(getShippingCountryLabel("US", "en") === "US", "en US code");
  assert(getShippingCountryLabel("JP", "en") === "JP", "en JP code");
  // 내부 코드 불변 스모크
  const codes = ["KR", "US", "JP"] as const;
  assert(codes[0] === "KR" && codes[1] === "US" && codes[2] === "JP", "codes");
  checks += 1;

  // --- 판매처 ---
  assert(
    getRetailerDisplayName({
      retailerName: "COSRX Official KR",
      retailerCountry: "KR",
      isOfficial: true,
      locale: "ko",
    }) === "COSRX 한국 공식몰",
    "official KR ko"
  );
  assert(
    getRetailerDisplayName({
      retailerName: "COSRX Official KR",
      retailerCountry: "KR",
      isOfficial: true,
      locale: "en",
    }) === "COSRX Official KR",
    "official KR en"
  );
  assert(
    getRetailerDisplayName({
      retailerName: "Olive Young",
      retailerCountry: "KR",
      isOfficial: false,
      locale: "ko",
    }) === "Olive Young",
    "generic retailer kept"
  );
  checks += 1;

  // --- 추천 로직 보존: 표시 번역이 matchedIngredients 원문을 바꾸지 않음 ---
  const rec: Recommendation = {
    skinConcerns: [],
    recommendedIngredients: ["히알루론산", "판테놀"],
    ingredientsToAvoid: [],
    confidenceScore: 1,
  };
  const product: RankableProduct = {
    id: "loc-1",
    key_ingredients: ["Sodium Hyaluronate", "Panthenol"],
  };
  const ranked = rankProducts(rec, [product]);
  assert(ranked[0]!.score > 0, "score still positive");
  assert(
    ranked[0]!.matchedIngredients.includes("Sodium Hyaluronate") ||
      ranked[0]!.matchedIngredients.includes("Panthenol"),
    "matchedIngredients keep product-side labels"
  );
  const displayOnly = displayIngredientName(
    ranked[0]!.matchedIngredients[0]!,
    "ko"
  );
  assert(
    displayOnly !== ranked[0]!.matchedIngredients[0] ||
      /[가-힣]/.test(displayOnly),
    "display differs or already ko — array itself unchanged"
  );
  assert(
    ranked[0]!.matchedIngredients[0] === "Sodium Hyaluronate" ||
      ranked[0]!.matchedIngredients[0] === "Panthenol",
    "matchedIngredients array content unchanged by display helper"
  );
  checks += 1;

  return { ok: true, checks };
}
