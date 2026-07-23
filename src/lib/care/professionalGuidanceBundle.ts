/**
 * Symptom-based professional guidance bundle:
 * routes + Organic vs partnered clinics + fixture blocking + user guidance copy.
 */

import {
  routeProfessionalGuidance,
  type ProfessionalRoute,
  type SymptomArea,
} from "@/lib/care/professionalRouting";
import { buildCareGuidanceViewModel } from "@/lib/care/guidanceViewModel";
import {
  buildClinicReferralPresentation,
  type ClinicReferralPresentation,
} from "@/lib/clinic/clinicReferralService";
import type { ClinicFieldRecord } from "@/lib/clinic/clinicVerification";
import { resolveAdSlot } from "@/lib/commercial/adSlotPolicy";

export type ProfessionalGuidanceBundleInput = {
  areas: SymptomArea[];
  pain?: boolean;
  bleeding?: boolean;
  discharge?: boolean;
  severeInflammation?: boolean;
  spreadingRash?: boolean;
  breathingDifficulty?: boolean;
  suspectedInfection?: boolean;
  suddenWorsening?: boolean;
  skinConcerns?: string[];
  managementLevel?:
    | "cosmetic_care"
    | "observe"
    | "combined_care"
    | "expert_first"
    | "urgent_check";
  catalog?: ClinicFieldRecord[];
  languages?: string[] | null;
  maxDistanceKm?: number | null;
  includeDemoPreview?: boolean;
  now?: Date;
};

export type ProfessionalGuidanceBundle = {
  routes: ProfessionalRoute[];
  productRecommendationAllowed: boolean;
  guidance: ReturnType<typeof buildCareGuidanceViewModel>;
  clinics: ClinicReferralPresentation;
  lanes: {
    organicClinics: ClinicReferralPresentation["organic"];
    partneredClinics: ClinicReferralPresentation["partnered"];
    fixtureBlockedFromPublish: true;
    demoPreviewOnly: ClinicReferralPresentation["demoPreview"];
  };
  adSlots: {
    organic: ReturnType<typeof resolveAdSlot>;
    partnerAside: ReturnType<typeof resolveAdSlot>;
    safety: ReturnType<typeof resolveAdSlot>;
  };
  disclosures: {
    organicVsPartner: string;
    fixture: string;
  };
};

function inferManagementLevel(
  routes: ProfessionalRoute[],
  override?: ProfessionalGuidanceBundleInput["managementLevel"],
): ProfessionalGuidanceBundleInput["managementLevel"] {
  if (override) return override;
  if (routes.some((r) => r.urgency === "emergency")) return "urgent_check";
  if (routes.some((r) => !r.productRecommendationAllowed)) return "expert_first";
  if (routes.length > 0) return "combined_care";
  return "observe";
}

export function buildProfessionalGuidanceBundle(
  input: ProfessionalGuidanceBundleInput,
): ProfessionalGuidanceBundle {
  const routes = routeProfessionalGuidance(input);
  const productRecommendationAllowed = routes.every(
    (route) => route.productRecommendationAllowed,
  );
  const managementLevel = inferManagementLevel(routes, input.managementLevel);
  const guidance = buildCareGuidanceViewModel({
    managementLevel,
    skinConcerns: input.skinConcerns ?? input.areas,
    professionalRoutes: routes,
  });

  const clinics = buildClinicReferralPresentation({
    routes,
    catalog: input.catalog,
    languages: input.languages,
    maxDistanceKm: input.maxDistanceKm,
    includeDemoPreview: input.includeDemoPreview,
    now: input.now,
  });

  const safetyZone =
    guidance.clinicMode === "urgent"
      ? resolveAdSlot("urgent_safety")
      : guidance.clinicMode === "priority"
        ? resolveAdSlot("expert_first_safety")
        : resolveAdSlot("organic_recommendation");

  return {
    routes,
    productRecommendationAllowed,
    guidance,
    clinics,
    lanes: {
      organicClinics: clinics.organic,
      partneredClinics: clinics.partnered,
      fixtureBlockedFromPublish: true,
      demoPreviewOnly: clinics.demoPreview,
    },
    adSlots: {
      organic: resolveAdSlot("organic_recommendation"),
      partnerAside: resolveAdSlot("clinic_partner_aside"),
      safety: safetyZone,
    },
    disclosures: {
      organicVsPartner: clinics.disclosure.partnered,
      fixture: clinics.disclosure.demo,
    },
  };
}

/** True when every user-facing clinic is non-fixture and publishable path only. */
export function assertNoFixtureInPublishableLanes(
  bundle: ProfessionalGuidanceBundle,
): boolean {
  const publishable = [...bundle.lanes.organicClinics, ...bundle.lanes.partneredClinics];
  return publishable.every((clinic) => !clinic.isDemo);
}
