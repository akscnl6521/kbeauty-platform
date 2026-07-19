export type CommercialRelationship =
  | "none"
  | "affiliate_link"
  | "sponsored_product"
  | "sponsored_clinic"
  | "booking_commission";

export type CommercialCandidate = {
  id: string;
  entityType: "product" | "clinic";
  organicScore: number;
  relationship: CommercialRelationship;
  sponsorName: string | null;
  disclosureText: string | null;
  destinationUrl: string | null;
  organicRankEligible: boolean;
  evidenceVerified: boolean;
};

export type CommercialPresentation = {
  organic: CommercialCandidate[];
  affiliateEligible: CommercialCandidate[];
  sponsored: CommercialCandidate[];
  blocked: Array<CommercialCandidate & { reasonCodes: string[] }>;
};

export function defaultDisclosure(candidate: CommercialCandidate): string | null {
  switch (candidate.relationship) {
    case "affiliate_link":
      return "이 링크를 통한 구매가 발생하면 플랫폼이 수수료를 받을 수 있습니다.";
    case "sponsored_product":
      return candidate.sponsorName
        ? `${candidate.sponsorName}의 유료 광고 제품입니다.`
        : "유료 광고 제품입니다.";
    case "sponsored_clinic":
      return candidate.sponsorName
        ? `${candidate.sponsorName}의 유료 광고 의료기관입니다.`
        : "유료 광고 의료기관입니다.";
    case "booking_commission":
      return "예약이 완료되면 플랫폼이 수수료를 받을 수 있습니다.";
    default:
      return null;
  }
}

function validateCommercialCandidate(candidate: CommercialCandidate): string[] {
  const reasons: string[] = [];
  if (!candidate.evidenceVerified) reasons.push("evidence_unverified");
  if (candidate.relationship !== "none" && !candidate.destinationUrl) {
    reasons.push("commercial_destination_missing");
  }
  if (
    (candidate.relationship === "sponsored_product" ||
      candidate.relationship === "sponsored_clinic") &&
    !candidate.sponsorName?.trim()
  ) {
    reasons.push("sponsor_identity_missing");
  }
  if (candidate.relationship !== "none" && !(candidate.disclosureText?.trim() || defaultDisclosure(candidate))) {
    reasons.push("commercial_disclosure_missing");
  }
  return reasons;
}

export function buildCommercialPresentation(
  candidates: CommercialCandidate[]
): CommercialPresentation {
  const blocked: CommercialPresentation["blocked"] = [];
  const valid: CommercialCandidate[] = [];

  for (const candidate of candidates) {
    const reasons = validateCommercialCandidate(candidate);
    if (reasons.length > 0) {
      blocked.push({ ...candidate, reasonCodes: reasons });
    } else {
      valid.push({
        ...candidate,
        disclosureText: candidate.disclosureText?.trim() || defaultDisclosure(candidate),
      });
    }
  }

  const organic = valid
    .filter((candidate) => candidate.organicRankEligible)
    .sort((a, b) => b.organicScore - a.organicScore);

  const affiliateEligible = organic.filter(
    (candidate) =>
      candidate.relationship === "affiliate_link" ||
      candidate.relationship === "booking_commission"
  );

  const sponsored = valid.filter(
    (candidate) =>
      candidate.relationship === "sponsored_product" ||
      candidate.relationship === "sponsored_clinic"
  );

  return { organic, affiliateEligible, sponsored, blocked };
}

export function assertOrganicOrderUnchanged(
  original: CommercialCandidate[],
  presented: CommercialCandidate[]
): boolean {
  const expected = original
    .filter((candidate) => candidate.organicRankEligible && candidate.evidenceVerified)
    .sort((a, b) => b.organicScore - a.organicScore)
    .map((candidate) => candidate.id);
  const actual = presented.map((candidate) => candidate.id);
  return expected.length === actual.length && expected.every((id, index) => actual[index] === id);
}
