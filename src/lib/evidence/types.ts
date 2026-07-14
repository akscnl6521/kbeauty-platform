/**
 * Evidence Layer — concern → ingredient citations (docs/33).
 * Hints ranking; never certifies product efficacy.
 */

export type EvidenceLevel =
  | "systematic_review"
  | "randomized_controlled_trial"
  | "controlled_clinical_study"
  | "observational_study"
  | "expert_guideline"
  | "in_vitro"
  | "manufacturer_claim"
  | "insufficient";

export type EvidenceType =
  | "cosmetic_study"
  | "drug_study"
  | "guideline"
  | "claim";

export type ApprovedEvidenceLink = {
  id: string;
  concernCode: string;
  concernNameKo?: string;
  ingredientSlug: string;
  ingredientNameEn: string;
  ingredientNameKo: string;
  aliases: string[];
  evidenceLevel: EvidenceLevel;
  evidenceType: EvidenceType;
  outcomeSummary: string;
  pmid: string | null;
  doi: string | null;
  sourceUrl: string | null;
  journal: string | null;
  publicationYear: number | null;
  conflictOfInterest: string | null;
};

/** Levels usable as core recommend hints (docs/33 §8). */
export function isCoreEvidenceLevel(level: EvidenceLevel | string): boolean {
  return (
    level !== "manufacturer_claim" &&
    level !== "insufficient" &&
    level !== "in_vitro"
  );
}

export function evidenceCitationHref(link: ApprovedEvidenceLink): string | null {
  const url = link.sourceUrl?.trim();
  if (url && /^https:\/\//i.test(url)) return url;
  if (link.pmid?.trim()) {
    return `https://pubmed.ncbi.nlm.nih.gov/${link.pmid.trim()}/`;
  }
  if (link.doi?.trim()) {
    return `https://doi.org/${link.doi.trim()}`;
  }
  return null;
}

export function evidenceLevelLabelKo(level: string): string {
  const map: Record<string, string> = {
    systematic_review: "체계적 문헌고찰",
    randomized_controlled_trial: "RCT",
    controlled_clinical_study: "대조 임상·인체적용",
    observational_study: "관찰 연구",
    expert_guideline: "전문가·가이드라인",
    in_vitro: "시험관 연구",
    manufacturer_claim: "제조사 클레임",
    insufficient: "근거 부족",
  };
  return map[level] ?? level;
}
