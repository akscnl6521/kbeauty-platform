export type ClinicEvidenceSource = {
  sourceUrl: string;
  sourceType: "official_site" | "medical_directory" | "public_registry";
  verifiedAt: string;
};

export type ClinicCandidate = {
  id: string;
  name: string;
  specialties: string[];
  symptomTags: string[];
  treatmentInfoTags: string[];
  distanceKm: number | null;
  officialSiteUrl: string | null;
  bookingUrl: string | null;
  evidence: ClinicEvidenceSource[];
  isPartner: boolean;
  partnershipType: "none" | "booking_fee" | "sponsored_listing" | "lead_fee";
  partnershipDisclosure: string | null;
  isActive: boolean;
  /** Optional Stage 6 filters — absent means unknown / no filter match data. */
  languages?: string[];
  consultationBudgetBand?: "unknown" | "low" | "mid" | "high";
};

export type ReferralContext = {
  symptomTags: string[];
  requestedSpecialty: string | null;
  maxDistanceKm: number | null;
  urgent: boolean;
  /** ISO-ish language codes the user can use (e.g. ko, en). Empty = no language filter. */
  languages?: string[] | null;
  /** Consultation budget preference. unknown/null = no budget filter. */
  consultationBudgetBand?: "unknown" | "low" | "mid" | "high" | null;
};

export type ClinicRankingExtras = {
  languages?: string[];
  consultationBudgetBand?: "unknown" | "low" | "mid" | "high";
};

export type RankedClinic = ClinicCandidate & {
  organicScore: number;
  matchedSymptoms: string[];
  reasonCodes: string[];
  displayDisclosure: string | null;
};

function normalizedSet(values: string[]): Set<string> {
  return new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function recentEvidenceCount(candidate: ClinicCandidate, now: Date): number {
  const threshold = new Date(now);
  threshold.setMonth(threshold.getMonth() - 12);
  return candidate.evidence.filter((item) => {
    const verifiedAt = new Date(item.verifiedAt);
    return !Number.isNaN(verifiedAt.getTime()) && verifiedAt >= threshold;
  }).length;
}

function candidateExtras(candidate: ClinicCandidate): ClinicRankingExtras {
  const record = candidate as ClinicCandidate & ClinicRankingExtras;
  return {
    languages: Array.isArray(record.languages) ? record.languages : undefined,
    consultationBudgetBand: record.consultationBudgetBand,
  };
}

export function rankClinicCandidates(
  candidates: ClinicCandidate[],
  context: ReferralContext,
  now: Date = new Date()
): RankedClinic[] {
  if (context.urgent) return [];

  const requestedSymptoms = normalizedSet(context.symptomTags);
  const specialty = context.requestedSpecialty?.trim().toLowerCase() ?? null;
  const requestedLanguages = normalizedSet(context.languages ?? []);
  const budget = context.consultationBudgetBand ?? null;

  return candidates
    .filter((candidate) => candidate.isActive)
    .filter((candidate) => {
      if (requestedLanguages.size === 0) return true;
      const langs = normalizedSet(candidateExtras(candidate).languages ?? []);
      if (langs.size === 0) return false;
      return [...requestedLanguages].some((lang) => langs.has(lang));
    })
    .filter((candidate) => {
      if (!budget || budget === "unknown") return true;
      const band = candidateExtras(candidate).consultationBudgetBand ?? "unknown";
      return band === budget || band === "unknown";
    })
    .map((candidate): RankedClinic => {
      const symptomTags = normalizedSet(candidate.symptomTags);
      const specialties = normalizedSet(candidate.specialties);
      const matchedSymptoms = [...requestedSymptoms].filter((tag) => symptomTags.has(tag));
      const reasons: string[] = [];
      let score = 0;

      score += matchedSymptoms.length * 30;
      if (matchedSymptoms.length > 0) reasons.push("symptom_specialty_match");

      if (specialty && specialties.has(specialty)) {
        score += 25;
        reasons.push("requested_specialty_match");
      }

      const evidenceCount = recentEvidenceCount(candidate, now);
      score += Math.min(20, evidenceCount * 5);
      if (evidenceCount > 0) reasons.push("recent_source_evidence");

      if (candidate.officialSiteUrl) {
        score += 8;
        reasons.push("official_site_available");
      }

      if (
        context.maxDistanceKm !== null &&
        candidate.distanceKm !== null &&
        candidate.distanceKm <= context.maxDistanceKm
      ) {
        score += Math.max(0, 15 - candidate.distanceKm);
        reasons.push("within_distance_preference");
      }

      const extras = candidateExtras(candidate);
      if (requestedLanguages.size > 0) {
        const langs = normalizedSet(extras.languages ?? []);
        if ([...requestedLanguages].some((lang) => langs.has(lang))) {
          score += 6;
          reasons.push("language_match");
        }
      }
      if (budget && budget !== "unknown") {
        const band = extras.consultationBudgetBand ?? "unknown";
        if (band === budget) {
          score += 4;
          reasons.push("budget_band_match");
        }
      }

      if (matchedSymptoms.length === 0) score -= 40;
      if (candidate.evidence.length === 0) score -= 25;

      const displayDisclosure = candidate.isPartner
        ? candidate.partnershipDisclosure?.trim() || "제휴 의료기관입니다."
        : null;

      return {
        ...candidate,
        organicScore: Number(score.toFixed(2)),
        matchedSymptoms,
        reasonCodes: reasons,
        displayDisclosure,
      };
    })
    .filter((candidate) => candidate.matchedSymptoms.length > 0 && candidate.evidence.length > 0)
    .sort((a, b) => {
      if (b.organicScore !== a.organicScore) return b.organicScore - a.organicScore;
      const aDistance = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const bDistance = b.distanceKm ?? Number.POSITIVE_INFINITY;
      return aDistance - bDistance;
    });
}

/**
 * 자연 검색 결과와 제휴 영역을 완전히 분리한다.
 * 제휴 여부는 organicScore 계산에 절대 사용하지 않으며,
 * 동일 의료기관이 두 영역에 중복 노출되지 않는다.
 */
export function splitOrganicAndPartnered(ranked: RankedClinic[]): {
  organic: RankedClinic[];
  partnered: RankedClinic[];
} {
  return {
    organic: ranked.filter((clinic) => !clinic.isPartner),
    partnered: ranked.filter((clinic) => clinic.isPartner),
  };
}

export function validateClinicCandidate(candidate: ClinicCandidate): string[] {
  const reasons: string[] = [];
  if (!candidate.name.trim()) reasons.push("clinic_name_missing");
  if (candidate.symptomTags.length === 0) reasons.push("symptom_tags_missing");
  if (candidate.specialties.length === 0) reasons.push("specialties_missing");
  if (candidate.evidence.length === 0) reasons.push("evidence_missing");
  if (candidate.isPartner && candidate.partnershipType === "none") {
    reasons.push("partnership_type_missing");
  }
  if (candidate.isPartner && !candidate.partnershipDisclosure?.trim()) {
    reasons.push("partnership_disclosure_missing");
  }
  if (!candidate.isPartner && candidate.partnershipType !== "none") {
    reasons.push("non_partner_partnership_type_mismatch");
  }
  if (!candidate.isPartner && candidate.partnershipDisclosure?.trim()) {
    reasons.push("non_partner_disclosure_mismatch");
  }
  return reasons;
}
