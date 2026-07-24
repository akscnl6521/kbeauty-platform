/**
 * Autopilot queue/contract self-test (T00).
 * Verifies docs/autopilot contract + queue integrity and key path presence.
 * Does not claim Preview/Production/external verification.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  const abs = path.join(root, rel);
  assert.ok(existsSync(abs), `missing file: ${rel}`);
  return readFileSync(abs, "utf8");
}

function mustInclude(hay: string, needles: string[], label: string) {
  for (const n of needles) {
    assert.ok(hay.includes(n), `${label} must include: ${n}`);
  }
}

function mustExist(rel: string) {
  assert.ok(existsSync(path.join(root, rel)), `expected path: ${rel}`);
}

const contract = read("docs/autopilot/EXECUTION_CONTRACT.md");
mustInclude(
  contract,
  [
    "KBEAUTY_MASTER_EXECUTION_PROMPT.md",
    "verified_complete",
    "partial",
    "external_only",
    "remaining",
    "deferred",
    "AUTOPILOT_RESULT: COMPLETE",
    "AUTOPILOT_RESULT: BLOCKED",
    "main",
    "Production",
    "test:autopilot-queue",
  ],
  "EXECUTION_CONTRACT",
);
assert.ok(
  !contract.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY를 생성"),
  "contract must not instruct creating public service-role key",
);

const queue = read("docs/autopilot/MASTER_EXECUTION_QUEUE.md");
mustInclude(
  queue,
  [
    "## next_task",
    "verified_complete",
    "partial",
    "external_only",
    "remaining",
    "deferred",
    "VC-01",
    "EX-01",
    "DF-01",
    "RE-01",
    "fixture",
    "RELEASE_GATE_PENDING",
    "npm run test:autopilot-queue",
  ],
  "MASTER_EXECUTION_QUEUE",
);

assert.match(
  queue,
  /\|\s*ID\s*\|\s*`?T0\d+`?/,
  "next_task must declare a T0x task id",
);

const legacy = read("docs/MASTER_EXECUTION_QUEUE.md");
mustInclude(
  legacy,
  [
    "docs/autopilot/EXECUTION_CONTRACT.md",
    "docs/autopilot/MASTER_EXECUTION_QUEUE.md",
    "npm run test:autopilot-queue",
  ],
  "legacy MASTER_EXECUTION_QUEUE pointer",
);

const status = read("PROJECT_STATUS.md");
mustInclude(
  status,
  ["docs/autopilot/MASTER_EXECUTION_QUEUE.md", "feature/recommendation-usage-guide-display-20260720"],
  "PROJECT_STATUS",
);

const roadmap = read("ROADMAP.md");
// Code-complete WQ-B must not be contradicted by an unchecked duplicate line.
assert.ok(
  roadmap.includes("사진 비교 동의·저장·삭제"),
  "ROADMAP must mention photo comparison WQ-B",
);
assert.ok(
  !/^- \[ \] 사진 비교 동의·삭제 흐름\s*$/m.test(roadmap),
  "ROADMAP must not keep contradictory unchecked photo-comparison duplicate",
);
assert.ok(
  roadmap.includes("care-photos") || roadmap.includes("Staging migration"),
  "ROADMAP must keep Staging/Storage photo-comparison as pending external",
);

const keyPaths = [
  "src/lib/profile/beautyProfile.ts",
  "src/lib/profile/beautyProfileServer.ts",
  "src/app/api/care/beauty-profile/route.ts",
  "src/app/my/profile",
  "src/app/my/guidance",
  "src/app/admin/clinics",
  "src/app/admin/commerce",
  "src/lib/commercial/affiliateLink.ts",
  "src/lib/care/professionalGuidanceBundle.ts",
  "src/lib/catalog/commonProduct.ts",
  "src/lib/catalog/productAutomation/index.ts",
  "scripts/master-execution-selftest.ts",
  "scripts/beauty-profile-selftest.ts",
  "scripts/product-automation-selftest.ts",
  "scripts/organic-commerce-professional-routing-selftest.ts",
  "scripts/clinic-stage6-selftest.ts",
  "supabase/migrations/DRAFT_DO_NOT_APPLY_beauty_profiles.sql",
  "docs/prelaunch/WQ-G_PRELAUNCH_GATE.md",
  "docs/catalog-product-automation.md",
  "docs/organic-commerce-professional-routing.md",
  "docs/prelaunch/T06_FINAL_INTEGRATION_RELEASE_EVIDENCE.md",
  "docs/prelaunch/P2-T01_PREVIEW_ROUTE_VALIDATION.md",
  "docs/prelaunch/P2-T02_STAGING_RELEASE_GATE.md",
  "docs/prelaunch/P2-T03_ADMIN_REVIEW_E2E.md",
  "docs/prelaunch/P2-T04_REAL_DATA_ONBOARDING.md",
  "docs/prelaunch/P2-T05_FINAL_PREVIEW_EVIDENCE_PACKAGE.md",
  "docs/prelaunch/T07-02_SEOUL_DERMATOLOGY_INGESTION.md",
  "docs/prelaunch/T07-03_INSTITUTION_DETAIL_ENRICHMENT.md",
  "docs/prelaunch/T07-04_SYMPTOM_EVIDENCE_REVIEW.md",
  "docs/prelaunch/T07-05_ADMIN_DRY_RUN_PUBLISHABLE_GATE.md",
  "docs/prelaunch/P3-T01_OFFICIAL_KR_PRODUCT_SOURCE.md",
  "src/lib/publicData/institutionDetailEnrichment/index.ts",
  "src/lib/publicData/symptomEvidenceReview/index.ts",
  "src/lib/publicData/adminDryRunPublishableGate/index.ts",
  "src/lib/release/finalIntegrationEvidence.ts",
  "src/lib/release/phase2FinalEvidencePackage.ts",
  "src/lib/release/stagingReleaseGate.ts",
  "src/lib/admin/adminReviewE2E.ts",
  "src/lib/onboarding/realDataOnboarding/index.ts",
  "src/lib/onboarding/officialKoreanProductSource/index.ts",
  "src/lib/validation/previewRouteValidation.ts",
  "src/lib/publicData/seoulDermatologyIngestion/index.ts",
  "KBEAUTY_MASTER_EXECUTION_PROMPT.md",
];
for (const p of keyPaths) mustExist(p);

const pkg = read("package.json");
assert.ok(
  pkg.includes('"test:autopilot-queue"'),
  "package.json must define test:autopilot-queue",
);
assert.ok(
  pkg.includes('"test:beauty-profile"'),
  "package.json must define test:beauty-profile",
);
assert.ok(
  pkg.includes('"test:product-automation"'),
  "package.json must define test:product-automation",
);
assert.ok(
  pkg.includes('"test:preview-routes"'),
  "package.json must define test:preview-routes",
);
assert.ok(
  pkg.includes('"check:preview-routes"'),
  "package.json must define check:preview-routes",
);
assert.ok(
  pkg.includes('"test:staging-release-gate"'),
  "package.json must define test:staging-release-gate",
);
assert.ok(
  pkg.includes('"check:staging-release-gate"'),
  "package.json must define check:staging-release-gate",
);
assert.ok(
  pkg.includes('"test:admin-review-e2e"'),
  "package.json must define test:admin-review-e2e",
);
assert.ok(
  pkg.includes('"test:real-data-onboarding"'),
  "package.json must define test:real-data-onboarding",
);
assert.ok(
  pkg.includes('"test:phase2-final-evidence"'),
  "package.json must define test:phase2-final-evidence",
);
assert.ok(
  pkg.includes('"check:phase2-final-evidence"'),
  "package.json must define check:phase2-final-evidence",
);
assert.ok(
  pkg.includes('"test:seoul-dermatology-ingestion"'),
  "package.json must define test:seoul-dermatology-ingestion",
);
assert.ok(
  pkg.includes('"check:seoul-dermatology-ingestion"'),
  "package.json must define check:seoul-dermatology-ingestion",
);
assert.ok(
  pkg.includes('"test:institution-detail-enrichment"'),
  "package.json must define test:institution-detail-enrichment",
);
assert.ok(
  pkg.includes('"check:institution-detail-enrichment"'),
  "package.json must define check:institution-detail-enrichment",
);
assert.ok(
  pkg.includes('"test:symptom-evidence-review"'),
  "package.json must define test:symptom-evidence-review",
);
assert.ok(
  pkg.includes('"check:symptom-evidence-review"'),
  "package.json must define check:symptom-evidence-review",
);
assert.ok(
  pkg.includes('"test:admin-dry-run-publishable-gate"'),
  "package.json must define test:admin-dry-run-publishable-gate",
);
assert.ok(
  pkg.includes('"check:admin-dry-run-publishable-gate"'),
  "package.json must define check:admin-dry-run-publishable-gate",
);
assert.ok(
  pkg.includes('"test:official-kr-product-source"'),
  "package.json must define test:official-kr-product-source",
);
assert.ok(
  pkg.includes('"check:official-kr-product-source"'),
  "package.json must define check:official-kr-product-source",
);
assert.ok(
  pkg.includes('"test:organic-commerce"'),
  "package.json must define test:organic-commerce",
);
assert.ok(
  pkg.includes('"test:final-integration"'),
  "package.json must define test:final-integration",
);

const queueNext = queue.match(/## next_task[\s\S]*?\|\s*ID\s*\|\s*`?(T0\d+)`?/);
assert.ok(queueNext, "next_task ID parseable");
assert.ok(
  queue.includes("VC-20") || queue.includes("beauty-profile"),
  "queue should reflect BeautyProfile durable work",
);

console.log("autopilot-queue selftest: OK");
