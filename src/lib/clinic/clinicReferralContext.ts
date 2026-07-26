/**
 * Map professional routes / symptom areas → clinic ranking context.
 */

import type { ProfessionalRoute, ProfessionalType, SymptomArea } from "@/lib/care/professionalRouting";
import type { ReferralContext } from "@/lib/clinic/referralRankingPolicy";

const AREA_TO_TAGS: Record<SymptomArea, string[]> = {
  acne: ["여드름"],
  redness_vascular: ["홍조"],
  sensitivity: ["민감성"],
  pigmentation: ["색소"],
  scarring: ["흉터"],
  allergy: ["알레르기", "민감성"],
  hair_loss_scalp_inflammation: ["탈모", "두피"],
  nail_change: ["손발톱"],
  oral_smile: ["구강"],
  sudden_change: ["급변"],
  prolonged_non_improvement: ["장기미호전"],
};

const TYPE_TO_SPECIALTY: Record<ProfessionalType, string | null> = {
  dermatology: "피부과",
  hair_scalp_clinic: "탈모클리닉",
  allergy_care: "알레르기",
  dentistry: "치과",
  urgent_care: null,
  other: null,
};

export function symptomAreasToTags(areas: SymptomArea[]): string[] {
  const tags = new Set<string>();
  for (const area of areas) {
    for (const tag of AREA_TO_TAGS[area] ?? []) tags.add(tag);
  }
  return [...tags];
}

export function professionalTypeToSpecialty(
  type: ProfessionalType,
): string | null {
  return TYPE_TO_SPECIALTY[type] ?? null;
}

export function buildReferralContextFromRoutes(
  routes: ProfessionalRoute[],
  options?: {
    maxDistanceKm?: number | null;
    languages?: string[] | null;
    consultationBudgetBand?: ReferralContext["consultationBudgetBand"];
    reasonAreas?: SymptomArea[];
  },
): ReferralContext {
  const urgent = routes.some(
    (route) =>
      route.urgency === "emergency" || route.professionalType === "urgent_care",
  );
  const tags = new Set<string>();
  for (const area of options?.reasonAreas ?? []) {
    for (const tag of AREA_TO_TAGS[area] ?? []) tags.add(tag);
  }
  for (const route of routes) {
    if (route.reason && AREA_TO_TAGS[route.reason as SymptomArea]) {
      for (const tag of AREA_TO_TAGS[route.reason as SymptomArea]) tags.add(tag);
    }
  }
  // Fallback Korean tags from professional type when reason is not an area code
  if (tags.size === 0) {
    for (const route of routes) {
      if (route.professionalType === "dermatology") {
        tags.add("여드름");
        tags.add("홍조");
        tags.add("민감성");
      }
      if (route.professionalType === "hair_scalp_clinic") {
        tags.add("탈모");
        tags.add("두피");
      }
      if (route.professionalType === "allergy_care") {
        tags.add("알레르기");
        tags.add("민감성");
      }
    }
  }

  const specialty =
    routes
      .map((route) => professionalTypeToSpecialty(route.professionalType))
      .find((value) => Boolean(value)) ?? null;

  return {
    symptomTags: [...tags],
    requestedSpecialty: specialty,
    maxDistanceKm: options?.maxDistanceKm ?? 30,
    urgent,
    languages: options?.languages ?? ["ko"],
    consultationBudgetBand: options?.consultationBudgetBand ?? null,
  };
}
