import type { ClinicCandidate, ClinicEvidenceSource } from "@/lib/clinic/referralRankingPolicy";

export type ClinicRefreshPriority = "urgent" | "high" | "normal" | "low";
export type ClinicRefreshReason =
  | "operating_status_unknown"
  | "inactive_or_closed"
  | "evidence_missing"
  | "evidence_stale"
  | "official_site_missing"
  | "specialty_evidence_incomplete"
  | "partnership_disclosure_missing"
  | "partnership_reverification_due"
  | "routine_reverification";

export type ClinicRefreshPlanItem = {
  clinicId: string;
  clinicName: string;
  priority: ClinicRefreshPriority;
  dueAt: string;
  reasons: ClinicRefreshReason[];
  checks: Array<
    | "operating_status"
    | "official_site"
    | "specialties"
    | "symptom_tags"
    | "booking_url"
    | "partnership"
  >;
  allowPublicRecommendation: boolean;
};

function validDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function latestEvidence(evidence: ClinicEvidenceSource[]): Date | null {
  return evidence.reduce<Date | null>((latest, item) => {
    const parsed = validDate(item.verifiedAt);
    if (!parsed) return latest;
    return !latest || parsed > latest ? parsed : latest;
  }, null);
}

function addDays(now: Date, days: number): string {
  const due = new Date(now);
  due.setUTCDate(due.getUTCDate() + days);
  return due.toISOString();
}

export function buildClinicRefreshPlanItem(
  clinic: ClinicCandidate,
  now: Date = new Date()
): ClinicRefreshPlanItem {
  const reasons: ClinicRefreshReason[] = [];
  const checks = new Set<ClinicRefreshPlanItem["checks"][number]>();
  const latest = latestEvidence(clinic.evidence);
  const ageDays = latest
    ? Math.floor((now.getTime() - latest.getTime()) / 86_400_000)
    : Number.POSITIVE_INFINITY;

  if (!clinic.isActive) {
    reasons.push("inactive_or_closed");
    checks.add("operating_status");
  }
  if (clinic.evidence.length === 0) {
    reasons.push("evidence_missing");
    checks.add("operating_status");
    checks.add("specialties");
    checks.add("symptom_tags");
  } else if (ageDays > 180) {
    reasons.push("evidence_stale");
    checks.add("operating_status");
    checks.add("specialties");
    checks.add("symptom_tags");
  }
  if (!clinic.officialSiteUrl) {
    reasons.push("official_site_missing");
    checks.add("official_site");
  }
  if (clinic.specialties.length === 0 || clinic.symptomTags.length === 0) {
    reasons.push("specialty_evidence_incomplete");
    checks.add("specialties");
    checks.add("symptom_tags");
  }
  if (clinic.isPartner && !clinic.partnershipDisclosure?.trim()) {
    reasons.push("partnership_disclosure_missing");
    checks.add("partnership");
  } else if (clinic.isPartner && ageDays > 90) {
    reasons.push("partnership_reverification_due");
    checks.add("partnership");
  }

  if (reasons.length === 0) {
    reasons.push("routine_reverification");
    checks.add("operating_status");
    checks.add("official_site");
    checks.add("booking_url");
  }

  let priority: ClinicRefreshPriority = "normal";
  let daysUntilDue = 30;
  if (reasons.includes("inactive_or_closed")) {
    priority = "urgent";
    daysUntilDue = 0;
  } else if (
    reasons.includes("evidence_missing") ||
    reasons.includes("partnership_disclosure_missing") ||
    reasons.includes("specialty_evidence_incomplete")
  ) {
    priority = "high";
    daysUntilDue = 3;
  } else if (reasons.includes("evidence_stale") || reasons.includes("partnership_reverification_due")) {
    priority = "high";
    daysUntilDue = 7;
  } else if (reasons.length === 1 && reasons[0] === "routine_reverification") {
    priority = "low";
    daysUntilDue = 90;
  }

  const allowPublicRecommendation =
    clinic.isActive &&
    clinic.evidence.length > 0 &&
    clinic.specialties.length > 0 &&
    clinic.symptomTags.length > 0 &&
    !(clinic.isPartner && !clinic.partnershipDisclosure?.trim());

  return {
    clinicId: clinic.id,
    clinicName: clinic.name,
    priority,
    dueAt: addDays(now, daysUntilDue),
    reasons,
    checks: [...checks],
    allowPublicRecommendation,
  };
}

export function buildClinicRefreshPlan(
  clinics: ClinicCandidate[],
  now: Date = new Date()
): ClinicRefreshPlanItem[] {
  const weight: Record<ClinicRefreshPriority, number> = {
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1,
  };
  return clinics
    .map((clinic) => buildClinicRefreshPlanItem(clinic, now))
    .sort((a, b) => {
      if (weight[b.priority] !== weight[a.priority]) {
        return weight[b.priority] - weight[a.priority];
      }
      return a.dueAt.localeCompare(b.dueAt);
    });
}
