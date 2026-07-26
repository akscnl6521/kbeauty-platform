/**
 * Verified product pool expansion pipeline (P3-T02).
 * Official-manifest + non-public dry-run only.
 * Never publishes · never writes Production/Staging DB.
 */

import { createHash } from "node:crypto";
import {
  buildVerifiedPoolAudit,
  emptyTotals,
  recomputeTotals,
} from "./audit";
import {
  normalizeCategoryFields,
  resolvePoolCategory,
} from "./categoryNormalize";
import { SAFE_ENDPOINT_NOTE } from "./constants";
import { mergeDuplicateCandidates } from "./dedupeMerge";
import {
  evaluateVerifiedPoolGates,
  mapEligibilityFromGate,
} from "./eligibility";
import {
  APPROVED_OFFICIAL_MANIFEST,
  createVerifiedPoolFixtures,
} from "./fixtures";
import { selectPublicTop5 } from "./top5Gate";
import type {
  ApprovedOfficialManifestEntry,
  VerifiedPoolCandidate,
  VerifiedPoolCandidateStatus,
  VerifiedPoolExpansionResult,
  VerifiedPoolMode,
  VerifiedPoolRawRecord,
} from "./types";
import { VERIFIED_PRODUCT_POOL_TASK_ID } from "./types";

function newRunId(nowIso: string): string {
  const stamp = nowIso.replace(/[:.]/g, "-");
  const suffix = createHash("sha256")
    .update(`${stamp}:p3-t02:${Math.random()}`)
    .digest("hex")
    .slice(0, 8);
  return `p3-t02-${stamp.slice(0, 19)}-${suffix}`;
}

function resolveStatus(
  gate: ReturnType<typeof evaluateVerifiedPoolGates>,
): VerifiedPoolCandidateStatus {
  if (gate.rejectionCodes.includes("safety_ineligible")) {
    return "safety_hold";
  }
  if (
    gate.rejectionCodes.includes("category_unsupported") ||
    gate.rejectionCodes.includes("marketplace_only_forbidden") ||
    gate.rejectionCodes.includes("official_manifest_not_approved") ||
    gate.rejectionCodes.includes("invented_field_forbidden") ||
    gate.rejectionCodes.includes("paid_api_forbidden") ||
    gate.rejectionCodes.includes("captcha_or_login_forbidden") ||
    gate.rejectionCodes.includes("brand_or_name_missing")
  ) {
    return "rejected";
  }
  if (
    !gate.sourceVerified ||
    !gate.ingredientsVerified ||
    !gate.imageRightsVerified ||
    !gate.purchaseOfferVerified
  ) {
    return "needs_review";
  }
  if (gate.recommendationReady && !gate.publicTop5Allowed) {
    return "blocked_public_top5";
  }
  if (gate.recommendationReady && gate.publicTop5Allowed) {
    return "recommendation_ready";
  }
  return "needs_review";
}

export function mapRawToPoolCandidate(
  raw: VerifiedPoolRawRecord,
  manifests: ApprovedOfficialManifestEntry[],
): VerifiedPoolCandidate {
  const manifest =
    manifests.find((m) => m.manifestId === raw.manifestId) ?? null;
  const poolCategory = resolvePoolCategory(raw.categoryHint);

  if (!poolCategory) {
    const gate = evaluateVerifiedPoolGates({ raw, manifest });
    const rejectionReasons = [
      ...new Set([...gate.rejectionCodes, "category_unsupported" as const]),
    ];
    return {
      candidateId: raw.recordId,
      status: "rejected",
      poolCategory: "skincare",
      brandName: raw.brandName,
      productNameKo: raw.productNameKo,
      productNameEn: raw.productNameEn,
      volumeLabel: raw.volumeLabel,
      fullIngredients: raw.fullIngredients,
      officialSourceUrl: raw.officialSourceUrl,
      sourceKind: raw.sourceKind,
      sourceVerification: raw.sourceVerification,
      ingredientsVerification: raw.ingredientsVerification,
      imageRights: raw.imageRights,
      offerVerification: raw.offerVerification,
      purchaseUrl: raw.purchaseUrl,
      normalized: {
        poolCategory: "skincare",
        canonicalCategory: raw.categoryHint ?? "unsupported",
        brandNormalized: null,
        productNameNormalized: null,
        volumeNormalized: null,
        shadeOrColor: null,
        finish: null,
        scalpOrHairHint: null,
        bodyAreaHint: null,
        eyeOrLipHint: null,
        makeupFamily: null,
        rawCategoryHint: raw.categoryHint,
      },
      eligibility: "insufficient_data",
      gate: {
        ...gate,
        recommendationReady: false,
        publicTop5Allowed: false,
        rejectionCodes: rejectionReasons,
      },
      rejectionReasons,
      reviewReasons: rejectionReasons,
      duplicateOf: null,
      mergedFromIds: [],
      isFixture: raw.isFixture,
      isDryRunRecord: raw.isDryRunRecord,
      manifestApproved: Boolean(manifest?.approved),
      safetyFlags: raw.safetyFlags ?? [],
      publishAllowed: false,
      publicVisible: false,
      publicTop5Allowed: false,
    };
  }

  const gate = evaluateVerifiedPoolGates({ raw, manifest });
  const normalized = normalizeCategoryFields(raw, poolCategory);
  const eligibility = mapEligibilityFromGate(gate);
  const status = resolveStatus(gate);
  const publicTop5Allowed = gate.publicTop5Allowed === true;

  return {
    candidateId: raw.recordId,
    status,
    poolCategory,
    brandName: raw.brandName,
    productNameKo: raw.productNameKo,
    productNameEn: raw.productNameEn,
    volumeLabel: raw.volumeLabel,
    fullIngredients: raw.fullIngredients,
    officialSourceUrl: raw.officialSourceUrl,
    sourceKind: raw.sourceKind,
    sourceVerification: raw.sourceVerification,
    ingredientsVerification: raw.ingredientsVerification,
    imageRights: raw.imageRights,
    offerVerification: raw.offerVerification,
    purchaseUrl: raw.purchaseUrl,
    normalized,
    eligibility,
    gate,
    rejectionReasons: gate.rejectionCodes,
    reviewReasons: gate.rejectionCodes,
    duplicateOf: null,
    mergedFromIds: [],
    isFixture: raw.isFixture,
    isDryRunRecord: raw.isDryRunRecord,
    manifestApproved: Boolean(manifest?.approved),
    safetyFlags: raw.safetyFlags ?? [],
    publishAllowed: false,
    publicVisible: false,
    publicTop5Allowed,
  };
}

export type RunVerifiedPoolExpansionInput = {
  mode?: VerifiedPoolMode;
  records?: VerifiedPoolRawRecord[];
  manifests?: ApprovedOfficialManifestEntry[];
  now?: Date;
  runId?: string;
};

export function runVerifiedPoolExpansion(
  input: RunVerifiedPoolExpansionInput = {},
): VerifiedPoolExpansionResult {
  const mode = input.mode ?? "fixture";
  if (mode === "live_blocked") {
    const generatedAt = (input.now ?? new Date()).toISOString();
    const runId = input.runId ?? newRunId(generatedAt);
    const totals = emptyTotals();
    const audit = buildVerifiedPoolAudit({
      runId,
      mode,
      generatedAt,
      totals,
      candidates: [],
      top5BlockedSample: [],
      notesKo: [
        "live_blocked: 실 live 수집은 사람 승인 전 차단.",
        SAFE_ENDPOINT_NOTE,
      ],
    });
    return {
      taskId: VERIFIED_PRODUCT_POOL_TASK_ID,
      mode,
      runId,
      generatedAt,
      candidates: [],
      publicTop5: [],
      totals,
      audit: { ...audit, ok: true },
      databaseTouched: false,
      writeAttempted: false,
      productionTouched: false,
      publishAllowed: false,
      publicVisible: false,
    };
  }

  const generatedAt = (input.now ?? new Date()).toISOString();
  const runId = input.runId ?? newRunId(generatedAt);
  const manifests = input.manifests ?? APPROVED_OFFICIAL_MANIFEST;
  const records = input.records ?? createVerifiedPoolFixtures();

  let manifestApproved = 0;
  let manifestRejected = 0;
  const mapped: VerifiedPoolCandidate[] = [];

  for (const raw of records) {
    const manifest =
      manifests.find((m) => m.manifestId === raw.manifestId) ?? null;
    if (manifest?.approved) manifestApproved += 1;
    else manifestRejected += 1;
    mapped.push(mapRawToPoolCandidate(raw, manifests));
  }

  const { unique, mergedAway } = mergeDuplicateCandidates(mapped);
  const candidates = [...unique, ...mergedAway];

  const totals = recomputeTotals(candidates, {
    rawSeen: records.length,
    manifestApproved,
    manifestRejected,
  });

  const { selected: publicTop5, blocked } = selectPublicTop5(candidates);

  // In fixture/dry_run modes, public Top 5 must stay empty (honesty).
  const enforcedTop5 =
    mode === "fixture" || mode === "dry_run" ? [] : publicTop5;

  const audit = buildVerifiedPoolAudit({
    runId,
    mode,
    generatedAt,
    totals: {
      ...totals,
      publicTop5Eligible: enforcedTop5.length,
    },
    candidates,
    top5BlockedSample: blocked,
  });

  return {
    taskId: VERIFIED_PRODUCT_POOL_TASK_ID,
    mode,
    runId,
    generatedAt,
    candidates,
    publicTop5: enforcedTop5,
    totals: {
      ...totals,
      publicTop5Eligible: enforcedTop5.length,
    },
    audit,
    databaseTouched: false,
    writeAttempted: false,
    productionTouched: false,
    publishAllowed: false,
    publicVisible: false,
  };
}

export function runFixtureVerifiedPoolExpansion(
  input: Omit<RunVerifiedPoolExpansionInput, "mode" | "records"> = {},
): VerifiedPoolExpansionResult {
  return runVerifiedPoolExpansion({
    ...input,
    mode: "fixture",
    records: createVerifiedPoolFixtures(),
  });
}
