import type { Recommendation } from "@/lib/recommend/types";

export function isScenarioPilotPreviewDebugEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (env.NODE_ENV !== "production") return true;
  return env.VERCEL_ENV === "preview";
}

export type ScenarioPilotPreviewSample = {
  id: "A" | "B" | "C" | "D" | "E";
  label: string;
  expectation: "recommendations_ready" | "insufficient_verified_candidates";
  recommendation: Recommendation;
};

export function buildScenarioPilotPreviewSamples(): ScenarioPilotPreviewSample[] {
  return [
    {
      id: "A",
      label: "민감·홍조·크림",
      expectation: "recommendations_ready",
      recommendation: {
        skinConcerns: ["Redness", "Sensitivity"],
        recommendedIngredients: [
          "Snail Secretion Filtrate",
          "Panthenol",
          "Hyaluronic Acid",
          "Centella Asiatica",
          "Niacinamide",
        ],
        ingredientsToAvoid: ["Fragrance", "Alcohol Denat"],
        confidenceScore: 0.84,
        managementLevel: "cosmetic_care",
        skinType: "sensitive dry",
        suggestedMorningOrder: ["진정 크림", "자외선 차단"],
        suggestedEveningOrder: ["진정 크림"],
      },
    },
    {
      id: "B",
      label: "건성·장벽·세럼",
      expectation: "recommendations_ready",
      recommendation: {
        skinConcerns: ["Dryness", "Barrier"],
        recommendedIngredients: [
          "Snail Secretion Filtrate",
          "Hyaluronic Acid",
          "Panthenol",
          "Ceramide NP",
          "Centella Asiatica",
          "Niacinamide",
        ],
        ingredientsToAvoid: ["Menthol"],
        confidenceScore: 0.8,
        managementLevel: "cosmetic_care",
        skinType: "dry",
        suggestedMorningOrder: ["세럼", "보습 크림"],
        suggestedEveningOrder: ["세럼", "보습 크림"],
      },
    },
    {
      id: "C",
      label: "여드름·피지·토너",
      expectation: "recommendations_ready",
      recommendation: {
        skinConcerns: ["Pores", "Acne"],
        recommendedIngredients: [
          "Heartleaf",
          "Salicylic Acid",
          "Glycolic Acid",
          "Niacinamide",
          "Hyaluronic Acid",
        ],
        ingredientsToAvoid: ["Fragrance"],
        confidenceScore: 0.79,
        managementLevel: "cosmetic_care",
        skinType: "oily sensitive",
        suggestedMorningOrder: ["토너", "가벼운 보습"],
        suggestedEveningOrder: ["토너", "가벼운 보습"],
      },
    },
    {
      id: "D",
      label: "민감·자외선·선크림",
      expectation: "insufficient_verified_candidates",
      recommendation: {
        skinConcerns: ["UV", "Sensitivity"],
        recommendedIngredients: ["Zinc Oxide"],
        ingredientsToAvoid: ["Fragrance", "Alcohol Denat"],
        confidenceScore: 0.75,
        managementLevel: "cosmetic_care",
        skinType: "sensitive",
        suggestedMorningOrder: ["선크림"],
      },
    },
    {
      id: "E",
      label: "탄력·건조·아이크림",
      expectation: "insufficient_verified_candidates",
      recommendation: {
        skinConcerns: ["Antiaging", "Dryness"],
        recommendedIngredients: ["Peptide", "Ceramide NP"],
        ingredientsToAvoid: ["Fragrance"],
        confidenceScore: 0.73,
        managementLevel: "cosmetic_care",
        skinType: "dry mature",
        suggestedMorningOrder: ["아이크림"],
        suggestedEveningOrder: ["아이크림"],
      },
    },
  ];
}
