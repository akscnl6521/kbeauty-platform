import type { ClinicStagingOperation } from "@/lib/clinic/clinicStagingSyncPlan";

export type ClinicReviewPriority = "critical" | "high" | "medium" | "low";

export type ClinicReviewItem = {
  queuePosition: number;
  priority: ClinicReviewPriority;
  action: ClinicStagingOperation["action"];
  clinicId: string | null;
  sourceHash: string;
  reasonCodes: string[];
  publishAllowed: false;
  recommendedReviewAction:
    | "confirm_inactive_or_block"
    | "verify_partnership_disclosure"
    | "verify_operating_status"
    | "complete_symptom_and_specialty_tags"
    | "review_source_evidence";
};

const CRITICAL_REASONS = new Set([
  "clinic_inactive",
  "official_source_reports_closed",
  "block_listing_required",
]);

const PARTNERSHIP_REASONS = new Set([
  "partnership_disclosure_missing",
  "affiliate_disclosure_missing",
  "sponsorship_disclosure_missing",
]);

const OPERATING_STATUS_REASONS = new Set([
  "operating_status_unconfirmed",
  "activity_status_missing",
  "clinic_status_unknown",
]);

const TAG_REASONS = new Set([
  "symptom_tags_missing",
  "specialties_missing",
  "symptom_specialty_mapping_missing",
]);

function includesAny(values: string[], candidates: Set<string>): boolean {
  return values.some((value) => candidates.has(value));
}

function classify(operation: ClinicStagingOperation): {
  priority: ClinicReviewPriority;
  recommendedReviewAction: ClinicReviewItem["recommendedReviewAction"];
  rank: number;
} {
  if (
    operation.action === "block_listing" ||
    includesAny(operation.reasonCodes, CRITICAL_REASONS)
  ) {
    return {
      priority: "critical",
      recommendedReviewAction: "confirm_inactive_or_block",
      rank: 0,
    };
  }

  if (includesAny(operation.reasonCodes, PARTNERSHIP_REASONS)) {
    return {
      priority: "high",
      recommendedReviewAction: "verify_partnership_disclosure",
      rank: 1,
    };
  }

  if (includesAny(operation.reasonCodes, OPERATING_STATUS_REASONS)) {
    return {
      priority: "high",
      recommendedReviewAction: "verify_operating_status",
      rank: 2,
    };
  }

  if (includesAny(operation.reasonCodes, TAG_REASONS)) {
    return {
      priority: "medium",
      recommendedReviewAction: "complete_symptom_and_specialty_tags",
      rank: 3,
    };
  }

  return {
    priority: "low",
    recommendedReviewAction: "review_source_evidence",
    rank: 4,
  };
}

export function buildClinicReviewQueue(
  operations: ClinicStagingOperation[]
): ClinicReviewItem[] {
  return operations
    .filter((operation) => operation.action !== "no_change")
    .map((operation) => ({ operation, classification: classify(operation) }))
    .sort((a, b) => {
      if (a.classification.rank !== b.classification.rank) {
        return a.classification.rank - b.classification.rank;
      }
      const clinicCompare = (a.operation.clinicId ?? "").localeCompare(
        b.operation.clinicId ?? ""
      );
      if (clinicCompare !== 0) return clinicCompare;
      return a.operation.sourceHash.localeCompare(b.operation.sourceHash);
    })
    .map(({ operation, classification }, index) => ({
      queuePosition: index + 1,
      priority: classification.priority,
      action: operation.action,
      clinicId: operation.clinicId,
      sourceHash: operation.sourceHash,
      reasonCodes: [...operation.reasonCodes],
      publishAllowed: false,
      recommendedReviewAction: classification.recommendedReviewAction,
    }));
}
