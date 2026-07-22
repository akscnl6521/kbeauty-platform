/**
 * Phase 3.1.1 alignment fix — pure logic selftest.
 * Cover transform, soft features, glasses tolerance, no fake aligned.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  evaluateAlignment,
  alignmentStatusMessageKo,
  primaryGuidanceMessage,
} from "../src/lib/analyze/guidedCapture/landmark/alignmentEngine";
import {
  COUNTDOWN_STEP_MS,
  createAutoCaptureState,
  resetAutoCaptureForNewAngle,
  tickAutoCapture,
} from "../src/lib/analyze/guidedCapture/landmark/autoCaptureMachine";
import {
  computeCoverTransform,
  toFaceRelative,
  videoBoundsToDisplayBounds,
  videoNormToDisplayNorm,
} from "../src/lib/analyze/guidedCapture/landmark/displaySpace";
import {
  isCaptureVoiceCountdownEnabled,
  isFaceLandmarkAutoCaptureEnabled,
  FACE_LANDMARKER_MODEL_PATH,
  FACE_LANDMARKER_WASM_PATH,
} from "../src/lib/analyze/guidedCapture/landmark/isEnabled";
import { eulerFromColumnMajor4x4, mirrorNormX } from "../src/lib/analyze/guidedCapture/landmark/poseMath";
import { templateForAngle, CAPTURE_TEMPLATES } from "../src/lib/analyze/guidedCapture/landmark/templates";
import type { LandmarkSnapshot } from "../src/lib/analyze/guidedCapture/landmark/types";
import {
  alignmentStatusMessage,
  countdownUtterance,
  detectSpeechSupport,
  holdStillUtterance,
  resolveCaptureVoiceLocale,
  speechLangForLocale,
} from "../src/lib/analyze/guidedCapture/landmark/voiceMessages";
import { isGalleryAllowedForGeneralUsers } from "../src/lib/analyze/guidedCapture/inputPolicy";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
}

function makeAlignedFront(): LandmarkSnapshot {
  return {
    faceCount: 1,
    leftEyeCenter: { x: 0.36, y: 0.4 },
    rightEyeCenter: { x: 0.64, y: 0.4 },
    noseTip: { x: 0.5, y: 0.55 },
    mouthCenter: { x: 0.5, y: 0.68 },
    chinTip: { x: 0.5, y: 0.84 },
    // height ≈ 0.58 (within 0.42–0.78), center ≈ (0.5, 0.51)
    faceBounds: { xMin: 0.28, yMin: 0.22, xMax: 0.72, yMax: 0.8 },
    yaw: 0,
    pitch: 0,
    roll: 0,
    detectionConfidence: 0.9,
    inferenceTimestamp: 1000,
    inferenceDurationMs: 20,
  };
}

function run() {
  ok(isFaceLandmarkAutoCaptureEnabled({}), "landmark flag default on");
  ok(
    !isFaceLandmarkAutoCaptureEnabled({
      NEXT_PUBLIC_FACE_LANDMARK_AUTO_CAPTURE: "0",
    }),
    "landmark flag off"
  );
  ok(isCaptureVoiceCountdownEnabled({}), "voice flag default on");

  ok(CAPTURE_TEMPLATES.front_template_v1.softFeaturesOnly, "soft features");
  ok(templateForAngle("front").yawDeg.min <= -20, "wide yaw");
  ok(templateForAngle("front").faceHeight.min <= 0.45, "face height min");

  // Cover transform: square video in taller display → vertical crop
  const m = {
    videoWidth: 480,
    videoHeight: 640,
    clientWidth: 375,
    clientHeight: 500,
    mirrorX: false,
  };
  const t = computeCoverTransform(m);
  ok(t.ok && t.scale > 0, "cover transform ok");
  const mid = videoNormToDisplayNorm({ x: 0.5, y: 0.5 }, m);
  ok(Math.abs(mid.x - 0.5) < 0.02, "center x maps ~0.5");
  ok(Math.abs(mid.y - 0.5) < 0.05, "center y maps ~0.5");

  const mirrored = videoNormToDisplayNorm(
    { x: 0.25, y: 0.5 },
    { ...m, mirrorX: true }
  );
  ok(mirrored.x > 0.7, "mirror flips x");

  const db = videoBoundsToDisplayBounds(
    { xMin: 0.2, yMin: 0.2, xMax: 0.8, yMax: 0.8 },
    m
  );
  ok(db.xMin < db.xMax && db.yMin < db.yMax, "bounds transform");

  const rel = toFaceRelative(
    { x: 0.5, y: 0.5 },
    { xMin: 0.25, yMin: 0.25, xMax: 0.75, yMax: 0.75 }
  );
  ok(rel && Math.abs(rel.x - 0.5) < 1e-6 && Math.abs(rel.y - 0.5) < 1e-6, "relative");

  const e0 = eulerFromColumnMajor4x4([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ]);
  ok(Math.abs(e0.yaw) < 1e-6, "identity euler");
  ok(mirrorNormX(0.2) === 0.8, "mirrorNormX");

  const front = templateForAngle("front");
  ok(
    evaluateAlignment({ snapshot: null, template: front }).status === "no_face",
    "null → no_face"
  );
  ok(
    evaluateAlignment({
      snapshot: { ...makeAlignedFront(), faceCount: 2 },
      template: front,
    }).status === "multiple_faces",
    "multiple"
  );

  const aligned = evaluateAlignment({
    snapshot: makeAlignedFront(),
    template: front,
  });
  ok(aligned.status === "aligned", "front aligned");
  ok(Array.isArray(aligned.softWarnings), "softWarnings array");

  ok(
    evaluateAlignment({
      snapshot: { ...makeAlignedFront(), yaw: null, roll: null },
      template: front,
    }).status !== "aligned",
    "no fake aligned without pose"
  );

  // Small face → move closer (height)
  ok(
    evaluateAlignment({
      snapshot: {
        ...makeAlignedFront(),
        faceBounds: { xMin: 0.4, yMin: 0.4, xMax: 0.55, yMax: 0.55 },
      },
      template: front,
    }).status === "move_closer",
    "small face"
  );

  ok(
    evaluateAlignment({
      snapshot: { ...makeAlignedFront(), yaw: -40 },
      template: front,
    }).status === "rotate_right",
    "yaw hard"
  );

  // Pitch soft on front — does not block aligned
  const pitchSoft = evaluateAlignment({
    snapshot: { ...makeAlignedFront(), pitch: 28 },
    template: front,
  });
  ok(pitchSoft.status === "aligned", "pitch soft still aligned");
  ok(pitchSoft.softWarnings.includes("pitch_soft"), "pitch soft warning");

  // Glasses: missing eyes — still aligned via bounds+nose+pose
  const glasses = evaluateAlignment({
    snapshot: {
      ...makeAlignedFront(),
      leftEyeCenter: null,
      rightEyeCenter: null,
    },
    template: front,
  });
  ok(glasses.status === "aligned", "glasses eyes missing still aligned");
  ok(
    glasses.softWarnings.includes("eyes_missing_or_low_confidence"),
    "glasses soft warn"
  );

  // Eye absolute mismatch must NOT block when soft (relative check may warn)
  const eyeOff = evaluateAlignment({
    snapshot: {
      ...makeAlignedFront(),
      leftEyeCenter: { x: 0.3, y: 0.25 },
      rightEyeCenter: { x: 0.7, y: 0.25 },
    },
    template: front,
  });
  ok(eyeOff.status === "aligned", "soft eyes do not block");

  ok(
    evaluateAlignment({
      snapshot: makeAlignedFront(),
      template: front,
      quality: { brightnessMean: 10 },
    }).status === "too_dark",
    "too dark"
  );

  // Left / right 45
  const leftSnap: LandmarkSnapshot = {
    ...makeAlignedFront(),
    yaw: -35,
    faceBounds: { xMin: 0.22, yMin: 0.2, xMax: 0.65, yMax: 0.8 },
    leftEyeCenter: { x: 0.32, y: 0.38 },
    rightEyeCenter: { x: 0.52, y: 0.38 },
    noseTip: { x: 0.42, y: 0.54 },
  };
  ok(
    evaluateAlignment({
      snapshot: leftSnap,
      template: templateForAngle("left45"),
    }).status === "aligned",
    "left45 aligned"
  );
  const rightSnap: LandmarkSnapshot = {
    ...makeAlignedFront(),
    yaw: 35,
    faceBounds: { xMin: 0.35, yMin: 0.2, xMax: 0.78, yMax: 0.8 },
    leftEyeCenter: { x: 0.48, y: 0.38 },
    rightEyeCenter: { x: 0.68, y: 0.38 },
    noseTip: { x: 0.58, y: 0.54 },
  };
  ok(
    evaluateAlignment({
      snapshot: rightSnap,
      template: templateForAngle("right45"),
    }).status === "aligned",
    "right45 aligned"
  );

  ok(
    primaryGuidanceMessage("aligned", ["eye_box"]).includes("거의"),
    "almost message"
  );
  ok(
    primaryGuidanceMessage("rotate_left", [], "front").includes("정면"),
    "front rotate → face forward"
  );

  // Auto-capture machine
  let mState = createAutoCaptureState();
  let r = tickAutoCapture(mState, {
    nowMs: 0,
    alignmentStatus: "aligned",
    stableHoldMs: 1000,
  });
  ok(r.state.phase === "ready" && r.speakHoldStill, "ready");
  r = tickAutoCapture(r.state, {
    nowMs: 1000 + COUNTDOWN_STEP_MS * 3,
    alignmentStatus: "aligned",
    stableHoldMs: 1000,
  });
  ok(r.shouldCapture && r.state.capturedForAngle, "capture once");
  ok(
    !tickAutoCapture(r.state, {
      nowMs: 9000,
      alignmentStatus: "aligned",
      stableHoldMs: 1000,
    }).shouldCapture,
    "no duplicate"
  );
  ok(resetAutoCaptureForNewAngle(r.state).phase === "adjusting", "reset angle");

  // Cancel mid countdown
  mState = createAutoCaptureState();
  r = tickAutoCapture(mState, {
    nowMs: 0,
    alignmentStatus: "aligned",
    stableHoldMs: 1000,
  });
  r = tickAutoCapture(r.state, {
    nowMs: 1100,
    alignmentStatus: "aligned",
    stableHoldMs: 1000,
  });
  ok(r.state.phase === "countdown", "countdown");
  const cancel = tickAutoCapture(r.state, {
    nowMs: 1200,
    alignmentStatus: "move_left",
    stableHoldMs: 1000,
  });
  ok(cancel.shouldCancelSpeech && cancel.state.phase === "adjusting", "cancel");

  ok(resolveCaptureVoiceLocale("fr-FR") === "en", "locale fallback");
  ok(countdownUtterance("ko", 3) === "셋", "ko 3");
  ok(holdStillUtterance("ko").includes("거의"), "hold ko");
  ok(speechLangForLocale("ja") === "ja-JP", "ja lang");
  ok(
    alignmentStatusMessage(
      "en",
      "move_farther",
      alignmentStatusMessageKo("move_farther")
    ).length > 0,
    "en msg"
  );
  ok(!detectSpeechSupport(null).supported, "no speech");
  ok(!isGalleryAllowedForGeneralUsers(), "no gallery");

  const root = path.resolve(__dirname, "..");
  const modelFs = path.join(
    root,
    "public",
    FACE_LANDMARKER_MODEL_PATH.replace(/^\//, "")
  );
  ok(existsSync(modelFs) && statSync(modelFs).size > 1_000_000, "model asset");
  ok(
    existsSync(
      path.join(root, "public", FACE_LANDMARKER_WASM_PATH.replace(/^\//, ""))
    ),
    "wasm dir"
  );

  const panelSrc = readFileSync(
    path.join(
      root,
      "src/components/analyze/guidedCapture/CameraCapturePanel.tsx"
    ),
    "utf8"
  );
  const overlaySrc = readFileSync(
    path.join(
      root,
      "src/components/analyze/guidedCapture/FaceGuideOverlay.tsx"
    ),
    "utf8"
  );
  ok(!/type=["']file["']/.test(panelSrc), "no file input");
  ok(overlaySrc.includes("liveBounds"), "live bounds guide");
  ok(panelSrc.includes("displaySpace") || panelSrc.includes("debugOn"), "debug");

  const nextCfg = readFileSync(path.join(root, "next.config.ts"), "utf8");
  ok(nextCfg.includes("wasm-unsafe-eval"), "csp wasm");
  ok(nextCfg.includes("camera=(self)"), "camera permission");

  console.log("guided-landmark-selftest: OK");
}

run();
