/**
 * Prove commercial relationship fields do not alter Organic rank or clinical fit.
 */

import { rankClinicCandidates, type ClinicCandidate } from "@/lib/clinic/referralRankingPolicy";
import {
  assertPaidFieldsDoNotAlterOrganicOrder,
  rankByOrganicScoreOnly,
  type OrganicRankInput,
} from "@/lib/commercial/organicRanking";
import type { CommercialMetadata } from "@/lib/catalog/commonProduct";
import type { CommercialIndependenceProof } from "./types";
import { COMMERCIAL_INDEPENDENCE_NOTE_KO } from "./constants";

function emptyCommercial(
  overrides?: Partial<CommercialMetadata>,
): CommercialMetadata {
  return {
    isAffiliate: false,
    affiliateUrl: null,
    commissionType: null,
    campaignId: null,
    partner: null,
    disclosureLabel: null,
    isSponsored: false,
    sponsoredPlacement: null,
    affiliateVerifiedAt: null,
    organicRank: null,
    ...overrides,
  };
}

function baseOrganicInputs(): OrganicRankInput[] {
  return [
    {
      id: "clinic-a",
      entityType: "clinic",
      organicScore: 0.88,
      commercial: emptyCommercial(),
    },
    {
      id: "clinic-b",
      entityType: "clinic",
      organicScore: 0.64,
      commercial: emptyCommercial(),
    },
    {
      id: "clinic-c",
      entityType: "clinic",
      organicScore: 0.41,
      commercial: emptyCommercial(),
    },
  ];
}

function withPaidNoise(base: OrganicRankInput[]): OrganicRankInput[] {
  // Paid metadata only — organicScore unchanged. Sponsored lane is separate;
  // here we prove affiliate/partner noise cannot reorder Organic scores.
  return [
    {
      ...base[0],
      commercial: emptyCommercial({
        isAffiliate: true,
        affiliateUrl: "https://partner.example/a",
        commissionType: "cpl",
        campaignId: "camp-a",
        partner: "Partner A",
        disclosureLabel: "제휴",
        affiliateVerifiedAt: "2026-07-20T00:00:00.000Z",
        organicRank: 99,
      }),
    },
    {
      ...base[1],
      commercial: emptyCommercial({
        isAffiliate: true,
        affiliateUrl: "https://partner.example/b",
        commissionType: "cps",
        campaignId: "camp-b",
        partner: "Partner B",
        disclosureLabel: "제휴",
        affiliateVerifiedAt: "2026-07-20T00:00:00.000Z",
        sponsoredPlacement: 1,
      }),
    },
    {
      ...base[2],
      commercial: emptyCommercial({
        isAffiliate: true,
        commissionType: "cpa",
        affiliateUrl: "https://partner.example/c",
        partner: "Partner C",
        disclosureLabel: "제휴",
        affiliateVerifiedAt: "2026-07-20T00:00:00.000Z",
      }),
    },
  ];
}

function baseClinicCandidates(): ClinicCandidate[] {
  return [
    {
      id: "clinic-a",
      name: "Clinic A",
      specialties: ["dermatology"],
      symptomTags: ["acne"],
      treatmentInfoTags: [],
      distanceKm: 2,
      officialSiteUrl: "https://example.org/a",
      bookingUrl: null,
      evidence: [
        {
          sourceUrl: "https://example.org/a",
          sourceType: "official_site",
          verifiedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
      isPartner: false,
      partnershipType: "none",
      partnershipDisclosure: null,
      isActive: true,
    },
    {
      id: "clinic-b",
      name: "Clinic B",
      specialties: ["dermatology"],
      symptomTags: ["acne"],
      treatmentInfoTags: [],
      distanceKm: 5,
      officialSiteUrl: "https://example.org/b",
      bookingUrl: null,
      evidence: [
        {
          sourceUrl: "https://example.org/b",
          sourceType: "public_registry",
          verifiedAt: "2026-05-01T00:00:00.000Z",
        },
      ],
      isPartner: false,
      partnershipType: "none",
      partnershipDisclosure: null,
      isActive: true,
    },
    {
      id: "clinic-c",
      name: "Clinic C",
      specialties: ["dermatology"],
      symptomTags: ["acne"],
      treatmentInfoTags: [],
      distanceKm: 8,
      officialSiteUrl: null,
      bookingUrl: null,
      evidence: [
        {
          sourceUrl: "https://registry.example/c",
          sourceType: "medical_directory",
          verifiedAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      isPartner: false,
      partnershipType: "none",
      partnershipDisclosure: null,
      isActive: true,
    },
  ];
}

function withPartnerNoise(base: ClinicCandidate[]): ClinicCandidate[] {
  return [
    {
      ...base[0],
      isPartner: true,
      partnershipType: "booking_fee",
      partnershipDisclosure: "예약 수수료 제휴",
      bookingUrl: "https://partner.example/book-a",
    },
    {
      ...base[1],
      isPartner: true,
      partnershipType: "sponsored_listing",
      partnershipDisclosure: "스폰서 노출",
    },
    {
      ...base[2],
      isPartner: true,
      partnershipType: "lead_fee",
      partnershipDisclosure: "리드 수수료",
    },
  ];
}

/**
 * Clinical fit = organicScore from referral ranking (symptom/specialty/evidence/distance).
 * Partnership fields must not change that score or relative order among the same clinical inputs.
 */
export function proveCommercialIndependence(
  now: Date = new Date("2026-07-24T05:00:00.000Z"),
): CommercialIndependenceProof {
  const organicBase = baseOrganicInputs();
  const organicPaid = withPaidNoise(organicBase);
  const organicOrderUnchanged = assertPaidFieldsDoNotAlterOrganicOrder(
    organicBase,
    organicPaid,
  );
  const organicOrderIds = rankByOrganicScoreOnly(organicBase).map((c) => c.id);
  const paidNoiseOrderIds = rankByOrganicScoreOnly(organicPaid).map((c) => c.id);

  const clinicBase = baseClinicCandidates();
  const clinicPaid = withPartnerNoise(clinicBase);
  const context = {
    symptomTags: ["acne"],
    requestedSpecialty: "dermatology",
    maxDistanceKm: 20,
    urgent: false,
  };

  const rankedBase = rankClinicCandidates(clinicBase, context, now);
  const rankedPaid = rankClinicCandidates(clinicPaid, context, now);

  const clinicalFitOrderIds = rankedBase.map((c) => c.id);
  const paidClinicalOrderIds = rankedPaid.map((c) => c.id);

  const scoresMatch =
    rankedBase.length === rankedPaid.length &&
    rankedBase.every(
      (row, i) =>
        row.id === rankedPaid[i].id &&
        row.organicScore === rankedPaid[i].organicScore,
    );

  const clinicalFitOrderUnchanged =
    scoresMatch &&
    clinicalFitOrderIds.join("|") === paidClinicalOrderIds.join("|");

  return {
    organicOrderUnchanged,
    clinicalFitOrderUnchanged,
    organicOrderIds,
    clinicalFitOrderIds,
    paidNoiseOrderIds,
    noteKo: COMMERCIAL_INDEPENDENCE_NOTE_KO,
  };
}

/**
 * Derive stable clinical/organic scores for gate audit rows from clinical inputs only.
 * Commercial relationship is ignored.
 */
export function scoreClinicFitIgnoringCommercial(input: {
  symptomMatchCount: number;
  hasOfficialDept: boolean;
  specialistCount: number | null;
  evidenceStrength: "none" | "weak" | "moderate" | "strong" | "unknown";
}): { organicScore: number; clinicalFitScore: number } {
  let clinical = 0;
  clinical += input.symptomMatchCount * 30;
  if (input.hasOfficialDept) clinical += 25;
  if (input.specialistCount != null && input.specialistCount > 0) {
    clinical += Math.min(15, input.specialistCount * 5);
  }
  switch (input.evidenceStrength) {
    case "strong":
      clinical += 20;
      break;
    case "moderate":
      clinical += 12;
      break;
    case "weak":
      clinical += 4;
      break;
    default:
      break;
  }
  const clinicalFitScore = Number(clinical.toFixed(2));
  // Organic score for clinic listing mirrors clinical fit in this dry-run gate.
  return { organicScore: clinicalFitScore, clinicalFitScore };
}
