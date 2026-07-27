/**
 * Pure-logic assertions for the fixed-model identity check.
 * Offline: no network, no DB.
 */
import assert from "node:assert/strict";
import {
  AI_CONTENT_LABEL_KO,
  CLOSING_NOTICE_KO,
  IDENTITY_FEATURES,
  MIN_REFERENCES_PER_CHECK,
  evaluateIdentityCheck,
  hasEnoughReferences,
  videoOverlayRequirements,
  type FeatureCall,
  type IdentityFeature,
} from "../src/lib/media/modelIdentityCheck";

const REFS = [
  "ref-01-profile-right-updo.png",
  "ref-04-three-quarter-left-gaze-camera.png",
  "ref-07-front-neutral.png",
];

function allFeatures(call: FeatureCall): Partial<Record<IdentityFeature, FeatureCall>> {
  return Object.fromEntries(IDENTITY_FEATURES.map((f) => [f, call]));
}

// --- the clean pass ----------------------------------------------------------
const pass = evaluateIdentityCheck({
  referenceFiles: REFS,
  candidateLabel: "frame-004",
  features: allFeatures("match"),
});
assert.equal(pass.verdict, "pass", "all nine features matching is a pass");
assert.deepEqual(pass.reasonCodes, []);
assert.deepEqual(pass.missing, [], "nothing unassessed");

// --- a single mismatch fails -------------------------------------------------
const oneOff = evaluateIdentityCheck({
  referenceFiles: REFS,
  candidateLabel: "frame-011",
  features: { ...allFeatures("match"), 턱선: "mismatch" },
});
assert.equal(oneOff.verdict, "fail", "one mismatched feature fails the frame");
assert.deepEqual(oneOff.mismatched, ["턱선"]);
assert.ok(oneOff.reasonCodes.includes("feature_mismatch"));

// --- unclear is never a pass -------------------------------------------------
const blurry = evaluateIdentityCheck({
  referenceFiles: REFS,
  candidateLabel: "frame-020",
  features: { ...allFeatures("match"), 헤어라인: "unclear" },
});
assert.equal(
  blurry.verdict,
  "inconclusive",
  "a feature the reviewer could not judge does not pass"
);
assert.notEqual(blurry.verdict, "pass");
assert.deepEqual(blurry.unclear, ["헤어라인"]);

// --- unassessed features are not silently treated as fine --------------------
const partial = evaluateIdentityCheck({
  referenceFiles: REFS,
  candidateLabel: "frame-031",
  features: { 눈매: "match", "입술 모양": "match" } as Partial<
    Record<IdentityFeature, FeatureCall>
  >,
});
assert.equal(partial.verdict, "inconclusive", "an incomplete check cannot pass");
assert.equal(
  partial.missing.length,
  IDENTITY_FEATURES.length - 2,
  "every unrecorded feature is reported"
);
assert.ok(partial.reasonCodes.includes("feature_not_assessed"));

// --- forbidden drift outranks everything -------------------------------------
const drifted = evaluateIdentityCheck({
  referenceFiles: REFS,
  candidateLabel: "frame-042",
  features: allFeatures("match"),
  drift: ["턱을 지나치게 뾰족하게 만듦"],
});
assert.equal(
  drifted.verdict,
  "fail",
  "drift fails even when every feature was called a match — that is the exact failure the prompt guards against"
);
assert.ok(drifted.reasonCodes.includes("forbidden_drift"));
assert.deepEqual(drifted.drift, ["턱을 지나치게 뾰족하게 만듦"]);

// --- comparing against nothing is not a pass ---------------------------------
const noRefs = evaluateIdentityCheck({
  referenceFiles: [],
  candidateLabel: "frame-050",
  features: allFeatures("match"),
});
assert.equal(noRefs.verdict, "inconclusive", "a check with no reference is void");
assert.ok(noRefs.reasonCodes.includes("no_reference_compared"));

// --- no input can produce a pass by accident ---------------------------------
const outcomes = new Set<string>();
for (const call of ["match", "mismatch", "unclear"] as const) {
  for (const refs of [[], REFS]) {
    for (const drift of [[], ["눈을 과도하게 키움"] as const]) {
      outcomes.add(
        evaluateIdentityCheck({
          referenceFiles: refs,
          candidateLabel: "sweep",
          features: allFeatures(call),
          drift: drift as never,
        }).verdict
      );
    }
  }
}
assert.deepEqual(
  [...outcomes].sort(),
  ["fail", "inconclusive", "pass"],
  "all three verdicts reachable, and pass only from the clean combination"
);

// --- reference count ---------------------------------------------------------
assert.equal(MIN_REFERENCES_PER_CHECK, 3);
assert.equal(hasEnoughReferences(REFS), true);
assert.equal(
  hasEnoughReferences(["ref-07-front-neutral.png"]),
  false,
  "one reference is not enough across a set spanning profile to front"
);

// --- overlay text is fixed, not paraphrased ----------------------------------
assert.equal(CLOSING_NOTICE_KO, "이상 반응이 있으면 사용을 중단하세요.");
assert.ok(CLOSING_NOTICE_KO.length <= 30, "the closing notice stays one short line");
assert.equal(AI_CONTENT_LABEL_KO, "AI 생성 콘텐츠");
const overlay = videoOverlayRequirements();
assert.equal(overlay.aiLabelPersistent, true, "§36.3 label runs for the whole clip");
assert.equal(overlay.closingNotice, CLOSING_NOTICE_KO);

console.log("[model-identity-check] self-test: ok");
