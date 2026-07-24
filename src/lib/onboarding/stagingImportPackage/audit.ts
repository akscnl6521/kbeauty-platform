/**
 * P3-T05 audit + section + CSV builders.
 */

import type {
  StagingImportAuditArtifact,
  StagingImportBundleSection,
  StagingImportMode,
  StagingImportRow,
  StagingImportTotals,
  StagingCommercialIndependenceProof,
} from "./types";
import { STAGING_IMPORT_PACKAGE_TASK_ID } from "./types";

export function emptyTotals(): StagingImportTotals {
  return {
    productRows: 0,
    clinicRows: 0,
    provenanceComplete: 0,
    provenanceIncomplete: 0,
    needsReview: 0,
    adminReviewed: 0,
    duplicates: 0,
    rejected: 0,
    refreshFresh: 0,
    refreshDue: 0,
    refreshStale: 0,
    commercialOrganic: 0,
    commercialPaid: 0,
    gateBlocked: 0,
    gateEligibleForStagingReview: 0,
    gateStructurallyPublishable: 0,
    structurallyStagingImportEligible: 0,
    fixtureCount: 0,
    publicVisible: 0,
    stagingImportExecuted: 0,
  };
}

export function accumulateTotals(
  rows: readonly StagingImportRow[],
): StagingImportTotals {
  const totals = emptyTotals();
  for (const row of rows) {
    if (row.lane === "product") totals.productRows += 1;
    else totals.clinicRows += 1;

    if (row.provenanceComplete) totals.provenanceComplete += 1;
    else totals.provenanceIncomplete += 1;

    if (row.reviewState === "needs_review") totals.needsReview += 1;
    if (row.reviewState === "admin_reviewed") totals.adminReviewed += 1;
    if (row.isDuplicate || row.reviewState === "duplicate") {
      totals.duplicates += 1;
    }
    if (row.reviewState === "rejected") totals.rejected += 1;

    if (row.refreshStatus === "fresh") totals.refreshFresh += 1;
    if (row.refreshStatus === "due" || row.refreshStatus === "needs_refresh") {
      totals.refreshDue += 1;
    }
    if (row.refreshStatus === "stale") totals.refreshStale += 1;

    if (row.commercialLane === "organic" || row.commercialLane === "none") {
      totals.commercialOrganic += 1;
    }
    if (
      row.commercialLane === "affiliate" ||
      row.commercialLane === "sponsored"
    ) {
      totals.commercialPaid += 1;
    }

    if (row.publishableGate === "blocked") totals.gateBlocked += 1;
    if (row.publishableGate === "eligible_for_staging_review") {
      totals.gateEligibleForStagingReview += 1;
    }
    if (row.publishableGate === "structurally_publishable") {
      totals.gateStructurallyPublishable += 1;
    }
    if (row.publishableGate === "public_forbidden") {
      totals.gateBlocked += 1;
    }

    if (row.structurallyStagingImportEligible) {
      totals.structurallyStagingImportEligible += 1;
    }
    if (row.isFixture) totals.fixtureCount += 1;
  }
  return totals;
}

export function buildBundleSections(
  rows: readonly StagingImportRow[],
  commercialIndependence: StagingCommercialIndependenceProof,
): StagingImportBundleSection[] {
  const products = rows.filter((r) => r.lane === "product");
  const clinics = rows.filter((r) => r.lane === "clinic");
  const provenanceIncomplete = rows.filter((r) => !r.provenanceComplete);
  const reviewNeeds = rows.filter(
    (r) =>
      r.reviewState === "needs_review" || r.reviewState === "admin_reviewed",
  );
  const duplicates = rows.filter((r) => r.isDuplicate);
  const rejected = rows.filter(
    (r) => r.rejectionReasons.length > 0 || r.reviewState === "rejected",
  );
  const refreshAttention = rows.filter(
    (r) =>
      r.refreshStatus === "due" ||
      r.refreshStatus === "stale" ||
      r.refreshStatus === "needs_refresh",
  );
  const paid = rows.filter(
    (r) =>
      r.commercialLane === "affiliate" || r.commercialLane === "sponsored",
  );
  const gates = rows.filter(
    (r) =>
      r.publishableGate === "structurally_publishable" ||
      r.publishableGate === "eligible_for_staging_review" ||
      r.publishableGate === "blocked" ||
      r.publishableGate === "public_forbidden",
  );

  return [
    {
      id: "product_candidates",
      titleKo: "제품 후보",
      purposeKo: "P3-T01/T02·P2-T04 제품 후보를 통합 Staging 검수 행으로 묶는다.",
      itemCount: products.length,
      notesKo: [`제품 행 ${products.length}건 · fixture 비공개`],
    },
    {
      id: "clinic_candidates",
      titleKo: "병원 후보",
      purposeKo: "T07-02~05·P3-T03 병원 후보를 통합 Staging 검수 행으로 묶는다.",
      itemCount: clinics.length,
      notesKo: [`병원 행 ${clinics.length}건 · fixture 비공개`],
    },
    {
      id: "provenance",
      titleKo: "Provenance",
      purposeKo: "필드/출처 완전성 누락을 한눈에 본다.",
      itemCount: provenanceIncomplete.length,
      notesKo: [
        `완전 ${rows.length - provenanceIncomplete.length} · 불완전 ${provenanceIncomplete.length}`,
      ],
    },
    {
      id: "review_states",
      titleKo: "검수 상태",
      purposeKo: "needs_review / admin_reviewed / blocked 등 상태를 집계한다.",
      itemCount: reviewNeeds.length,
      notesKo: [
        `needs_review·admin_reviewed ${reviewNeeds.length}건 (전체 ${rows.length})`,
      ],
    },
    {
      id: "duplicates",
      titleKo: "중복",
      purposeKo: "duplicateOf 링크와 미해소 중복을 분리한다.",
      itemCount: duplicates.length,
      notesKo: [`중복 ${duplicates.length}건 · import 제외`],
    },
    {
      id: "rejection_reasons",
      titleKo: "거절 사유",
      purposeKo: "통합 거절 코드로 사람 검수 우선순위를 잡는다.",
      itemCount: rejected.length,
      notesKo: [`거절/차단 사유 보유 ${rejected.length}건`],
    },
    {
      id: "refresh_status",
      titleKo: "갱신 상태",
      purposeKo: "fresh / due / stale / needs_refresh를 통합한다.",
      itemCount: refreshAttention.length,
      notesKo: [`갱신 주의 ${refreshAttention.length}건`],
    },
    {
      id: "commercial_separation",
      titleKo: "상업 분리",
      purposeKo: "Organic 정렬·Staging 적격이 유료 레인에 오염되지 않음을 증명한다.",
      itemCount: paid.length,
      notesKo: [
        commercialIndependence.noteKo,
        `organicOrderUnchanged=${commercialIndependence.organicOrderUnchanged}`,
        `stagingEligibilityIgnoresPaidLane=${commercialIndependence.stagingEligibilityIgnoresPaidLane}`,
      ],
    },
    {
      id: "publishable_gates",
      titleKo: "Publishable 게이트",
      purposeKo: "구조적 publishable ≠ 공개/실 import. fixture·미승인은 차단.",
      itemCount: gates.length,
      notesKo: [
        `structurallyStagingImportEligible=${rows.filter((r) => r.structurallyStagingImportEligible).length}`,
        "publicVisible=false · stagingImportExecuted=false",
      ],
    },
    {
      id: "human_review_package",
      titleKo: "사람 검수 패키지",
      purposeKo: "이후 Staging import 1회 승인을 위한 통합 절차 문서.",
      itemCount: 1,
      notesKo: [
        "에이전트는 Staging import 실행·승인 완료를 주장하지 않는다.",
      ],
    },
  ];
}

export function buildCsvSummary(rows: readonly StagingImportRow[]): string {
  const header = [
    "importId",
    "lane",
    "sourceTaskId",
    "displayName",
    "reviewState",
    "provenanceComplete",
    "isDuplicate",
    "refreshStatus",
    "commercialLane",
    "publishableGate",
    "structurallyStagingImportEligible",
    "isFixture",
    "rejectionReasons",
  ].join(",");
  const body = rows.map((r) =>
    [
      r.importId,
      r.lane,
      r.sourceTaskId,
      JSON.stringify(r.displayName),
      r.reviewState,
      r.provenanceComplete,
      r.isDuplicate,
      r.refreshStatus,
      r.commercialLane,
      r.publishableGate,
      r.structurallyStagingImportEligible,
      r.isFixture,
      r.rejectionReasons.join("|"),
    ].join(","),
  );
  return [header, ...body].join("\n");
}

export function buildAuditArtifact(input: {
  mode: StagingImportMode;
  runId: string;
  generatedAt: string;
  rows: StagingImportRow[];
  totals: StagingImportTotals;
  sections: StagingImportBundleSection[];
  commercialIndependence: StagingCommercialIndependenceProof;
  notesKo?: string[];
}): StagingImportAuditArtifact {
  const ok =
    input.commercialIndependence.organicOrderUnchanged &&
    input.commercialIndependence.stagingEligibilityIgnoresPaidLane &&
    input.rows.every((r) => r.publicVisible === false) &&
    input.rows.every((r) => r.stagingImportExecuted === false) &&
    input.rows.every((r) => !(r.isFixture && r.structurallyStagingImportEligible));

  return {
    taskId: STAGING_IMPORT_PACKAGE_TASK_ID,
    generatedAt: input.generatedAt,
    mode: input.mode,
    runId: input.runId,
    ok,
    totals: input.totals,
    sections: input.sections,
    commercialIndependence: input.commercialIndependence,
    sampleRows: input.rows.slice(0, 12).map((r) => ({
      importId: r.importId,
      lane: r.lane,
      reviewState: r.reviewState,
      publishableGate: r.publishableGate,
      rejectionReasons: r.rejectionReasons,
      structurallyStagingImportEligible: r.structurallyStagingImportEligible,
      isFixture: r.isFixture,
    })),
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    stagingImportExecuted: false,
    publishAllowed: false,
    publicVisible: false,
    secretsPresent: false,
    notesKo: input.notesKo ?? [
      "통합 Staging import 패키지 · fixture/dry-run 전용",
      "실 Staging import·Production 쓰기·main 병합 미실행",
    ],
  };
}
