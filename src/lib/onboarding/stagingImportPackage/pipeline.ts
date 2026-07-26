/**
 * P3-T05 pipeline — bundle product/clinic upstream into one Staging import package.
 * Fixture / dry-run only. Never writes DB. Never executes Staging import.
 */

import { createHash } from "node:crypto";
import { UPSTREAM_TASK_IDS } from "./constants";
import { proveStagingCommercialIndependence } from "./commercialIndependence";
import {
  accumulateTotals,
  buildAuditArtifact,
  buildBundleSections,
  buildCsvSummary,
} from "./audit";
import {
  FIXTURE_NOW_ISO,
  createFixtureClinicUpstream,
  createFixtureProductUpstream,
} from "./fixtures";
import { buildStagingHumanReviewSteps } from "./humanReview";
import { mapUpstreamToStagingRow } from "./mapRows";
import type {
  StagingImportMode,
  StagingImportPackageResult,
} from "./types";
import { STAGING_IMPORT_PACKAGE_TASK_ID } from "./types";
import type { UpstreamClinicLike, UpstreamProductLike } from "./mapRows";

function newRunId(nowIso: string): string {
  const stamp = nowIso.replace(/[:.]/g, "-");
  const suffix = createHash("sha256")
    .update(`p3-t05:${stamp}`)
    .digest("hex")
    .slice(0, 8);
  return `p3-t05-${stamp.slice(0, 19)}-${suffix}`;
}

export type RunStagingImportPackageInput = {
  mode?: StagingImportMode;
  products?: UpstreamProductLike[];
  clinics?: UpstreamClinicLike[];
  now?: string;
};

/**
 * Non-fixture dry-run structural example — memory-only scenario, not live catalog.
 * Used to prove positive gate path without claiming public/live import.
 */
export function createDryRunStructuralExamples(): {
  products: UpstreamProductLike[];
  clinics: UpstreamClinicLike[];
} {
  return {
    products: [
      {
        sourceTaskId: "P3-T02",
        sourceRecordId: "dryrun-product-ready-001",
        displayName: "dry-run 구조적 제품 후보 (비공개·미게시)",
        isFixture: false,
        provenanceComplete: true,
        provenanceNotesKo: ["dry-run 공식 매니페스트 시나리오"],
        refreshStatus: "fresh",
        commercialLane: "organic",
        adminApproved: true,
        hasOfficialEvidence: true,
        structurallyPublishableUpstream: true,
      },
    ],
    clinics: [
      {
        sourceTaskId: "T07-05",
        sourceRecordId: "dryrun-clinic-ready-001",
        displayName: "dry-run 구조적 병원 후보 (비공개·미게시)",
        isFixture: false,
        provenanceComplete: true,
        provenanceNotesKo: ["dry-run 공식 근거+관리자 승인 시나리오"],
        refreshStatus: "fresh",
        commercialLane: "organic",
        adminApproved: true,
        hasOfficialEvidence: true,
        structurallyPublishableUpstream: true,
      },
    ],
  };
}

export function runStagingImportPackage(
  input: RunStagingImportPackageInput = {},
): StagingImportPackageResult {
  const mode = input.mode ?? "fixture";
  if (mode === "live_blocked") {
    throw new Error(
      "live_blocked: 실 Staging import는 사람 승인 후. 이 파이프라인은 fixture/dry_run만 허용.",
    );
  }

  const generatedAt = input.now ?? new Date().toISOString();
  const runId = newRunId(generatedAt);

  let products = input.products ?? createFixtureProductUpstream();
  let clinics = input.clinics ?? createFixtureClinicUpstream();

  if (mode === "dry_run" && !input.products && !input.clinics) {
    const examples = createDryRunStructuralExamples();
    products = [...products, ...examples.products];
    clinics = [...clinics, ...examples.clinics];
  }

  const rows = [
    ...products.map((p) => mapUpstreamToStagingRow("product", p)),
    ...clinics.map((c) => mapUpstreamToStagingRow("clinic", c)),
  ];

  // Paid commercial lanes must never become structurally import-eligible.
  for (const row of rows) {
    if (
      (row.commercialLane === "affiliate" ||
        row.commercialLane === "sponsored") &&
      row.structurallyStagingImportEligible
    ) {
      row.structurallyStagingImportEligible = false;
      row.publishableGate = "blocked";
      if (!row.rejectionReasons.includes("commercial_organic_contamination")) {
        row.rejectionReasons = [
          ...row.rejectionReasons,
          "commercial_organic_contamination",
        ];
      }
      if (
        row.reviewState === "staging_import_eligible" ||
        row.reviewState === "structurally_publishable"
      ) {
        row.reviewState = "blocked";
      }
    }
  }

  const commercialIndependence = proveStagingCommercialIndependence(rows);
  const totals = accumulateTotals(rows);
  const sections = buildBundleSections(rows, commercialIndependence);
  const humanReviewSteps = buildStagingHumanReviewSteps();
  const audit = buildAuditArtifact({
    mode,
    runId,
    generatedAt,
    rows,
    totals,
    sections,
    commercialIndependence,
  });
  const csvSummary = buildCsvSummary(rows);

  return {
    taskId: STAGING_IMPORT_PACKAGE_TASK_ID,
    mode,
    runId,
    generatedAt,
    rows,
    totals,
    sections,
    commercialIndependence,
    humanReviewSteps,
    upstreamTaskIds: [...UPSTREAM_TASK_IDS],
    audit,
    csvSummary,
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    stagingImportExecuted: false,
    publishAllowed: false,
    publicVisible: false,
  };
}

export function runFixtureStagingImportPackage(input?: {
  now?: string;
}): StagingImportPackageResult {
  return runStagingImportPackage({
    mode: "fixture",
    now: input?.now ?? FIXTURE_NOW_ISO,
  });
}

export function assertNoStagingImportOrProductionWrite(
  result: StagingImportPackageResult,
): void {
  if (result.stagingImportExecuted !== false) {
    throw new Error("stagingImportExecuted must be false");
  }
  if (result.writeAttempted !== false) {
    throw new Error("writeAttempted must be false");
  }
  if (result.databaseTouched !== false) {
    throw new Error("databaseTouched must be false");
  }
  if (result.productionTouched !== false) {
    throw new Error("productionTouched must be false");
  }
  if (result.publishAllowed !== false) {
    throw new Error("publishAllowed must be false");
  }
  if (result.publicVisible !== false) {
    throw new Error("publicVisible must be false");
  }
  if (result.rows.some((r) => r.isFixture && r.structurallyStagingImportEligible)) {
    throw new Error("fixture rows must not be structurallyStagingImportEligible");
  }
  if (result.rows.some((r) => r.publicVisible !== false)) {
    throw new Error("all rows must keep publicVisible=false");
  }
}
