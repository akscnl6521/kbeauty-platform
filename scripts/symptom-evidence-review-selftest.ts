/**
 * T07-04 Official-site symptom evidence review self-test.
 * Fixture / dry-run only — no crawl, no Production writes, no publish.
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BLOCKED_ACCESS_MODES,
  CLAIM_CATEGORY_LABEL_KO,
  NO_CRAWL_NOTE_KO,
  ORGANIC_SEPARATION_NOTE_KO,
  REQUIRED_CLAIM_CATEGORIES,
  SYMPTOM_EVIDENCE_REVIEW_TASK_ID,
  SYMPTOM_EVIDENCE_SOURCE_MANIFEST,
  UNVERIFIED_UNPUBLISHED_NOTE_KO,
  buildReviewQueue,
  collectRejectionCodes,
  evaluateSymptomEvidenceRow,
  findManifestEntry,
  formatQueueSummaryKo,
  getFixtureSymptomEvidenceInputs,
  isPaidCommercialRelationship,
  isSupportedClaimCategory,
  paidRelationshipDoesNotGrantOrganic,
  runFixtureSymptomEvidenceReview,
  runSymptomEvidenceReview,
} from "../src/lib/publicData/symptomEvidenceReview";
import type { SymptomEvidenceManifestInput } from "../src/lib/publicData/symptomEvidenceReview";

async function main() {
  assert.equal(SYMPTOM_EVIDENCE_REVIEW_TASK_ID, "T07-04");
  assert.deepEqual(
    [...REQUIRED_CLAIM_CATEGORIES],
    ["acne", "rosacea_redness", "atopic_dermatitis", "pigmentation"],
  );
  for (const cat of REQUIRED_CLAIM_CATEGORIES) {
    assert.ok(CLAIM_CATEGORY_LABEL_KO[cat]);
    assert.equal(isSupportedClaimCategory(cat), true);
  }
  assert.ok(UNVERIFIED_UNPUBLISHED_NOTE_KO.includes("미검증"));
  assert.ok(ORGANIC_SEPARATION_NOTE_KO.includes("Organic"));
  assert.ok(NO_CRAWL_NOTE_KO.includes("CAPTCHA"));
  assert.ok(BLOCKED_ACCESS_MODES.includes("blocked_captcha"));
  assert.ok(findManifestEntry("official-hospital-page"));
  assert.ok(
    SYMPTOM_EVIDENCE_SOURCE_MANIFEST.some(
      (e) => e.kind === "official_hospital_page",
    ),
  );

  // --- Blocked access modes ---
  const captchaCodes = collectRejectionCodes({
    evidenceId: "t-captcha",
    sourceId: "captcha-blocked",
    claimCategory: "acne",
    evidenceUrl: "https://example.com/a",
    pageTitle: "t",
    excerptSummary: "e",
    verifiedAt: "2026-07-20T00:00:00.000Z",
    staleAt: "2026-12-31T00:00:00.000Z",
    reviewerStatus: "pending_review",
    rejectionReasonCode: null,
    rejectionReasonKo: null,
    commercialRelationship: "none",
    commercialDisclosureKo: null,
    clinicOrInstitutionLabel: null,
    isFixture: false,
    accessMode: "blocked_captcha",
  });
  assert.ok(captchaCodes.includes("captcha_bypass_forbidden"));

  const loginCodes = collectRejectionCodes({
    evidenceId: "t-login",
    sourceId: "auth-wall-blocked",
    claimCategory: "acne",
    evidenceUrl: "https://example.com/a",
    pageTitle: "t",
    excerptSummary: "e",
    verifiedAt: "2026-07-20T00:00:00.000Z",
    staleAt: "2026-12-31T00:00:00.000Z",
    reviewerStatus: "pending_review",
    rejectionReasonCode: null,
    rejectionReasonKo: null,
    commercialRelationship: "none",
    commercialDisclosureKo: null,
    clinicOrInstitutionLabel: null,
    isFixture: false,
    accessMode: "blocked_auth_required",
  });
  assert.ok(loginCodes.includes("login_automation_forbidden"));

  // --- Required evidence fields ---
  const missing = collectRejectionCodes({
    evidenceId: "t-missing",
    sourceId: "official-hospital-page",
    claimCategory: "acne",
    evidenceUrl: "",
    pageTitle: "",
    excerptSummary: "",
    verifiedAt: null,
    staleAt: null,
    reviewerStatus: "pending_review",
    rejectionReasonCode: null,
    rejectionReasonKo: null,
    commercialRelationship: "none",
    commercialDisclosureKo: null,
    clinicOrInstitutionLabel: null,
    isFixture: false,
    accessMode: "manifest_manual",
  });
  assert.ok(missing.includes("evidence_url_missing"));
  assert.ok(missing.includes("page_title_missing"));
  assert.ok(missing.includes("excerpt_summary_missing"));
  assert.ok(missing.includes("verified_date_missing"));
  assert.ok(missing.includes("stale_date_missing"));
  assert.ok(missing.includes("unverified_must_stay_unpublished"));

  // --- Fixture pipeline ---
  const result = runFixtureSymptomEvidenceReview();
  assert.equal(result.taskId, "T07-04");
  assert.equal(result.publishAllowed, false);
  assert.equal(result.databaseTouched, false);
  assert.equal(result.writeAttempted, false);
  assert.equal(result.productionTouched, false);
  assert.equal(result.crawlAttempted, false);
  assert.equal(result.audit.publishAllowed, false);
  assert.equal(result.audit.crawlAttempted, false);
  assert.equal(result.audit.loginAutomationAttempted, false);
  assert.equal(result.audit.captchaBypassAttempted, false);
  assert.equal(result.audit.ok, true);

  const cats = new Set(result.records.map((r) => r.claimCategory));
  for (const cat of REQUIRED_CLAIM_CATEGORIES) {
    assert.ok(cats.has(cat), `fixture must cover ${cat}`);
  }

  const approvedOrganic = result.records.find(
    (r) => r.evidenceId === "fx-acne-official-approved",
  );
  assert.ok(approvedOrganic);
  assert.equal(approvedOrganic!.organicEligibility, "organic_eligible");
  assert.equal(approvedOrganic!.publishEligible, true);
  assert.equal(approvedOrganic!.publishAllowed, false);
  assert.equal(approvedOrganic!.publicVisible, false);
  assert.equal(approvedOrganic!.queueLane, "organic_review");
  assert.ok(approvedOrganic!.evidenceUrl.startsWith("https://"));
  assert.ok(approvedOrganic!.pageTitle.length > 0);
  assert.ok(approvedOrganic!.excerptSummary.length > 0);
  assert.ok(approvedOrganic!.verifiedAt);
  assert.ok(approvedOrganic!.staleAt);

  const pending = result.records.find(
    (r) => r.evidenceId === "fx-rosacea-official-pending",
  );
  assert.ok(pending);
  assert.equal(pending!.organicEligibility, "organic_ineligible_unverified");
  assert.equal(pending!.publishEligible, false);
  assert.equal(pending!.queueLane, "pending");

  const affiliate = result.records.find(
    (r) => r.evidenceId === "fx-pigmentation-affiliate",
  );
  assert.ok(affiliate);
  assert.equal(
    affiliate!.organicEligibility,
    "organic_ineligible_paid_relationship",
  );
  assert.equal(affiliate!.queueLane, "paid_relationship_review");
  assert.equal(affiliate!.publishEligible, false);
  assert.ok(
    paidRelationshipDoesNotGrantOrganic({
      commercialRelationship: affiliate!.commercialRelationship,
      organicEligibility: affiliate!.organicEligibility,
    }),
  );

  const sponsored = result.records.find(
    (r) => r.evidenceId === "fx-acne-sponsored",
  );
  assert.ok(sponsored);
  assert.equal(
    sponsored!.organicEligibility,
    "organic_ineligible_paid_relationship",
  );
  assert.equal(sponsored!.queueLane, "paid_relationship_review");

  const rejected = result.records.find(
    (r) => r.evidenceId === "fx-atopic-rejected",
  );
  assert.ok(rejected);
  assert.equal(rejected!.queueLane, "rejected");
  assert.ok(rejected!.rejectionReasonKo);
  assert.ok(
    rejected!.rejectionReasonCode === "medical_claim_unverified" ||
      rejected!.rejectionCodes.includes("reviewer_rejected"),
  );

  const captchaRow = result.records.find(
    (r) => r.evidenceId === "fx-pigmentation-captcha-block",
  );
  assert.ok(captchaRow);
  assert.ok(captchaRow!.rejectionCodes.includes("captcha_bypass_forbidden"));
  assert.equal(captchaRow!.publishEligible, false);

  const offline = result.records.find(
    (r) => r.evidenceId === "fx-offline-fixture-only",
  );
  assert.ok(offline);
  assert.equal(offline!.publishEligible, false);
  assert.ok(offline!.rejectionCodes.includes("fixture_cannot_publish"));

  const marketplace = result.records.find(
    (r) => r.evidenceId === "fx-marketplace-blocked",
  );
  assert.ok(marketplace);
  assert.ok(marketplace!.rejectionCodes.includes("source_kind_not_allowed"));
  assert.equal(marketplace!.organicEligibility, "organic_ineligible_policy");
  assert.equal(marketplace!.queueLane, "rejected");

  // Queue separation
  assert.ok(result.queue.organicReview.length >= 1);
  assert.ok(result.queue.paidRelationshipReview.length >= 2);
  assert.ok(result.queue.pending.length >= 1);
  assert.ok(result.queue.rejected.length >= 1);
  const summary = formatQueueSummaryKo(result.queue);
  assert.ok(summary.some((s) => s.includes("Organic")));
  assert.ok(summary.some((s) => s.includes("제휴")));

  // Rebuilt queue matches
  const rebuilt = buildReviewQueue(result.records);
  assert.equal(rebuilt.organicReview.length, result.queue.organicReview.length);
  assert.equal(
    rebuilt.paidRelationshipReview.length,
    result.queue.paidRelationshipReview.length,
  );

  // Dry-run mode identical honesty flags
  const dry = runSymptomEvidenceReview({
    mode: "dry_run",
    rows: getFixtureSymptomEvidenceInputs(),
    now: "2026-07-24T04:00:00.000Z",
    nowMs: Date.parse("2026-07-24T04:00:00.000Z"),
  });
  assert.equal(dry.mode, "dry_run");
  assert.equal(dry.publishAllowed, false);
  assert.equal(dry.crawlAttempted, false);
  assert.ok(dry.totals.byCategory.acne >= 1);
  assert.ok(dry.totals.byCategory.rosacea_redness >= 1);
  assert.ok(dry.totals.byCategory.atopic_dermatitis >= 1);
  assert.ok(dry.totals.byCategory.pigmentation >= 1);
  assert.ok(dry.totals.unpublishedUnverified >= 1);
  assert.ok(dry.totals.organicIneligiblePaid >= 2);

  // Paid never becomes organic even if someone marks approved
  const forcedPaid: SymptomEvidenceManifestInput = {
    evidenceId: "forced-paid",
    sourceId: "official-hospital-page",
    claimCategory: "acne",
    evidenceUrl: "https://hospital.example.kr/x",
    pageTitle: "x",
    excerptSummary: "y",
    verifiedAt: "2026-07-20T00:00:00.000Z",
    staleAt: "2026-12-31T00:00:00.000Z",
    reviewerStatus: "approved",
    rejectionReasonCode: null,
    rejectionReasonKo: null,
    commercialRelationship: "lead_fee",
    commercialDisclosureKo: "lead",
    clinicOrInstitutionLabel: "x",
    isFixture: false,
    accessMode: "manifest_manual",
  };
  const forced = evaluateSymptomEvidenceRow(
    forcedPaid,
    "2026-07-24T04:00:00.000Z",
    Date.parse("2026-07-24T04:00:00.000Z"),
  );
  assert.equal(isPaidCommercialRelationship("lead_fee"), true);
  assert.notEqual(forced.organicEligibility, "organic_eligible");
  assert.equal(forced.queueLane, "paid_relationship_review");
  assert.equal(forced.publishAllowed, false);

  // live_blocked still does not crawl/write
  const blocked = runSymptomEvidenceReview({
    mode: "live_blocked",
    rows: getFixtureSymptomEvidenceInputs().slice(0, 2),
    now: "2026-07-24T04:00:00.000Z",
  });
  assert.equal(blocked.mode, "live_blocked");
  assert.equal(blocked.crawlAttempted, false);
  assert.equal(blocked.writeAttempted, false);

  const outDir = path.join(
    process.cwd(),
    "artifacts",
    "symptom-evidence-review",
  );
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "selftest-audit.json"),
    JSON.stringify(result.audit, null, 2),
    "utf8",
  );

  console.log("symptom-evidence-review selftest: OK");
  console.log(
    JSON.stringify(
      {
        taskId: result.taskId,
        records: result.records.length,
        organicReview: result.queue.organicReview.length,
        paidRelationshipReview: result.queue.paidRelationshipReview.length,
        pending: result.queue.pending.length,
        rejected: result.queue.rejected.length,
        publishAllowed: false,
        crawlAttempted: false,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
