/**
 * P3-T05 — map upstream fixture results into unified Staging import rows.
 * Never invents live catalog rows. Never marks import executed.
 */

import type {
  StagingCommercialLane,
  StagingImportRow,
  StagingPublishableGateStatus,
  StagingRefreshStatus,
  StagingRejectionCode,
  StagingImportReviewState,
} from "./types";

export type UpstreamProductLike = {
  sourceTaskId: string;
  sourceRecordId: string;
  displayName: string;
  isFixture: boolean;
  provenanceComplete: boolean;
  provenanceNotesKo?: string[];
  isDuplicate?: boolean;
  duplicateOf?: string | null;
  rejected?: boolean;
  rejectionCodes?: string[];
  refreshStatus?: StagingRefreshStatus;
  commercialLane?: StagingCommercialLane;
  adminApproved?: boolean;
  hasOfficialEvidence?: boolean;
  structurallyPublishableUpstream?: boolean;
};

export type UpstreamClinicLike = UpstreamProductLike;

function uniqueReasons(
  reasons: StagingRejectionCode[],
): StagingRejectionCode[] {
  return [...new Set(reasons)];
}

function mapPublishableGate(input: {
  isFixture: boolean;
  rejected: boolean;
  isDuplicate: boolean;
  provenanceComplete: boolean;
  refreshStatus: StagingRefreshStatus;
  adminApproved: boolean;
  hasOfficialEvidence: boolean;
  structurallyPublishableUpstream: boolean;
}): {
  gate: StagingPublishableGateStatus;
  reasons: StagingRejectionCode[];
  reviewState: StagingImportReviewState;
  structurallyStagingImportEligible: boolean;
} {
  const reasons: StagingRejectionCode[] = [];

  if (input.isFixture) {
    reasons.push("fixture_cannot_import");
  }
  if (input.rejected) {
    reasons.push("rejected_upstream");
  }
  if (input.isDuplicate) {
    reasons.push("duplicate_unresolved");
  }
  if (!input.provenanceComplete) {
    reasons.push("provenance_incomplete");
  }
  if (input.refreshStatus === "stale") {
    reasons.push("refresh_stale");
  } else if (input.refreshStatus === "due" || input.refreshStatus === "needs_refresh") {
    reasons.push("refresh_due");
  }
  if (!input.hasOfficialEvidence) {
    reasons.push("official_evidence_missing");
  }
  if (!input.adminApproved) {
    reasons.push("admin_approval_missing");
  }

  // Fixture / dry-run packages are never public.
  if (input.isFixture || input.rejected || input.isDuplicate) {
    return {
      gate: "public_forbidden",
      reasons: uniqueReasons([...reasons, "publishable_gate_blocked"]),
      reviewState: input.isDuplicate
        ? "duplicate"
        : input.rejected
          ? "rejected"
          : "blocked",
      structurallyStagingImportEligible: false,
    };
  }

  if (reasons.length > 0) {
    const eligible =
      reasons.every(
        (r) =>
          r === "admin_approval_missing" ||
          r === "refresh_due" ||
          r === "official_evidence_missing",
      ) === false
        ? false
        : input.provenanceComplete && !input.rejected && !input.isDuplicate;

    if (
      input.provenanceComplete &&
      !input.rejected &&
      !input.isDuplicate &&
      input.refreshStatus !== "stale" &&
      (input.adminApproved || input.structurallyPublishableUpstream)
    ) {
      // Still blocked from public; structural staging eligibility only when
      // admin approved + evidence + not fixture (already handled).
      if (
        input.adminApproved &&
        input.hasOfficialEvidence &&
        input.refreshStatus === "fresh"
      ) {
        return {
          gate: "structurally_publishable",
          reasons: [],
          reviewState: "structurally_publishable",
          structurallyStagingImportEligible: true,
        };
      }
      return {
        gate: "eligible_for_staging_review",
        reasons: uniqueReasons(reasons),
        reviewState: input.adminApproved ? "admin_reviewed" : "needs_review",
        structurallyStagingImportEligible: false,
      };
    }

    return {
      gate: "blocked",
      reasons: uniqueReasons([...reasons, "publishable_gate_blocked"]),
      reviewState: "blocked",
      structurallyStagingImportEligible: eligible && false,
    };
  }

  if (
    input.adminApproved &&
    input.hasOfficialEvidence &&
    input.provenanceComplete &&
    input.refreshStatus === "fresh"
  ) {
    return {
      gate: "structurally_publishable",
      reasons: [],
      reviewState: "structurally_publishable",
      structurallyStagingImportEligible: true,
    };
  }

  return {
    gate: "eligible_for_staging_review",
    reasons: [],
    reviewState: "needs_review",
    structurallyStagingImportEligible: false,
  };
}

export function mapUpstreamToStagingRow(
  lane: "product" | "clinic",
  input: UpstreamProductLike,
): StagingImportRow {
  const refreshStatus = input.refreshStatus ?? "unknown";
  const commercialLane = input.commercialLane ?? "none";
  const isDuplicate = Boolean(input.isDuplicate);
  const rejected = Boolean(input.rejected);
  const decision = mapPublishableGate({
    isFixture: input.isFixture,
    rejected,
    isDuplicate,
    provenanceComplete: input.provenanceComplete,
    refreshStatus,
    adminApproved: Boolean(input.adminApproved),
    hasOfficialEvidence: input.hasOfficialEvidence !== false,
    structurallyPublishableUpstream: Boolean(
      input.structurallyPublishableUpstream,
    ),
  });

  const mappedFromUpstream: StagingRejectionCode[] = [];
  for (const code of input.rejectionCodes ?? []) {
    if (code === "fixture_cannot_publish" || code === "fixture_cannot_import") {
      mappedFromUpstream.push("fixture_cannot_import");
    } else if (code === "duplicate_merged" || code === "duplicate_unresolved") {
      mappedFromUpstream.push("duplicate_unresolved");
    } else if (code.includes("stale")) {
      mappedFromUpstream.push("refresh_stale");
    } else if (code.includes("provenance")) {
      mappedFromUpstream.push("provenance_incomplete");
    } else if (code.includes("admin")) {
      mappedFromUpstream.push("admin_approval_missing");
    } else if (code.includes("evidence") || code.includes("official")) {
      mappedFromUpstream.push("official_evidence_missing");
    }
  }
  const rejectionReasons = uniqueReasons([
    ...decision.reasons,
    ...mappedFromUpstream,
  ]);

  let reviewState = decision.reviewState;
  if (isDuplicate) reviewState = "duplicate";
  else if (rejected) reviewState = "rejected";
  else if (
    decision.structurallyStagingImportEligible &&
    !input.isFixture
  ) {
    reviewState = "staging_import_eligible";
  }

  return {
    importId: `${lane}:${input.sourceTaskId}:${input.sourceRecordId}`,
    lane,
    sourceTaskId: input.sourceTaskId,
    sourceRecordId: input.sourceRecordId,
    displayName: input.displayName,
    reviewState,
    provenanceComplete: input.provenanceComplete,
    provenanceNotesKo: input.provenanceNotesKo ?? [],
    isDuplicate,
    duplicateOf: input.duplicateOf ?? null,
    rejectionReasons,
    refreshStatus,
    commercialLane,
    publishableGate: decision.gate,
    structurallyStagingImportEligible:
      decision.structurallyStagingImportEligible && !input.isFixture,
    isFixture: input.isFixture,
    publicVisible: false,
    stagingImportExecuted: false,
  };
}
