/**
 * P2-T03 — Admin review end-to-end selftest.
 * Local fixtures / Staging-safe dry-run only. No DB writes.
 * Does not claim Preview login or live official clinic sources.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  ADMIN_REVIEW_E2E_TASK_ID,
  CANONICAL_REVIEW_PHASES,
  assertAdminReviewE2EContractIntegrity,
  buildDryRunOfficialClinic,
  buildOrganicRankingIndependenceFixture,
  formatAdminReviewE2EMarkdown,
  isProductPubliclyVisible,
  mapAdminOpsStatusToPhase,
  mapClinicStatusToPhase,
  runAdminReviewE2EHarness,
  runClinicAdminReviewScenario,
  runProductAdminReviewScenario,
} from "../src/lib/admin/adminReviewE2E";
import { buildFixtureClinicCandidates } from "../src/lib/clinic/clinicCollection";
import { isClinicPublishable } from "../src/lib/clinic/clinicVerification";
import { rankByOrganicScoreOnly } from "../src/lib/commercial/organicRanking";

const root = process.cwd();

function fileExists(rel: string) {
  return existsSync(path.join(root, rel));
}

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf8");
}

assert.equal(ADMIN_REVIEW_E2E_TASK_ID, "P2-T03");
assert.deepEqual(
  [...CANONICAL_REVIEW_PHASES],
  [
    "candidate",
    "evidence_review",
    "duplicate_decision",
    "needs_review",
    "admin_reviewed",
    "publishable",
  ],
);

const contractErrors = assertAdminReviewE2EContractIntegrity({ fileExists });
assert.deepEqual(
  contractErrors,
  [],
  `contract errors: ${contractErrors.join("; ")}`,
);

// --- Public visibility unit gates ---
assert.equal(
  isProductPubliclyVisible({
    id: "fx",
    isFixture: true,
    reviewStatus: "publishable",
    publicationStatus: "published",
    evidenceIncomplete: false,
  }),
  false,
  "fixture never public",
);
assert.equal(
  isProductPubliclyVisible({
    id: "nr",
    isFixture: false,
    reviewStatus: "needs_review",
    publicationStatus: "published",
    evidenceIncomplete: false,
  }),
  false,
  "needs_review never public",
);
assert.equal(
  isProductPubliclyVisible({
    id: "ok",
    isFixture: false,
    reviewStatus: "publishable",
    publicationStatus: "published",
    evidenceIncomplete: false,
  }),
  true,
  "non-fixture publishable + published may be public",
);

assert.equal(mapAdminOpsStatusToPhase("candidate"), "candidate");
assert.equal(mapAdminOpsStatusToPhase("evidence_pending"), "evidence_review");
assert.equal(mapAdminOpsStatusToPhase("duplicate_watch"), "duplicate_decision");
assert.equal(mapAdminOpsStatusToPhase("in_review"), "needs_review");
assert.equal(mapAdminOpsStatusToPhase("approved_staging"), "admin_reviewed");
assert.equal(mapClinicStatusToPhase("discovered"), "candidate");
assert.equal(mapClinicStatusToPhase("admin_reviewed"), "admin_reviewed");
assert.equal(mapClinicStatusToPhase("publishable"), "publishable");

// --- Product scenario ---
const product = runProductAdminReviewScenario();
assert.equal(product.lane, "product");
assert.equal(product.ok, true, product.reasons.join("; "));
assert.equal(product.stagingWritePerformed, false);
assert.equal(product.productionWritePerformed, false);
assert.equal(product.databaseTouched, false);
assert.equal(product.publicVisibleIds.length, 0);
for (const phase of CANONICAL_REVIEW_PHASES) {
  assert.ok(
    product.phasesReached.includes(phase),
    `product missing phase: ${phase}`,
  );
}

// --- Clinic scenario ---
const clinic = runClinicAdminReviewScenario();
assert.equal(clinic.lane, "clinic_professional");
assert.equal(clinic.ok, true, clinic.reasons.join("; "));
assert.equal(clinic.stagingWritePerformed, false);
assert.equal(clinic.productionWritePerformed, false);
assert.equal(clinic.databaseTouched, false);
assert.ok(clinic.privateIds.length > 0);
assert.ok(
  clinic.publicVisibleIds.every((id) => id.startsWith("dry-run-official-")),
  "only dry-run official may be public",
);
for (const phase of CANONICAL_REVIEW_PHASES) {
  assert.ok(
    clinic.phasesReached.includes(phase),
    `clinic missing phase: ${phase}`,
  );
}

const fixtures = buildFixtureClinicCandidates();
assert.ok(fixtures.every((f) => f.fixtureOnly));
assert.equal(fixtures.filter(isClinicPublishable).length, 0);
const dry = buildDryRunOfficialClinic(fixtures.find((f) => !f.id.includes("incomplete"))!);
assert.equal(dry.fixtureOnly, false);

// --- Organic ranking independence ---
const organic = buildOrganicRankingIndependenceFixture();
assert.equal(organic.orderUnchanged, true);
assert.deepEqual(organic.forbiddenInScorePayload, []);
assert.deepEqual(
  rankByOrganicScoreOnly(organic.base).map((c) => c.id),
  ["prod-high", "prod-mid", "clinic-organic"],
);
assert.deepEqual(
  rankByOrganicScoreOnly(organic.withPaidNoise).map((c) => c.id),
  ["prod-high", "prod-mid", "clinic-organic"],
);

// --- Full harness ---
const report = runAdminReviewE2EHarness({
  mode: "local_fixture",
  now: new Date("2026-07-24T03:00:00.000Z"),
});
assert.equal(report.taskId, "P2-T03");
assert.equal(report.writeAttempted, false);
assert.equal(report.ok, true, formatAdminReviewE2EMarkdown(report));
assert.equal(report.summary.fail, 0);
assert.ok(report.checks.length >= 10);
assert.ok(report.checks.every((c) => c.status === "pass"));

const md = formatAdminReviewE2EMarkdown(report);
assert.ok(md.includes("P2-T03"));
assert.ok(md.includes("writeAttempted"));

// --- Docs / scripts registered ---
assert.ok(fileExists("docs/prelaunch/P2-T03_ADMIN_REVIEW_E2E.md"));
const pkg = read("package.json");
assert.ok(pkg.includes('"test:admin-review-e2e"'));

console.log("admin-review-e2e selftest: OK");
