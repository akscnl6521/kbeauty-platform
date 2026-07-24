/**
 * T07-05 publishable gate — blocks unsafe rows from public visibility.
 * Structural publishable requires official evidence + explicit admin approval.
 * Dry-run always keeps publishAllowed=false and publicVisible=false.
 */

import type {
  AdminGateCandidateInput,
  AdminGateRecord,
  PublishBlockReasonCode,
} from "./types";

function pushUnique(
  list: PublishBlockReasonCode[],
  code: PublishBlockReasonCode,
): void {
  if (!list.includes(code)) list.push(code);
}

/**
 * Collect all block reasons for a candidate. Empty list does not mean
 * publishAllowed — dry-run still forbids public visibility.
 */
export function collectPublishBlockReasons(
  input: AdminGateCandidateInput,
): PublishBlockReasonCode[] {
  const reasons: PublishBlockReasonCode[] = [];

  if (input.isFixture) {
    pushUnique(reasons, "fixture_cannot_publish");
  }

  switch (input.ingestionStatus) {
    case "filtered_out":
      pushUnique(reasons, "ingestion_filtered_out");
      break;
    case "duplicate":
      pushUnique(reasons, "ingestion_duplicate");
      break;
    case "stale":
      pushUnique(reasons, "ingestion_stale");
      break;
    case "needs_refresh":
      pushUnique(reasons, "ingestion_needs_refresh");
      break;
    case "discovered":
    case "absent":
      // Not yet candidate_ready — publish blocked via official evidence / enrichment gates.
      break;
    case "candidate_ready":
      break;
    default:
      break;
  }

  switch (input.enrichmentStatus) {
    case "failed_retryable":
      pushUnique(reasons, "enrichment_failed_retryable");
      break;
    case "failed_terminal":
      pushUnique(reasons, "enrichment_failed_terminal");
      break;
    case "needs_manual_review":
      pushUnique(reasons, "enrichment_needs_manual_review");
      break;
    case "partial":
      pushUnique(reasons, "enrichment_partial");
      break;
    case "pending":
    case "absent":
      pushUnique(reasons, "enrichment_insufficient_evidence");
      break;
    default:
      break;
  }

  if (input.conflictingSource) {
    pushUnique(reasons, "enrichment_conflicting_source");
  }

  if (
    input.enrichmentEvidenceStrength === "none" ||
    input.enrichmentEvidenceStrength === "weak" ||
    input.dermatologyDeptOfficial !== true
  ) {
    pushUnique(reasons, "enrichment_insufficient_evidence");
  }

  switch (input.symptomEvidenceReviewerStatus) {
    case "rejected":
      pushUnique(reasons, "symptom_evidence_rejected");
      break;
    case "stale":
      pushUnique(reasons, "symptom_evidence_stale");
      break;
    case "needs_more_evidence":
    case "pending_review":
    case "absent":
      // Symptom expertise claims are optional for base clinic listing,
      // but if present and unverified they cannot drive publishable claims.
      if (
        input.symptomEvidenceReviewerStatus !== "absent" &&
        !input.symptomEvidencePublishEligible
      ) {
        pushUnique(reasons, "symptom_evidence_unverified");
      }
      if (input.symptomEvidenceReviewerStatus === "needs_more_evidence") {
        pushUnique(reasons, "symptom_evidence_insufficient");
      }
      break;
    default:
      break;
  }

  if (
    input.commercialRelationship === "affiliate" ||
    input.commercialRelationship === "sponsored" ||
    input.commercialRelationship === "booking_fee" ||
    input.commercialRelationship === "lead_fee"
  ) {
    // Paid lane does not block structural registry publishable by itself,
    // but cannot be used as Organic eligibility — recorded for audit clarity
    // when symptom evidence tried to claim organic via paid path.
    if (
      input.symptomEvidenceReviewerStatus === "approved" &&
      !input.symptomEvidencePublishEligible
    ) {
      pushUnique(reasons, "symptom_evidence_paid_lane");
    }
  }

  if (!input.hasRequiredOfficialEvidence) {
    pushUnique(reasons, "official_evidence_missing");
  }

  if (!input.adminApproved) {
    pushUnique(reasons, "admin_approval_missing");
  }

  // Dry-run hard rule: never publicly visible.
  pushUnique(reasons, "public_visibility_forbidden_in_dry_run");

  return reasons;
}

export function isFailedLike(input: AdminGateCandidateInput): boolean {
  return (
    input.enrichmentStatus === "failed_retryable" ||
    input.enrichmentStatus === "failed_terminal" ||
    input.ingestionStatus === "filtered_out"
  );
}

export function isStaleLike(input: AdminGateCandidateInput): boolean {
  return (
    input.ingestionStatus === "stale" ||
    input.ingestionStatus === "needs_refresh" ||
    input.symptomEvidenceReviewerStatus === "stale"
  );
}

export function isInsufficientEvidence(input: AdminGateCandidateInput): boolean {
  return (
    !input.hasRequiredOfficialEvidence ||
    input.enrichmentEvidenceStrength === "none" ||
    input.enrichmentEvidenceStrength === "weak" ||
    input.dermatologyDeptOfficial !== true ||
    input.enrichmentStatus === "partial" ||
    input.enrichmentStatus === "pending" ||
    input.enrichmentStatus === "absent"
  );
}

/** Reasons that document policy but do not hard-block registry publishable. */
const NON_HARD_BLOCK_REASONS = new Set<PublishBlockReasonCode>([
  "public_visibility_forbidden_in_dry_run",
  // Paid commercial is audited separately; does not block registry publishable.
  "symptom_evidence_paid_lane",
]);

/**
 * Structural publishable: official evidence + admin approval + no hard blocks.
 * Still never public in dry-run (publishAllowed stays false).
 */
export function isStructurallyPublishable(
  input: AdminGateCandidateInput,
  blockReasons: PublishBlockReasonCode[],
): boolean {
  if (input.isFixture) return false;
  if (!input.hasRequiredOfficialEvidence) return false;
  if (!input.adminApproved) return false;
  if (input.conflictingSource) return false;
  if (isFailedLike(input)) return false;
  if (isStaleLike(input)) return false;
  if (isInsufficientEvidence(input)) return false;
  if (input.ingestionStatus !== "candidate_ready") return false;
  if (
    input.enrichmentStatus !== "enriched" &&
    input.enrichmentStatus !== "skipped_cached"
  ) {
    return false;
  }

  const hardBlocks = blockReasons.filter((r) => !NON_HARD_BLOCK_REASONS.has(r));
  return hardBlocks.length === 0;
}

export function isAdminReviewEligible(
  input: AdminGateCandidateInput,
  blockReasons: PublishBlockReasonCode[],
): boolean {
  if (input.isFixture) return false;
  if (isFailedLike(input)) return false;
  if (input.conflictingSource) return false;
  if (input.ingestionStatus !== "candidate_ready") return false;
  if (
    input.enrichmentStatus !== "enriched" &&
    input.enrichmentStatus !== "skipped_cached" &&
    input.enrichmentStatus !== "needs_manual_review" &&
    input.enrichmentStatus !== "partial"
  ) {
    return false;
  }
  // Eligible for admin queue even if approval missing / dry-run public forbid.
  const disqualifying = new Set<PublishBlockReasonCode>([
    "fixture_cannot_publish",
    "ingestion_failed",
    "ingestion_filtered_out",
    "ingestion_duplicate",
    "ingestion_stale",
    "enrichment_failed_retryable",
    "enrichment_failed_terminal",
    "enrichment_conflicting_source",
    "symptom_evidence_rejected",
  ]);
  return !blockReasons.some((r) => disqualifying.has(r));
}

export function evaluatePublishableGate(
  input: AdminGateCandidateInput,
  evaluatedAt: string,
  scores: { organicScore: number; clinicalFitScore: number },
): AdminGateRecord {
  const blockReasons = collectPublishBlockReasons(input);
  const structurallyPublishable = isStructurallyPublishable(input, blockReasons);
  const adminReviewEligible = isAdminReviewEligible(input, blockReasons);

  let status: AdminGateRecord["status"] = "blocked";
  if (structurallyPublishable) {
    status = "structurally_publishable";
  } else if (adminReviewEligible) {
    status = "admin_review_eligible";
  } else {
    status = "blocked";
  }

  // Dry-run: always public_forbidden for visibility flags.
  return {
    recordId: input.recordId,
    institutionId: input.institutionId,
    name: input.name,
    status,
    blockReasons,
    structurallyPublishable,
    adminReviewEligible,
    publicVisible: false,
    publishAllowed: false,
    isFixture: input.isFixture,
    commercialRelationship: input.commercialRelationship,
    organicScore: scores.organicScore,
    clinicalFitScore: scores.clinicalFitScore,
    stages: [
      "hira_ingestion",
      "institution_enrichment",
      "symptom_evidence_review",
      "admin_publishable_gate",
    ],
    evaluatedAt,
  };
}

/**
 * Hard invariant: fixture / failed / stale / conflicting / insufficient
 * must never be publicVisible.
 */
export function assertUnsafeNeverPublic(
  records: AdminGateRecord[],
  inputsById: Map<string, AdminGateCandidateInput>,
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const record of records) {
    if (record.publicVisible || record.publishAllowed) {
      violations.push(`${record.recordId}:public_or_publish_true`);
    }
    const input = inputsById.get(record.recordId);
    if (!input) continue;
    const unsafe =
      input.isFixture ||
      isFailedLike(input) ||
      isStaleLike(input) ||
      input.conflictingSource ||
      isInsufficientEvidence(input);
    if (unsafe && (record.publicVisible || record.publishAllowed)) {
      violations.push(`${record.recordId}:unsafe_public`);
    }
    if (unsafe && record.structurallyPublishable) {
      violations.push(`${record.recordId}:unsafe_structurally_publishable`);
    }
  }
  return { ok: violations.length === 0, violations };
}
