/**
 * P2-T04 — Real data onboarding readiness harness.
 *
 * Prepares safe onboarding without inventing live catalog data:
 * source manifests · field provenance · official-source priority ·
 * stale/refresh rules · review checklists · import templates ·
 * dry-run validation · rejection reasons for KR products + clinics.
 *
 * No paid API, authenticated scrape, CAPTCHA bypass, or Production writes.
 */

import { evaluateEligibility, summarizeEligibility } from "./eligibility";
import { allOnboardingFixtures } from "./fixtures";
import { assertImportTemplateIntegrity, IMPORT_TEMPLATES } from "./importTemplates";
import { REJECTION_REASON_CATALOG } from "./rejectionReasons";
import { REVIEW_CHECKLISTS } from "./reviewChecklists";
import {
  assertSourceManifestIntegrity,
  CANONICAL_SOURCE_MANIFEST,
  pickPreferredSource,
} from "./sourceManifest";
import { STALE_REFRESH_RULES } from "./staleRefreshRules";
import type {
  OnboardingCheckResult,
  RealDataOnboardingReport,
} from "./types";
import { REAL_DATA_ONBOARDING_TASK_ID } from "./types";
import { isDryRunStructurallyOk } from "./dryRunValidation";

export { REAL_DATA_ONBOARDING_TASK_ID };

function check(
  id: string,
  lane: OnboardingCheckResult["lane"],
  titleKo: string,
  pass: boolean,
  detailKo: string,
  warn = false,
): OnboardingCheckResult {
  return {
    id,
    lane,
    titleKo,
    status: pass ? "pass" : warn ? "warn" : "fail",
    detailKo,
  };
}

export function assertRealDataOnboardingContractIntegrity(input: {
  fileExists: (rel: string) => boolean;
}): string[] {
  const errors: string[] = [];
  const required = [
    "src/lib/onboarding/realDataOnboarding/types.ts",
    "src/lib/onboarding/realDataOnboarding/sourceManifest.ts",
    "src/lib/onboarding/realDataOnboarding/fieldProvenance.ts",
    "src/lib/onboarding/realDataOnboarding/staleRefreshRules.ts",
    "src/lib/onboarding/realDataOnboarding/reviewChecklists.ts",
    "src/lib/onboarding/realDataOnboarding/importTemplates.ts",
    "src/lib/onboarding/realDataOnboarding/dryRunValidation.ts",
    "src/lib/onboarding/realDataOnboarding/rejectionReasons.ts",
    "src/lib/onboarding/realDataOnboarding/eligibility.ts",
    "src/lib/onboarding/realDataOnboarding/fixtures.ts",
    "src/lib/onboarding/realDataOnboarding/index.ts",
    "docs/prelaunch/P2-T04_REAL_DATA_ONBOARDING.md",
    "scripts/real-data-onboarding-selftest.ts",
  ];
  for (const rel of required) {
    if (!input.fileExists(rel)) errors.push(`missing:${rel}`);
  }
  errors.push(...assertSourceManifestIntegrity());
  errors.push(...assertImportTemplateIntegrity());
  if (CANONICAL_SOURCE_MANIFEST.length < 8) {
    errors.push("source_manifest_too_small");
  }
  if (REVIEW_CHECKLISTS.length < 10) errors.push("checklist_too_small");
  if (STALE_REFRESH_RULES.length < 5) errors.push("stale_rules_too_small");
  if (REJECTION_REASON_CATALOG.length < 15) {
    errors.push("rejection_catalog_too_small");
  }
  if (IMPORT_TEMPLATES.length !== 2) errors.push("expected_two_templates");
  return errors;
}

export function runRealDataOnboardingHarness(
  now = new Date(),
): RealDataOnboardingReport {
  const rows = allOnboardingFixtures();
  const dryRunResults = rows.map(evaluateEligibility);
  const summaryElig = summarizeEligibility(dryRunResults);

  const productResults = dryRunResults.filter((r) => r.lane === "korean_product");
  const clinicResults = dryRunResults.filter(
    (r) => r.lane === "clinic_professional",
  );

  const preferred = pickPreferredSource([
    "marketplace_listing",
    "official_product_page",
    "fixture_offline",
  ]);

  const checks: OnboardingCheckResult[] = [
    check(
      "contract_manifest",
      "cross_cutting",
      "출처 매니페스트·템플릿 무결성",
      assertSourceManifestIntegrity().length === 0 &&
        assertImportTemplateIntegrity().length === 0,
      `manifest=${CANONICAL_SOURCE_MANIFEST.length} templates=${IMPORT_TEMPLATES.length}`,
    ),
    check(
      "official_priority",
      "cross_cutting",
      "공식 출처 우선순위",
      preferred === "official_product_page",
      `pickPreferredSource → ${preferred}`,
    ),
    check(
      "product_fixture_non_public",
      "korean_product",
      "제품 fixture 비공개",
      productResults.some(
        (r) =>
          r.rowId === "fx-kr-product-complete" &&
          r.eligibility === "fixture_non_public" &&
          r.publicVisible === false,
      ),
      "fixture_cannot_publish · publicVisible=false",
    ),
    check(
      "product_official_eligible",
      "korean_product",
      "공식 제품 dry-run 스테이징 검수 적격",
      productResults.some(
        (r) =>
          r.rowId === "dry-kr-product-official" &&
          r.eligibility === "eligible_for_staging_review",
      ),
      "official_product_page · 전성분·provenance 완비",
    ),
    check(
      "product_marketplace_reject",
      "korean_product",
      "마켓 단독 출처 거절",
      productResults.some(
        (r) =>
          r.rowId === "dry-kr-marketplace-only" &&
          r.eligibility === "rejected" &&
          r.rejectionReasons.includes("official_source_not_priority"),
      ),
      "marketplace_listing 거절",
    ),
    check(
      "product_paid_api_block",
      "korean_product",
      "유료 API 차단",
      productResults.some(
        (r) =>
          r.rowId === "dry-kr-paid-api-blocked" &&
          (r.eligibility === "blocked_policy" ||
            r.rejectionReasons.includes("paid_api_forbidden")),
      ),
      "blocked_paid_api",
    ),
    check(
      "product_invented_reject",
      "korean_product",
      "발명 가격 거절",
      productResults.some(
        (r) =>
          r.rowId === "dry-kr-invented-price" &&
          r.rejectionReasons.includes("invented_data_forbidden"),
      ),
      "price/stock 미발명",
    ),
    check(
      "clinic_fixture_non_public",
      "clinic_professional",
      "병원 fixture 비공개",
      clinicResults.some(
        (r) =>
          r.rowId === "fx-clinic-complete" &&
          r.eligibility === "fixture_non_public" &&
          r.publicVisible === false,
      ),
      "clinic_fixture_cannot_publish",
    ),
    check(
      "clinic_official_eligible",
      "clinic_professional",
      "공식 병원 dry-run 스테이징 검수 적격",
      clinicResults.some(
        (r) =>
          r.rowId === "dry-clinic-official" &&
          r.eligibility === "eligible_for_staging_review",
      ),
      "clinic_official_site · 필드 완비",
    ),
    check(
      "clinic_stale_block",
      "clinic_professional",
      "만료 근거 게시 차단",
      clinicResults.some(
        (r) =>
          r.rowId === "dry-clinic-stale" &&
          (r.rejectionReasons.includes("clinic_evidence_stale") ||
            r.rejectionReasons.includes("stale_beyond_refresh_window")),
      ),
      "evidence > 180일",
    ),
    check(
      "clinic_partner_disclosure",
      "clinic_professional",
      "제휴 고지 누락 거절",
      clinicResults.some(
        (r) =>
          r.rowId === "dry-clinic-partner-no-disclosure" &&
          r.rejectionReasons.includes("clinic_partnership_disclosure_missing"),
      ),
      "is_partner + disclosure 필수",
    ),
    check(
      "clinic_captcha_block",
      "clinic_professional",
      "CAPTCHA 우회 차단",
      clinicResults.some(
        (r) =>
          r.rowId === "dry-clinic-captcha-blocked" &&
          (r.eligibility === "blocked_policy" ||
            r.rejectionReasons.includes("captcha_bypass_forbidden")),
      ),
      "blocked_captcha",
    ),
    check(
      "dry_run_no_writes",
      "cross_cutting",
      "dry-run 쓰기 없음",
      dryRunResults.every(
        (r) =>
          isDryRunStructurallyOk(r) &&
          r.writeAttempted === false &&
          r.publicVisible === false,
      ),
      "writeAttempted=false · publicVisible=false",
    ),
    check(
      "no_public_from_summary",
      "cross_cutting",
      "적격 요약에 공개 0",
      summaryElig.anyPublicVisible === false,
      `fixtureNonPublic=${summaryElig.fixtureNonPublic} eligible=${summaryElig.eligibleForStagingReview}`,
    ),
  ];

  const pass = checks.filter((c) => c.status === "pass").length;
  const fail = checks.filter((c) => c.status === "fail").length;
  const warn = checks.filter((c) => c.status === "warn").length;

  return {
    taskId: REAL_DATA_ONBOARDING_TASK_ID,
    generatedAt: now.toISOString(),
    mode: "local_fixture_dry_run",
    ok: fail === 0,
    writeAttempted: false,
    productionWriteAttempted: false,
    paidApiUsed: false,
    captchaBypassAttempted: false,
    authenticatedScrapeAttempted: false,
    product: {
      validated: productResults.length,
      eligibleForStagingReview: productResults.filter(
        (r) => r.eligibility === "eligible_for_staging_review",
      ).length,
      rejected: productResults.filter(
        (r) =>
          r.eligibility === "rejected" || r.eligibility === "blocked_policy",
      ).length,
      fixtureNonPublic: productResults.filter(
        (r) => r.eligibility === "fixture_non_public",
      ).length,
    },
    clinic: {
      validated: clinicResults.length,
      eligibleForStagingReview: clinicResults.filter(
        (r) => r.eligibility === "eligible_for_staging_review",
      ).length,
      rejected: clinicResults.filter(
        (r) =>
          r.eligibility === "rejected" || r.eligibility === "blocked_policy",
      ).length,
      fixtureNonPublic: clinicResults.filter(
        (r) => r.eligibility === "fixture_non_public",
      ).length,
    },
    checks,
    dryRunResults,
    summary: { pass, fail, warn },
  };
}

export function formatRealDataOnboardingMarkdown(
  report: RealDataOnboardingReport,
): string {
  const lines = [
    `# ${report.taskId} Real data onboarding readiness`,
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- ok: ${report.ok}`,
    `- writeAttempted: ${report.writeAttempted}`,
    `- paidApiUsed: ${report.paidApiUsed}`,
    `- captchaBypassAttempted: ${report.captchaBypassAttempted}`,
    "",
    `## Product · validated ${report.product.validated} · eligible ${report.product.eligibleForStagingReview} · rejected ${report.product.rejected} · fixture ${report.product.fixtureNonPublic}`,
    `## Clinic · validated ${report.clinic.validated} · eligible ${report.clinic.eligibleForStagingReview} · rejected ${report.clinic.rejected} · fixture ${report.clinic.fixtureNonPublic}`,
    "",
    "## Checks",
  ];
  for (const c of report.checks) {
    lines.push(`- [${c.status}] ${c.id}: ${c.titleKo} — ${c.detailKo}`);
  }
  return `${lines.join("\n")}\n`;
}
