import { toCanonicalConcern } from "@/lib/recommend/concernAliases";
import type { Recommendation } from "@/lib/recommend/types";
import type { ScenarioMatchInput, ScenarioSensitivityLevel } from "../types";

function normalizeSkinType(value?: string | null): string | null {
  if (!value) return null;
  const t = value.trim().toLowerCase();
  return t || null;
}

function recommendationSensitivity(
  recommendation: Recommendation
): ScenarioSensitivityLevel {
  const skinType = normalizeSkinType(recommendation.skinType);
  const concerns = (recommendation.skinConcerns ?? []).map((c) =>
    toCanonicalConcern(c)
  );
  if (concerns.includes("sensitivity") || concerns.includes("redness")) {
    return "high";
  }
  if (skinType?.includes("sensitive") || skinType?.includes("민감")) {
    return "high";
  }
  if (skinType?.includes("dry") || skinType?.includes("건")) {
    return "moderate";
  }
  return "moderate";
}

/**
 * Infer pilot product category from concerns — not a Cartesian product.
 * One primary category per analysis for scenario matching.
 */
export function inferPilotProductCategory(
  concerns: string[]
): string | null {
  const canonical = concerns
    .map((c) => toCanonicalConcern(c))
    .filter(Boolean) as string[];

  if (canonical.some((c) => c === "uv")) return "sunscreen";
  if (
    canonical.some((c) => c === "antiaging") &&
    canonical.some((c) => c === "dryness")
  ) {
    return "eye_cream";
  }
  if (canonical.includes("antiaging")) return "eye_cream";
  if (canonical.includes("acne") || canonical.includes("pores")) {
    return "toner";
  }
  if (canonical.includes("redness") || canonical.includes("sensitivity")) {
    return "cream";
  }
  if (canonical.includes("dryness") || canonical.includes("barrier")) {
    return "serum";
  }
  if (canonical.includes("pigmentation")) return "serum";
  return null;
}

export function recommendationToScenarioMatchInput(
  recommendation: Recommendation
): ScenarioMatchInput {
  const concerns = recommendation.skinConcerns ?? [];
  const primary =
    concerns.length > 0 ? concerns[0] : recommendation.recommendedIngredients[0] ?? "";

  return {
    primaryConcern: primary,
    secondaryConcerns: concerns.slice(1),
    productCategory: inferPilotProductCategory(concerns),
    bodyArea: inferPilotBodyArea(concerns),
    sensitivityLevel: recommendationSensitivity(recommendation),
    managementLevel: recommendation.managementLevel ?? null,
  };
}

function inferPilotBodyArea(concerns: string[]): string {
  const canonical = concerns
    .map((c) => toCanonicalConcern(c))
    .filter(Boolean);
  if (canonical.includes("antiaging")) return "eye_area";
  return "face";
}
