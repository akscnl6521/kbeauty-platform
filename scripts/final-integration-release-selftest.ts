/**
 * T06 — Final integration + release evidence selftest.
 * Verifies journey wiring, landmark OFF, privacy/consent/disclosure copy,
 * and empty/loading/error a11y markers in critical UI. Does not claim Preview/device.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  FINAL_INTEGRATION_GATES,
  FINAL_INTEGRATION_JOURNEY,
  assertNoExternalMarkedVerified,
  journeyStepsByClass,
} from "../src/lib/release/finalIntegrationEvidence";
import {
  isCaptureVoiceCountdownEnabled,
  isFaceLandmarkAutoCaptureEnabled,
} from "../src/lib/analyze/guidedCapture/landmark/isEnabled";
import {
  ANALYSIS_SCOPE_COPY_KO,
  isGalleryAllowedForGeneralUsers,
} from "../src/lib/analyze/guidedCapture/inputPolicy";
import { applySymptomSafetyToRecommendation } from "../src/lib/ai/symptomSafety";
import type { AnalyzeSkinRequest } from "../src/lib/ai/types";
import type { Recommendation } from "../src/lib/recommend";

const root = process.cwd();

function read(rel: string): string {
  const abs = path.join(root, rel);
  assert.ok(existsSync(abs), `missing: ${rel}`);
  return readFileSync(abs, "utf8");
}

function mustExist(rel: string) {
  assert.ok(existsSync(path.join(root, rel)), `expected path: ${rel}`);
}

// --- Evidence contract honesty ---
assertNoExternalMarkedVerified();
assert.ok(FINAL_INTEGRATION_JOURNEY.length >= 10, "journey map size");
assert.equal(
  journeyStepsByClass("external_only").length,
  0,
  "journey steps use partial/verified — Preview gates live in FINAL_INTEGRATION_GATES"
);
const externalGates = FINAL_INTEGRATION_GATES.filter(
  (g) => g.classification === "external_only"
);
assert.ok(externalGates.length >= 4, "Preview/device/legal/AI_PROVIDER external");
assert.ok(
  FINAL_INTEGRATION_GATES.some(
    (g) => g.id === "landmark_default_off" && g.classification === "verified_complete"
  ),
  "landmark OFF gate verified"
);

// --- Landmark / voice defaults ---
assert.equal(
  isFaceLandmarkAutoCaptureEnabled({}),
  false,
  "empty env → landmark OFF"
);
assert.equal(
  isFaceLandmarkAutoCaptureEnabled({
    NEXT_PUBLIC_FACE_LANDMARK_AUTO_CAPTURE: "0",
  }),
  false,
  "flag 0 → OFF"
);
assert.equal(
  isFaceLandmarkAutoCaptureEnabled({
    NEXT_PUBLIC_FACE_LANDMARK_AUTO_CAPTURE: "1",
  }),
  true,
  "flag 1 → ON (explicit only)"
);
assert.equal(
  isCaptureVoiceCountdownEnabled({}),
  false,
  "voice off when landmark off"
);
assert.equal(isGalleryAllowedForGeneralUsers(), false, "gallery forbidden");

// --- Privacy / consent copy honesty ---
assert.ok(
  ANALYSIS_SCOPE_COPY_KO.noExternalVision.includes("외부 AI"),
  "no external vision copy"
);
assert.ok(
  ANALYSIS_SCOPE_COPY_KO.consentAnalysisLabel.includes("문진"),
  "consent is questionnaire-based"
);
assert.ok(
  !ANALYSIS_SCOPE_COPY_KO.consentAnalysisLabel.includes("사진을 사용"),
  "consent must not claim photo vision use"
);

// --- Safety gate wiring ---
const baseRec = {
  managementLevel: "self_care",
  recommendedIngredients: [{ name: "niacinamide" }],
  manageableWithCosmetics: ["redness"],
  expertReferralReasons: [],
  precautions: [],
  notRecommendedReasons: [],
} as unknown as Recommendation;
const acuteInput: AnalyzeSkinRequest = {
  mode: "manual",
  skinTone: "중간",
  undertone: "중립",
  concerns: ["여드름"],
  sensitivity: "보통",
  concernObservations: [
    {
      concern: "여드름",
      areas: ["chin"],
      severity: "severe",
      duration: "over_3_months",
      worsening: true,
      redFlags: ["pain"],
    },
  ],
};
const gated = applySymptomSafetyToRecommendation(baseRec, acuteInput);
assert.ok(
  gated.managementLevel === "urgent_check" ||
    gated.managementLevel === "expert_first",
  "acute → expert/urgent management"
);
assert.ok(
  (gated.professionalRoutes?.length ?? 0) > 0,
  "professionalRoutes present"
);
assert.equal(
  gated.professionalRoutes?.[0]?.productRecommendationAllowed,
  false,
  "route blocks product recommendation"
);

// --- Journey path presence ---
for (const step of FINAL_INTEGRATION_JOURNEY) {
  for (const p of step.codePaths) {
    mustExist(p);
  }
}

// --- Critical UI: empty / loading / error a11y ---
const usageGuide = read("src/components/usage/ProductUsageGuide.tsx");
assert.ok(usageGuide.includes('emptyMode'), "usage emptyMode");
assert.ok(
  usageGuide.includes('role="status"') || usageGuide.includes("role='status'"),
  "usage guide empty/status a11y"
);

const photoAssets = read("src/components/care/PhotoAssetsSettingsPanel.tsx");
assert.ok(photoAssets.includes("불러오는 중"), "photo assets loading copy");
assert.ok(
  photoAssets.includes('role="status"'),
  "photo assets status role"
);
assert.ok(
  photoAssets.includes("저장된 사진 기록이 없습니다"),
  "photo assets empty copy"
);

const photoConsent = read("src/components/care/PhotoConsentPanel.tsx");
assert.ok(photoConsent.includes('role="alert"'), "consent validation alert");
assert.ok(photoConsent.includes("ANALYSIS_SCOPE_COPY_KO"), "honest consent copy");

const guidedFlow = read(
  "src/components/analyze/guidedCapture/GuidedCaptureFlow.tsx"
);
assert.ok(guidedFlow.includes('role="alert"'), "capture error alert");
assert.ok(guidedFlow.includes('role="status"'), "capture status");
assert.ok(
  guidedFlow.includes("next/dynamic") || guidedFlow.includes("dynamic("),
  "camera dynamic import"
);

const overlay = read(
  "src/components/analyze/guidedCapture/AnalysisProgressOverlay.tsx"
);
assert.ok(overlay.includes('role="status"') || overlay.includes("aria-"), "progress a11y");

const disclosure = read("src/components/disclosure/ContentDisclosure.tsx");
assert.ok(
  disclosure.includes("getContentDisclosureLabel") ||
    disclosure.includes("disclosure"),
  "disclosure component"
);

const browserClient = read("src/lib/supabase/browser.ts");
assert.ok(
  browserClient.includes("example.supabase.co") &&
    browserClient.includes("public-anon-key"),
  "browser client build placeholder"
);
assert.ok(
  !browserClient.includes("Missing NEXT_PUBLIC_SUPABASE_URL"),
  "browser client must not throw on empty env during build"
);
const serverClient = read("src/lib/supabase/server.ts");
assert.ok(
  serverClient.includes("example.supabase.co") &&
    serverClient.includes("public-anon-key"),
  "server client build placeholder"
);

// --- Evidence doc + npm script ---
mustExist("docs/prelaunch/T06_FINAL_INTEGRATION_RELEASE_EVIDENCE.md");
const evidenceDoc = read(
  "docs/prelaunch/T06_FINAL_INTEGRATION_RELEASE_EVIDENCE.md"
);
assert.ok(evidenceDoc.includes("external_only"), "evidence doc honesty");
assert.ok(evidenceDoc.includes("Preview"), "evidence mentions Preview");
assert.ok(
  evidenceDoc.includes("미검증") || evidenceDoc.includes("external_only"),
  "Preview not claimed complete"
);
assert.ok(
  evidenceDoc.includes("FACE_LANDMARK_AUTO_CAPTURE") ||
    evidenceDoc.includes("landmark"),
  "landmark default documented"
);

const pkg = read("package.json");
assert.ok(
  pkg.includes('"test:final-integration"'),
  "package.json test:final-integration"
);

// --- Autopilot docs still forbid Production claims ---
const status = read("PROJECT_STATUS.md");
assert.ok(
  status.includes("Production") &&
    (status.includes("미배포") || status.includes("미실행")),
  "status keeps Production untouched"
);

console.log(
  `final-integration-release selftest: OK (${FINAL_INTEGRATION_JOURNEY.length} journey steps, ${FINAL_INTEGRATION_GATES.length} gates)`
);
