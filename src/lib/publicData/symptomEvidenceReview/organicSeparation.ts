/**
 * Organic eligibility vs affiliate/sponsored — separated review lanes.
 * Paid relationships never grant Organic eligibility.
 */

import type {
  CommercialRelationship,
  OrganicEligibility,
  RejectionReasonCode,
  ReviewerStatus,
  SymptomEvidenceReviewRecord,
} from "./types";

export function isPaidCommercialRelationship(
  relationship: CommercialRelationship,
): boolean {
  return (
    relationship === "affiliate" ||
    relationship === "sponsored" ||
    relationship === "booking_fee" ||
    relationship === "lead_fee"
  );
}

export function resolveOrganicEligibility(input: {
  reviewerStatus: ReviewerStatus;
  commercialRelationship: CommercialRelationship;
  rejectionCodes: RejectionReasonCode[];
  isFixture: boolean;
}): OrganicEligibility {
  if (input.rejectionCodes.includes("reviewer_rejected")) {
    return "organic_ineligible_rejected";
  }
  if (
    input.rejectionCodes.includes("stale_beyond_policy") ||
    input.reviewerStatus === "stale"
  ) {
    return "organic_ineligible_stale";
  }
  if (isPaidCommercialRelationship(input.commercialRelationship)) {
    return "organic_ineligible_paid_relationship";
  }
  if (
    input.isFixture ||
    input.rejectionCodes.includes("fixture_cannot_publish") ||
    input.rejectionCodes.includes("source_kind_not_allowed") ||
    input.rejectionCodes.includes("login_automation_forbidden") ||
    input.rejectionCodes.includes("captcha_bypass_forbidden") ||
    input.rejectionCodes.includes("restricted_crawl_forbidden") ||
    input.rejectionCodes.includes("terms_risk_scrape_forbidden") ||
    input.rejectionCodes.includes("paid_api_forbidden") ||
    input.rejectionCodes.includes("manifest_entry_missing")
  ) {
    return "organic_ineligible_policy";
  }
  if (
    input.reviewerStatus !== "approved" ||
    input.rejectionCodes.includes("unverified_must_stay_unpublished") ||
    input.rejectionCodes.includes("medical_claim_unverified")
  ) {
    return "organic_ineligible_unverified";
  }
  return "organic_eligible";
}

/**
 * Publish eligibility for symptom expertise claims.
 * Dry-run always keeps publishAllowed=false; this only marks structural readiness.
 */
export function resolvePublishEligible(input: {
  organicEligibility: OrganicEligibility;
  reviewerStatus: ReviewerStatus;
  isFixture: boolean;
  hardBlocked: boolean;
}): boolean {
  if (input.isFixture) return false;
  if (input.hardBlocked) return false;
  if (input.reviewerStatus !== "approved") return false;
  return input.organicEligibility === "organic_eligible";
}

export function resolveQueueLane(
  record: Pick<
    SymptomEvidenceReviewRecord,
    "organicEligibility" | "reviewerStatus" | "rejectionCodes"
  >,
): SymptomEvidenceReviewRecord["queueLane"] {
  if (
    record.reviewerStatus === "rejected" ||
    record.rejectionCodes.includes("reviewer_rejected") ||
    record.organicEligibility === "organic_ineligible_rejected"
  ) {
    return "rejected";
  }
  if (record.organicEligibility === "organic_ineligible_policy") {
    return "rejected";
  }
  if (record.organicEligibility === "organic_ineligible_paid_relationship") {
    return "paid_relationship_review";
  }
  if (record.organicEligibility === "organic_eligible") {
    return "organic_review";
  }
  if (
    record.reviewerStatus === "pending_review" ||
    record.reviewerStatus === "needs_more_evidence" ||
    record.organicEligibility === "organic_ineligible_unverified" ||
    record.organicEligibility === "organic_ineligible_stale"
  ) {
    return "pending";
  }
  return "pending";
}

/**
 * Assert paid commercial fields never flip organic score — structural check.
 * Organic eligibility is derived only from verification + relationship lane.
 */
export function paidRelationshipDoesNotGrantOrganic(input: {
  commercialRelationship: CommercialRelationship;
  organicEligibility: OrganicEligibility;
}): boolean {
  if (!isPaidCommercialRelationship(input.commercialRelationship)) {
    return true;
  }
  return input.organicEligibility !== "organic_eligible";
}
