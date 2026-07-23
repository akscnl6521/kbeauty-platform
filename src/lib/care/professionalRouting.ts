export type ProfessionalType =
  | "dermatology"
  | "hair_scalp_clinic"
  | "allergy_care"
  | "dentistry"
  | "urgent_care"
  | "other";

export type SymptomArea =
  | "acne"
  | "redness_vascular"
  | "sensitivity"
  | "pigmentation"
  | "scarring"
  | "allergy"
  | "hair_loss_scalp_inflammation"
  | "nail_change"
  | "oral_smile"
  | "sudden_change"
  | "prolonged_non_improvement";

export type ProfessionalRoute = {
  professionalType: ProfessionalType;
  urgency: "routine" | "soon" | "prompt" | "emergency";
  reason: string;
  productRecommendationAllowed: boolean;
};

export function routeProfessionalGuidance(input: {
  areas: SymptomArea[];
  pain?: boolean;
  bleeding?: boolean;
  discharge?: boolean;
  severeInflammation?: boolean;
  spreadingRash?: boolean;
  breathingDifficulty?: boolean;
  suspectedInfection?: boolean;
  suddenWorsening?: boolean;
}): ProfessionalRoute[] {
  if (input.breathingDifficulty) {
    return [{
      professionalType: "urgent_care",
      urgency: "emergency",
      reason: "breathing_difficulty",
      productRecommendationAllowed: false,
    }];
  }
  const acute =
    input.pain ||
    input.bleeding ||
    input.discharge ||
    input.severeInflammation ||
    input.spreadingRash ||
    input.suspectedInfection ||
    input.suddenWorsening;
  const routes = new Map<ProfessionalType, ProfessionalRoute>();
  const add = (type: ProfessionalType, reason: string) => {
    routes.set(type, {
      professionalType: type,
      urgency: acute ? "prompt" : "soon",
      reason,
      productRecommendationAllowed: !acute,
    });
  };
  for (const area of input.areas) {
    if (area === "allergy") add("allergy_care", area);
    else if (area === "hair_loss_scalp_inflammation") add("hair_scalp_clinic", area);
    else if (area === "oral_smile") add("dentistry", area);
    else add("dermatology", area);
  }
  if (routes.size === 0 && acute) add("dermatology", "acute_signal");
  return [...routes.values()];
}
