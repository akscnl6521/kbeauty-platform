/**
 * P2-T04 — Real data onboarding readiness selftest.
 * Local fixtures / dry-run only. No DB writes, paid APIs, or CAPTCHA bypass.
 * Does not claim live official KR products or publishable clinics.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  REAL_DATA_ONBOARDING_TASK_ID,
  assertRealDataOnboardingContractIntegrity,
  compareSourcePriority,
  dryRunMarketplaceOnlyProduct,
  dryRunOfficialClinicReady,
  dryRunOfficialKoreanProductReady,
  evaluateEligibility,
  fixtureClinicComplete,
  fixtureKoreanProductComplete,
  formatRealDataOnboardingMarkdown,
  isOfficialPrioritySource,
  mayBecomeUserVisibleFromDryRun,
  pickPreferredSource,
  renderTemplateCsv,
  KOREAN_PRODUCT_IMPORT_TEMPLATE,
  CLINIC_PROFESSIONAL_IMPORT_TEMPLATE,
  runRealDataOnboardingHarness,
  validateOnboardingRowDryRun,
} from "../src/lib/onboarding/realDataOnboarding";

const root = process.cwd();

function fileExists(rel: string) {
  return existsSync(path.join(root, rel));
}

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

assert.equal(REAL_DATA_ONBOARDING_TASK_ID, "P2-T04");

const contractErrors = assertRealDataOnboardingContractIntegrity({ fileExists });
assert.deepEqual(
  contractErrors,
  [],
  `contract errors: ${contractErrors.join("; ")}`,
);

assert.ok(isOfficialPrioritySource("official_product_page"));
assert.ok(isOfficialPrioritySource("clinic_official_site"));
assert.equal(isOfficialPrioritySource("marketplace_listing"), false);
assert.ok(compareSourcePriority("official_brand_site", "marketplace_listing") < 0);
assert.equal(
  pickPreferredSource(["fixture_offline", "marketplace_listing", "official_inci_label"]),
  "official_inci_label",
);

const fxProduct = validateOnboardingRowDryRun(fixtureKoreanProductComplete());
assert.equal(fxProduct.eligibility, "fixture_non_public");
assert.equal(fxProduct.publicVisible, false);
assert.equal(fxProduct.writeAttempted, false);
assert.ok(fxProduct.rejectionReasons.includes("fixture_cannot_publish"));
assert.equal(mayBecomeUserVisibleFromDryRun(fxProduct), false);

const readyProduct = evaluateEligibility(dryRunOfficialKoreanProductReady());
assert.equal(readyProduct.eligibility, "eligible_for_staging_review");
assert.equal(readyProduct.publicVisible, false);

const market = evaluateEligibility(dryRunMarketplaceOnlyProduct());
assert.equal(market.eligibility, "rejected");
assert.ok(market.rejectionReasons.includes("official_source_not_priority"));
assert.ok(market.rejectionReasons.includes("full_inci_missing"));

const fxClinic = evaluateEligibility(fixtureClinicComplete());
assert.equal(fxClinic.eligibility, "fixture_non_public");
assert.ok(fxClinic.rejectionReasons.includes("clinic_fixture_cannot_publish"));

const readyClinic = evaluateEligibility(dryRunOfficialClinicReady());
assert.equal(readyClinic.eligibility, "eligible_for_staging_review");

const productCsv = renderTemplateCsv(KOREAN_PRODUCT_IMPORT_TEMPLATE);
assert.ok(productCsv.includes("brand,product_name"));
assert.ok(productCsv.includes("FixtureBrand"));
assert.equal(KOREAN_PRODUCT_IMPORT_TEMPLATE.publicClaimForbidden, true);

const clinicCsv = renderTemplateCsv(CLINIC_PROFESSIONAL_IMPORT_TEMPLATE);
assert.ok(clinicCsv.includes("clinic_name,specialties"));
assert.equal(CLINIC_PROFESSIONAL_IMPORT_TEMPLATE.publicClaimForbidden, true);

const report = runRealDataOnboardingHarness();
assert.equal(report.taskId, "P2-T04");
assert.equal(report.writeAttempted, false);
assert.equal(report.productionWriteAttempted, false);
assert.equal(report.paidApiUsed, false);
assert.equal(report.captchaBypassAttempted, false);
assert.equal(report.authenticatedScrapeAttempted, false);
assert.equal(report.ok, true, formatRealDataOnboardingMarkdown(report));
assert.ok(report.summary.fail === 0);
assert.ok(report.product.fixtureNonPublic >= 1);
assert.ok(report.clinic.fixtureNonPublic >= 1);
assert.ok(report.product.eligibleForStagingReview >= 1);
assert.ok(report.clinic.eligibleForStagingReview >= 1);
assert.ok(report.dryRunResults.every((r) => r.publicVisible === false));

const doc = read("docs/prelaunch/P2-T04_REAL_DATA_ONBOARDING.md");
assert.ok(doc.includes("P2-T04"));
assert.ok(doc.includes("fixture"));
assert.ok(doc.includes("dry-run"));
assert.ok(doc.includes("Production"));

const pkg = read("package.json");
assert.ok(pkg.includes('"test:real-data-onboarding"'));

console.log("real-data-onboarding selftest: OK");
console.log(
  `checks pass=${report.summary.pass} fail=${report.summary.fail} productEligible=${report.product.eligibleForStagingReview} clinicEligible=${report.clinic.eligibleForStagingReview}`,
);
