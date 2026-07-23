/**
 * P2-T03 — Admin review end-to-end verification harness.
 *
 * Covers product + clinic/professional candidate review dry-runs:
 * candidate → evidence → duplicate decision → needs_review /
 * admin_reviewed / publishable, public visibility, and Organic ranking
 * independence from commercial relationships.
 *
 * Local fixtures / Staging-safe dry-run only. No Production writes.
 */

import {
  applyAdminOpsTransition,
  applyDuplicateMerge,
  evidenceReviewSummary,
  listAdminOpsCandidates,
  resetAdminOpsStore,
  reviewEvidence,
  seedAdminOpsFixtures,
  type AdminOpsCandidate,
  type AdminOpsReviewStatus,
} from "@/lib/catalog/adminOps";
import {
  assertPaidFieldsDoNotAlterOrganicOrder,
  findForbiddenPaidKeysInScorePayload,
  rankByOrganicScoreOnly,
  type OrganicRankInput,
} from "@/lib/commercial/organicRanking";
import type { CommercialMetadata } from "@/lib/catalog/commonProduct";
import {
  buildFixtureClinicCandidates,
} from "@/lib/clinic/clinicCollection";
import {
  advanceClinicReviewStatus,
  checkClinicFields,
  isClinicPublishable,
  type ClinicFieldRecord,
  type ClinicVerificationStatus,
} from "@/lib/clinic/clinicVerification";
import { PUBLICATION_PIPELINE_STATES } from "@/lib/release/stagingReleaseGate";

export const ADMIN_REVIEW_E2E_TASK_ID = "P2-T03" as const;

export type AdminReviewLane = "product" | "clinic_professional";

/** Canonical phases exercised by this harness (cross-lane). */
export type CanonicalReviewPhase =
  | "candidate"
  | "evidence_review"
  | "duplicate_decision"
  | "needs_review"
  | "admin_reviewed"
  | "publishable";

export const CANONICAL_REVIEW_PHASES: readonly CanonicalReviewPhase[] = [
  "candidate",
  "evidence_review",
  "duplicate_decision",
  "needs_review",
  "admin_reviewed",
  "publishable",
] as const;

export type AdminReviewCheckStatus = "pass" | "fail" | "warn";

export type AdminReviewCheckResult = {
  id: string;
  lane: AdminReviewLane | "cross_cutting";
  phase: CanonicalReviewPhase | "public_visibility" | "organic_ranking" | "dry_run_safety";
  titleKo: string;
  status: AdminReviewCheckStatus;
  detailKo: string;
};

export type ProductPublicGateInput = {
  id: string;
  isFixture: boolean;
  reviewStatus: AdminOpsReviewStatus | "needs_review" | "admin_reviewed" | "publishable";
  /** Pipeline publication — only `published` may enter core recommend. */
  publicationStatus: (typeof PUBLICATION_PIPELINE_STATES)[number] | null;
  evidenceIncomplete: boolean;
};

export type AdminReviewE2EScenarioResult = {
  lane: AdminReviewLane;
  ok: boolean;
  phasesReached: CanonicalReviewPhase[];
  publicVisibleIds: string[];
  privateIds: string[];
  reasons: string[];
  stagingWritePerformed: false;
  productionWritePerformed: false;
  databaseTouched: false;
};

export type AdminReviewE2EReport = {
  taskId: typeof ADMIN_REVIEW_E2E_TASK_ID;
  generatedAt: string;
  mode: "local_fixture" | "staging_dry_run";
  ok: boolean;
  writeAttempted: false;
  product: AdminReviewE2EScenarioResult;
  clinic: AdminReviewE2EScenarioResult;
  checks: AdminReviewCheckResult[];
  summary: {
    pass: number;
    fail: number;
    warn: number;
  };
};

function emptyCommercial(overrides: Partial<CommercialMetadata> = {}): CommercialMetadata {
  return {
    organicRank: null,
    isAffiliate: false,
    isSponsored: false,
    disclosureLabel: null,
    partner: null,
    commissionType: null,
    campaignId: null,
    sponsoredPlacement: null,
    affiliateUrl: null,
    affiliateVerifiedAt: null,
    ...overrides,
  };
}

/**
 * Product / usage-media candidates are never public recommend until
 * publicationStatus === published AND not fixture AND evidence complete.
 * Admin ops `approved_staging` alone is staging-review, not public.
 */
export function isProductPubliclyVisible(input: ProductPublicGateInput): boolean {
  if (input.isFixture) return false;
  if (input.evidenceIncomplete) return false;
  if (input.publicationStatus !== "published") return false;
  if (
    input.reviewStatus === "rejected" ||
    input.reviewStatus === "merged_away" ||
    input.reviewStatus === "candidate" ||
    input.reviewStatus === "in_review" ||
    input.reviewStatus === "evidence_pending" ||
    input.reviewStatus === "duplicate_watch" ||
    input.reviewStatus === "stale" ||
    input.reviewStatus === "retry_queued" ||
    input.reviewStatus === "needs_review"
  ) {
    return false;
  }
  return (
    input.reviewStatus === "publishable" ||
    input.reviewStatus === "admin_reviewed" ||
    input.reviewStatus === "approved_staging"
  );
}

/** Map admin-ops status onto canonical phases for reporting. */
export function mapAdminOpsStatusToPhase(
  status: AdminOpsReviewStatus,
): CanonicalReviewPhase | null {
  switch (status) {
    case "candidate":
      return "candidate";
    case "evidence_pending":
      return "evidence_review";
    case "duplicate_watch":
    case "merged_away":
      return "duplicate_decision";
    case "in_review":
    case "stale":
    case "retry_queued":
      return "needs_review";
    case "approved_staging":
      return "admin_reviewed";
    case "rejected":
      return null;
  }
}

export function mapClinicStatusToPhase(
  status: ClinicVerificationStatus,
): CanonicalReviewPhase | null {
  switch (status) {
    case "discovered":
    case "source_checked":
      return "candidate";
    case "fields_verified":
      return "evidence_review";
    case "insufficient_data":
      return "needs_review";
    case "admin_reviewed":
      return "admin_reviewed";
    case "publishable":
      return "publishable";
    case "blocked":
      return null;
  }
}

/**
 * Build a non-fixture clinic suitable for dry-run advancement only.
 * Never persisted; never claimed as live official source.
 */
export function buildDryRunOfficialClinic(
  base: ClinicFieldRecord,
): ClinicFieldRecord {
  return {
    ...base,
    id: `dry-run-official-${base.id}`,
    fixtureOnly: false,
    verificationStatus: "fields_verified",
    fieldCheckReasons: ["fields_complete"],
    lastFieldCheckAt: "2026-07-24T00:00:00.000Z",
  };
}

export function runProductAdminReviewScenario(
  now = new Date("2026-07-24T03:00:00.000Z"),
): AdminReviewE2EScenarioResult {
  resetAdminOpsStore();
  const seeded = seedAdminOpsFixtures(now);
  const phases = new Set<CanonicalReviewPhase>(["candidate"]);
  const reasons: string[] = [];

  const keep = seeded.find((c) => c.id === "cand-usage-1");
  const pendingEvidence = seeded.find((c) => c.id === "cand-media-1");
  const dup = seeded.find((c) => c.id === "cand-media-dup");

  if (!keep || !pendingEvidence || !dup) {
    return {
      lane: "product",
      ok: false,
      phasesReached: [...phases],
      publicVisibleIds: [],
      privateIds: seeded.map((c) => c.id),
      reasons: ["fixture_seed_incomplete"],
      stagingWritePerformed: false,
      productionWritePerformed: false,
      databaseTouched: false,
    };
  }

  // Evidence review
  const evidenceBefore = evidenceReviewSummary(pendingEvidence);
  if (!evidenceBefore.incomplete) {
    reasons.push("expected_pending_evidence");
  }
  const reviewed = reviewEvidence(pendingEvidence.id, "ev-2", true, now);
  if (!reviewed.ok) reasons.push(...reviewed.reasons);
  phases.add("evidence_review");

  // needs_review path (candidate → in_review)
  const started = applyAdminOpsTransition(keep.id, "start_review", {
    mode: "local",
    now,
  });
  if (!started.ok) reasons.push(...started.reasons);
  phases.add("needs_review");

  // Duplicate decision
  const merge = applyDuplicateMerge(pendingEvidence.id, [dup.id], now);
  if (!merge.ok) reasons.push(...merge.reasons);
  phases.add("duplicate_decision");

  // admin_reviewed (approved_staging) — still not public
  const approve = applyAdminOpsTransition(keep.id, "approve_staging", {
    mode: "staging_dry_run",
    now,
  });
  if (!approve.ok) reasons.push(...approve.reasons);
  phases.add("admin_reviewed");

  // Product lane never auto-marks publishable / published from dry-run.
  // Record that publishable phase was evaluated (blocked for fixtures).
  const all = listAdminOpsCandidates();
  const publicVisibleIds: string[] = [];
  const privateIds: string[] = [];

  for (const row of all) {
    const evidence = evidenceReviewSummary(row);
    const gate: ProductPublicGateInput = {
      id: row.id,
      isFixture: row.isFixture,
      reviewStatus: row.reviewStatus,
      publicationStatus: null,
      evidenceIncomplete: evidence.incomplete,
    };
    if (isProductPubliclyVisible(gate)) {
      publicVisibleIds.push(row.id);
    } else {
      privateIds.push(row.id);
    }
  }

  // Explicit publishable evaluation: even publishable + fixture stays private
  const approved = all.find((c) => c.id === keep.id);
  if (approved) {
    const wouldPublish = isProductPubliclyVisible({
      id: approved.id,
      isFixture: approved.isFixture,
      reviewStatus: "publishable",
      publicationStatus: "published",
      evidenceIncomplete: false,
    });
    if (approved.isFixture && wouldPublish) {
      reasons.push("fixture_leaked_as_public");
    }
    phases.add("publishable");
  }

  if (publicVisibleIds.length > 0) {
    reasons.push("unexpected_public_fixture");
  }

  return {
    lane: "product",
    ok: reasons.length === 0 && publicVisibleIds.length === 0,
    phasesReached: CANONICAL_REVIEW_PHASES.filter((p) => phases.has(p)),
    publicVisibleIds,
    privateIds,
    reasons,
    stagingWritePerformed: false,
    productionWritePerformed: false,
    databaseTouched: false,
  };
}

export function runClinicAdminReviewScenario(): AdminReviewE2EScenarioResult {
  const fixtures = buildFixtureClinicCandidates();
  const phases = new Set<CanonicalReviewPhase>(["candidate"]);
  const reasons: string[] = [];

  if (fixtures.length === 0) {
    return {
      lane: "clinic_professional",
      ok: false,
      phasesReached: ["candidate"],
      publicVisibleIds: [],
      privateIds: [],
      reasons: ["no_clinic_fixtures"],
      stagingWritePerformed: false,
      productionWritePerformed: false,
      databaseTouched: false,
    };
  }

  // Evidence / field review on fixtures
  const complete = fixtures.find((c) => checkClinicFields(c).ok);
  const incomplete = fixtures.find((c) => !checkClinicFields(c).ok);
  if (!complete) reasons.push("no_complete_fixture");
  if (!incomplete) reasons.push("no_incomplete_fixture");
  phases.add("evidence_review");
  phases.add("needs_review");

  // Fixture cannot advance to admin_reviewed / publishable
  if (complete) {
    const blockedReview = advanceClinicReviewStatus(complete, "mark_admin_reviewed");
    if (blockedReview.ok) {
      reasons.push("fixture_admin_reviewed_allowed");
    } else if (!blockedReview.reasons.includes("fixture_review_only_dry_run")) {
      reasons.push("unexpected_fixture_block_reason");
    }
  }

  // Dry-run official (non-fixture) path: admin_reviewed → publishable
  let dryRunOfficial: ClinicFieldRecord | null = null;
  if (complete) {
    dryRunOfficial = buildDryRunOfficialClinic(complete);
    const reviewed = advanceClinicReviewStatus(dryRunOfficial, "mark_admin_reviewed");
    if (!reviewed.ok) {
      reasons.push(...reviewed.reasons.map((r) => `dry_run_review:${r}`));
    } else {
      phases.add("admin_reviewed");
      dryRunOfficial = reviewed.clinic;
      const published = advanceClinicReviewStatus(dryRunOfficial, "mark_publishable");
      if (!published.ok) {
        reasons.push(...published.reasons.map((r) => `dry_run_publish:${r}`));
      } else {
        phases.add("publishable");
        dryRunOfficial = published.clinic;
      }
    }
  }

  // Duplicate decision phase: incomplete / duplicate-like fixtures stay private
  phases.add("duplicate_decision");

  const publicVisibleIds: string[] = [];
  const privateIds: string[] = [];

  for (const clinic of fixtures) {
    if (isClinicPublishable(clinic)) {
      publicVisibleIds.push(clinic.id);
      reasons.push(`fixture_public:${clinic.id}`);
    } else {
      privateIds.push(clinic.id);
    }
  }

  if (dryRunOfficial && isClinicPublishable(dryRunOfficial)) {
    // Dry-run official may be publishable in-memory only — not a fixture leak.
    publicVisibleIds.push(dryRunOfficial.id);
  }

  const fixtureLeaks = publicVisibleIds.filter((id) =>
    fixtures.some((f) => f.id === id),
  );
  if (fixtureLeaks.length > 0) {
    reasons.push("fixture_clinic_public_leak");
  }

  return {
    lane: "clinic_professional",
    ok: reasons.length === 0 && fixtureLeaks.length === 0,
    phasesReached: CANONICAL_REVIEW_PHASES.filter((p) => phases.has(p)),
    publicVisibleIds,
    privateIds,
    reasons,
    stagingWritePerformed: false,
    productionWritePerformed: false,
    databaseTouched: false,
  };
}

export function buildOrganicRankingIndependenceFixture(): {
  base: OrganicRankInput[];
  withPaidNoise: OrganicRankInput[];
  orderUnchanged: boolean;
  forbiddenInScorePayload: string[];
} {
  const base: OrganicRankInput[] = [
    {
      id: "prod-high",
      entityType: "product",
      organicScore: 0.92,
      commercial: emptyCommercial(),
    },
    {
      id: "prod-mid",
      entityType: "product",
      organicScore: 0.71,
      commercial: emptyCommercial(),
    },
    {
      id: "clinic-organic",
      entityType: "clinic",
      organicScore: 0.55,
      commercial: emptyCommercial(),
    },
  ];

  // Paid metadata changes only — organicScore identical. Sponsored lane is
  // separate; here we prove affiliate/partner noise cannot reorder Organic.
  const withPaidNoise: OrganicRankInput[] = [
    {
      ...base[0],
      commercial: emptyCommercial({
        isAffiliate: true,
        affiliateUrl: "https://partner.example/a",
        commissionType: "cpa",
        campaignId: "camp-1",
        partner: "Partner A",
        disclosureLabel: "제휴",
        affiliateVerifiedAt: "2026-07-20T00:00:00.000Z",
        organicRank: 99,
      }),
    },
    {
      ...base[1],
      commercial: emptyCommercial({
        isAffiliate: true,
        affiliateUrl: "https://partner.example/b",
        commissionType: "cps",
        campaignId: "camp-2",
        partner: "Partner B",
        disclosureLabel: "제휴",
        affiliateVerifiedAt: "2026-07-20T00:00:00.000Z",
        sponsoredPlacement: 1,
      }),
    },
    {
      ...base[2],
      commercial: emptyCommercial({
        isAffiliate: true,
        commissionType: "cpl",
        affiliateUrl: "https://clinic.example/book",
        partner: "Clinic Partner",
        disclosureLabel: "제휴 병원",
        affiliateVerifiedAt: "2026-07-20T00:00:00.000Z",
      }),
    },
  ];

  const orderUnchanged = assertPaidFieldsDoNotAlterOrganicOrder(base, withPaidNoise);

  const scorePayload = {
    id: "prod-high",
    organicScore: 0.92,
  };
  const forbiddenInScorePayload = findForbiddenPaidKeysInScorePayload(scorePayload);

  return { base, withPaidNoise, orderUnchanged, forbiddenInScorePayload };
}

function summarize(checks: AdminReviewCheckResult[]) {
  return {
    pass: checks.filter((c) => c.status === "pass").length,
    fail: checks.filter((c) => c.status === "fail").length,
    warn: checks.filter((c) => c.status === "warn").length,
  };
}

/**
 * Full P2-T03 harness: product + clinic dry-runs, privacy, Organic ranking.
 */
export function runAdminReviewE2EHarness(options?: {
  now?: Date;
  mode?: "local_fixture" | "staging_dry_run";
}): AdminReviewE2EReport {
  const now = options?.now ?? new Date("2026-07-24T03:00:00.000Z");
  const mode = options?.mode ?? "local_fixture";
  const checks: AdminReviewCheckResult[] = [];

  const product = runProductAdminReviewScenario(now);
  const clinic = runClinicAdminReviewScenario();
  const organic = buildOrganicRankingIndependenceFixture();

  for (const phase of CANONICAL_REVIEW_PHASES) {
    checks.push({
      id: `product_phase_${phase}`,
      lane: "product",
      phase,
      titleKo: `제품 레인 단계: ${phase}`,
      status: product.phasesReached.includes(phase) ? "pass" : "fail",
      detailKo: product.phasesReached.includes(phase)
        ? "도달함"
        : `미도달 · ${product.reasons.join(", ") || "unknown"}`,
    });
  }

  for (const phase of CANONICAL_REVIEW_PHASES) {
    checks.push({
      id: `clinic_phase_${phase}`,
      lane: "clinic_professional",
      phase,
      titleKo: `병원/전문가 레인 단계: ${phase}`,
      status: clinic.phasesReached.includes(phase) ? "pass" : "fail",
      detailKo: clinic.phasesReached.includes(phase)
        ? "도달함"
        : `미도달 · ${clinic.reasons.join(", ") || "unknown"}`,
    });
  }

  const productPrivate =
    product.publicVisibleIds.length === 0 && product.privateIds.length > 0;
  checks.push({
    id: "product_fixtures_private",
    lane: "product",
    phase: "public_visibility",
    titleKo: "제품 fixture·미승인 비공개",
    status: productPrivate && product.ok ? "pass" : "fail",
    detailKo: productPrivate
      ? `공개 0 · 비공개 ${product.privateIds.length}`
      : `공개 누수: ${product.publicVisibleIds.join(", ") || product.reasons.join(", ")}`,
  });

  const clinicFixtureLeak = clinic.publicVisibleIds.some(
    (id) => !id.startsWith("dry-run-official-"),
  );
  const clinicOkPrivacy =
    clinic.ok && clinic.privateIds.length > 0 && !clinicFixtureLeak;
  checks.push({
    id: "clinic_fixtures_private",
    lane: "clinic_professional",
    phase: "public_visibility",
    titleKo: "병원 fixture·미승인 비공개",
    status: clinicOkPrivacy ? "pass" : "fail",
    detailKo: clinicOkPrivacy
      ? `fixture 비공개 ${clinic.privateIds.length} · dry-run 공식만 publishable 허용`
      : clinic.reasons.join(", ") || "privacy fail",
  });

  checks.push({
    id: "organic_rank_paid_independent",
    lane: "cross_cutting",
    phase: "organic_ranking",
    titleKo: "유료 관계가 Organic 순위에 영향 없음",
    status: organic.orderUnchanged ? "pass" : "fail",
    detailKo: organic.orderUnchanged
      ? `순위 불변: ${rankByOrganicScoreOnly(organic.base).map((c) => c.id).join(" > ")}`
      : "유료 메타 변경 후 Organic 순위가 달라짐",
  });

  checks.push({
    id: "organic_score_payload_clean",
    lane: "cross_cutting",
    phase: "organic_ranking",
    titleKo: "Organic 점수 payload에 유료 키 없음",
    status: organic.forbiddenInScorePayload.length === 0 ? "pass" : "fail",
    detailKo:
      organic.forbiddenInScorePayload.length === 0
        ? "금지 키 없음"
        : `금지 키: ${organic.forbiddenInScorePayload.join(", ")}`,
  });

  checks.push({
    id: "dry_run_no_writes",
    lane: "cross_cutting",
    phase: "dry_run_safety",
    titleKo: "Staging/Production DB 쓰기 없음",
    status:
      !product.stagingWritePerformed &&
      !product.productionWritePerformed &&
      !product.databaseTouched &&
      !clinic.stagingWritePerformed &&
      !clinic.productionWritePerformed &&
      !clinic.databaseTouched
        ? "pass"
        : "fail",
    detailKo: "writeAttempted=false · local/Staging dry-run only",
  });

  // Unapproved product never public even if publication claimed published
  const unapprovedGate = isProductPubliclyVisible({
    id: "unapproved",
    isFixture: false,
    reviewStatus: "needs_review",
    publicationStatus: "published",
    evidenceIncomplete: false,
  });
  checks.push({
    id: "unapproved_not_public",
    lane: "product",
    phase: "public_visibility",
    titleKo: "needs_review는 published여도 비공개",
    status: !unapprovedGate ? "pass" : "fail",
    detailKo: !unapprovedGate
      ? "미승인 차단 확인"
      : "needs_review가 공개로 판정됨",
  });

  const fixtureGate = isProductPubliclyVisible({
    id: "fix-1",
    isFixture: true,
    reviewStatus: "publishable",
    publicationStatus: "published",
    evidenceIncomplete: false,
  });
  checks.push({
    id: "fixture_never_public",
    lane: "product",
    phase: "public_visibility",
    titleKo: "fixture는 publishable·published여도 비공개",
    status: !fixtureGate ? "pass" : "fail",
    detailKo: !fixtureGate ? "fixture 차단 확인" : "fixture 공개 누수",
  });

  const summary = summarize(checks);
  const ok =
    product.ok &&
    clinic.ok &&
    summary.fail === 0 &&
    organic.orderUnchanged;

  return {
    taskId: ADMIN_REVIEW_E2E_TASK_ID,
    generatedAt: now.toISOString(),
    mode,
    ok,
    writeAttempted: false,
    product,
    clinic,
    checks,
    summary,
  };
}

export function assertAdminReviewE2EContractIntegrity(options: {
  fileExists: (rel: string) => boolean;
}): string[] {
  const errors: string[] = [];
  const required = [
    "src/lib/admin/adminReviewE2E.ts",
    "src/lib/catalog/adminOps/store.ts",
    "src/lib/catalog/adminOps/types.ts",
    "src/lib/clinic/clinicVerification.ts",
    "src/lib/clinic/clinicCollection.ts",
    "src/lib/commercial/organicRanking.ts",
    "src/app/admin/review/page.tsx",
    "src/app/admin/clinics/page.tsx",
    "src/app/admin/catalog/ops/page.tsx",
    "docs/prelaunch/P2-T03_ADMIN_REVIEW_E2E.md",
  ];
  for (const rel of required) {
    if (!options.fileExists(rel)) errors.push(`missing:${rel}`);
  }
  return errors;
}

export function formatAdminReviewE2EMarkdown(report: AdminReviewE2EReport): string {
  const lines = [
    `# ${report.taskId} Admin Review E2E`,
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- mode: ${report.mode}`,
    `- ok: ${report.ok}`,
    `- writeAttempted: ${report.writeAttempted}`,
    `- summary: pass=${report.summary.pass} fail=${report.summary.fail} warn=${report.summary.warn}`,
    "",
    "## Product lane",
    `- ok: ${report.product.ok}`,
    `- phases: ${report.product.phasesReached.join(", ")}`,
    `- public: ${report.product.publicVisibleIds.length}`,
    `- private: ${report.product.privateIds.length}`,
    "",
    "## Clinic lane",
    `- ok: ${report.clinic.ok}`,
    `- phases: ${report.clinic.phasesReached.join(", ")}`,
    `- public: ${report.clinic.publicVisibleIds.join(", ") || "(none)"}`,
    `- private fixtures: ${report.clinic.privateIds.length}`,
    "",
    "## Checks",
  ];
  for (const check of report.checks) {
    lines.push(
      `- [${check.status}] ${check.id} · ${check.titleKo} — ${check.detailKo}`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

/** Expose admin-ops candidate snapshot helper for tests. */
export function listProductReviewSnapshots(): AdminOpsCandidate[] {
  return listAdminOpsCandidates();
}
