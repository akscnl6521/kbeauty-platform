/**
 * Phase 3.1 face landmark auto-capture — pure logic selftest.
 * No camera hardware, no fake aligned without snapshot, no Storage/DB.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  evaluateAlignment,
  alignmentStatusMessageKo,
} from "../src/lib/analyze/guidedCapture/landmark/alignmentEngine";
import {
  COUNTDOWN_STEP_MS,
  createAutoCaptureState,
  resetAutoCaptureForNewAngle,
  tickAutoCapture,
} from "../src/lib/analyze/guidedCapture/landmark/autoCaptureMachine";
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
    noseTip: { x: 0.5, y: 0.52 },
    mouthCenter: { x: 0.5, y: 0.66 },
    chinTip: { x: 0.5, y: 0.82 },
    faceBounds: { xMin: 0.28, yMin: 0.22, xMax: 0.72, yMax: 0.88 },
    yaw: 0,
    pitch: 0,
    roll: 0,
    detectionConfidence: 0.9,
    inferenceTimestamp: 1000,
    inferenceDurationMs: 20,
  };
}

function run() {
  // Flags default ON
  ok(isFaceLandmarkAutoCaptureEnabled({}), "landmark flag default on");
  ok(
    !isFaceLandmarkAutoCaptureEnabled({ NEXT_PUBLIC_FACE_LANDMARK_AUTO_CAPTURE: "0" }),
    "landmark flag off"
  );
  ok(isCaptureVoiceCountdownEnabled({}), "voice flag default on");
  ok(
    !isCaptureVoiceCountdownEnabled({ NEXT_PUBLIC_CAPTURE_VOICE_COUNTDOWN: "false" }),
    "voice flag off"
  );

  // Templates
  ok(CAPTURE_TEMPLATES.front_template_v1.id === "front_template_v1", "front id");
  ok(templateForAngle("left45").id === "left_45_template_v1", "left template");
  ok(templateForAngle("right45").id === "right_45_template_v1", "right template");
  ok(templateForAngle("front").stableHoldMs === 1000, "hold 1s");

  // Pose math
  const identity = [
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ];
  const e0 = eulerFromColumnMajor4x4(identity);
  ok(Math.abs(e0.yaw) < 1e-6 && Math.abs(e0.pitch) < 1e-6, "identity euler");
  ok(mirrorNormX(0.2) === 0.8, "mirror x");

  // Alignment: no face / multiple / aligned
  const front = templateForAngle("front");
  ok(
    evaluateAlignment({ snapshot: null, template: front }).status === "no_face",
    "null snapshot no_face"
  );
  ok(
    evaluateAlignment({
      snapshot: { ...makeAlignedFront(), faceCount: 0 },
      template: front,
    }).status === "no_face",
    "faceCount 0"
  );
  ok(
    evaluateAlignment({
      snapshot: { ...makeAlignedFront(), faceCount: 2 },
      template: front,
    }).status === "multiple_faces",
    "multiple faces"
  );
  ok(
    evaluateAlignment({ snapshot: makeAlignedFront(), template: front }).status ===
      "aligned",
    "front aligned"
  );
  ok(
    evaluateAlignment({
      snapshot: { ...makeAlignedFront(), yaw: null },
      template: front,
    }).status !== "aligned",
    "no fake aligned without yaw"
  );
  ok(
    evaluateAlignment({
      snapshot: { ...makeAlignedFront(), faceBounds: { xMin: 0.1, yMin: 0.2, xMax: 0.3, yMax: 0.5 } },
      template: front,
    }).status === "move_closer",
    "move closer"
  );
  ok(
    evaluateAlignment({
      snapshot: { ...makeAlignedFront(), yaw: -40 },
      template: front,
    }).status === "rotate_right",
    "yaw rotate"
  );
  ok(
    evaluateAlignment({
      snapshot: { ...makeAlignedFront(), pitch: 30 },
      template: front,
    }).status === "tilt_down",
    "pitch"
  );
  ok(
    evaluateAlignment({
      snapshot: { ...makeAlignedFront(), roll: 25 },
      template: front,
    }).status === "level_head",
    "roll"
  );
  ok(
    evaluateAlignment({
      snapshot: makeAlignedFront(),
      template: front,
      quality: { brightnessMean: 10 },
    }).status === "too_dark",
    "too dark"
  );
  ok(
    evaluateAlignment({
      snapshot: makeAlignedFront(),
      template: front,
      quality: { brightnessMean: 128, sharpnessScore: 2 },
    }).status === "too_blurry",
    "too blurry"
  );

  // Left / right templates
  const leftSnap: LandmarkSnapshot = {
    ...makeAlignedFront(),
    yaw: -40,
    leftEyeCenter: { x: 0.32, y: 0.38 },
    rightEyeCenter: { x: 0.52, y: 0.38 },
    noseTip: { x: 0.42, y: 0.54 },
    mouthCenter: { x: 0.43, y: 0.66 },
    chinTip: { x: 0.45, y: 0.82 },
    faceBounds: { xMin: 0.24, yMin: 0.2, xMax: 0.66, yMax: 0.88 },
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
    yaw: 40,
    leftEyeCenter: { x: 0.48, y: 0.38 },
    rightEyeCenter: { x: 0.68, y: 0.38 },
    noseTip: { x: 0.58, y: 0.54 },
    mouthCenter: { x: 0.57, y: 0.66 },
    chinTip: { x: 0.55, y: 0.82 },
    faceBounds: { xMin: 0.34, yMin: 0.2, xMax: 0.76, yMax: 0.88 },
  };
  ok(
    evaluateAlignment({
      snapshot: rightSnap,
      template: templateForAngle("right45"),
    }).status === "aligned",
    "right45 aligned"
  );

  // Auto-capture machine: hold → countdown → capture once; cancel
  let m = createAutoCaptureState();
  let t0 = 0;
  let r = tickAutoCapture(m, {
    nowMs: t0,
    alignmentStatus: "no_face",
    stableHoldMs: 1000,
  });
  ok(r.state.phase === "adjusting", "adjusting");
  ok(!r.shouldCapture, "no capture yet");

  r = tickAutoCapture(r.state, {
    nowMs: 100,
    alignmentStatus: "aligned",
    stableHoldMs: 1000,
  });
  ok(r.state.phase === "ready" && r.speakHoldStill, "ready + hold speech");

  r = tickAutoCapture(r.state, {
    nowMs: 100 + 1000,
    alignmentStatus: "aligned",
    stableHoldMs: 1000,
  });
  ok(r.state.phase === "countdown" && r.speakDigit === 3, "countdown 3");

  r = tickAutoCapture(r.state, {
    nowMs: 100 + 1000 + COUNTDOWN_STEP_MS,
    alignmentStatus: "aligned",
    stableHoldMs: 1000,
  });
  ok(r.speakDigit === 2, "countdown 2");

  r = tickAutoCapture(r.state, {
    nowMs: 100 + 1000 + COUNTDOWN_STEP_MS * 2,
    alignmentStatus: "aligned",
    stableHoldMs: 1000,
  });
  ok(r.speakDigit === 1, "countdown 1");

  // cancel mid-countdown
  const mid = tickAutoCapture(r.state, {
    nowMs: 100 + 1000 + COUNTDOWN_STEP_MS * 2 + 100,
    alignmentStatus: "move_left",
    stableHoldMs: 1000,
  });
  ok(mid.state.phase === "adjusting" && mid.shouldCancelSpeech, "cancel speech");
  ok(!mid.shouldCapture, "no capture on cancel");

  // full countdown to capture
  m = createAutoCaptureState();
  r = tickAutoCapture(m, {
    nowMs: 0,
    alignmentStatus: "aligned",
    stableHoldMs: 1000,
  });
  r = tickAutoCapture(r.state, {
    nowMs: 1000 + COUNTDOWN_STEP_MS * 3,
    alignmentStatus: "aligned",
    stableHoldMs: 1000,
  });
  ok(r.shouldCapture && r.state.capturedForAngle, "capture once");
  const again = tickAutoCapture(r.state, {
    nowMs: 5000,
    alignmentStatus: "aligned",
    stableHoldMs: 1000,
  });
  ok(!again.shouldCapture, "no duplicate capture");

  const reset = resetAutoCaptureForNewAngle(r.state);
  ok(!reset.capturedForAngle && reset.phase === "adjusting", "reset angle");

  // Voice locales
  ok(resolveCaptureVoiceLocale("ko-KR") === "ko", "ko");
  ok(resolveCaptureVoiceLocale("en-US") === "en", "en");
  ok(resolveCaptureVoiceLocale("ja") === "ja", "ja");
  ok(resolveCaptureVoiceLocale("zh-CN") === "zh-CN", "zh");
  ok(resolveCaptureVoiceLocale("es-MX") === "es", "es");
  ok(resolveCaptureVoiceLocale("fr-FR") === "en", "fallback en");
  ok(countdownUtterance("ko", 3) === "셋", "ko 3");
  ok(countdownUtterance("en", 2) === "Two", "en 2");
  ok(countdownUtterance("ja", 1) === "いち", "ja 1");
  ok(countdownUtterance("zh-CN", 3) === "三", "zh 3");
  ok(countdownUtterance("es", 1) === "Uno", "es 1");
  ok(holdStillUtterance("en").includes("Hold"), "hold en");
  ok(speechLangForLocale("ko") === "ko-KR", "speech lang");
  ok(
    alignmentStatusMessage("en", "move_left", alignmentStatusMessageKo("move_left")).includes(
      "left"
    ),
    "en status msg"
  );
  ok(!detectSpeechSupport(null).supported, "no speech without window");

  // Gallery forbidden
  ok(!isGalleryAllowedForGeneralUsers(), "no gallery");

  // Assets present (same-origin)
  const root = path.resolve(__dirname, "..");
  const modelFs = path.join(root, "public", FACE_LANDMARKER_MODEL_PATH.replace(/^\//, ""));
  const wasmDir = path.join(root, "public", FACE_LANDMARKER_WASM_PATH.replace(/^\//, ""));
  ok(existsSync(modelFs), `model exists at ${modelFs}`);
  ok(statSync(modelFs).size > 1_000_000, "model size >1MB");
  ok(existsSync(wasmDir), "wasm dir exists");

  // UI must not expose gallery file input on analyze guided flow
  const flowSrc = readFileSync(
    path.join(root, "src/components/analyze/guidedCapture/GuidedCaptureFlow.tsx"),
    "utf8"
  );
  const panelSrc = readFileSync(
    path.join(root, "src/components/analyze/guidedCapture/CameraCapturePanel.tsx"),
    "utf8"
  );
  const analyzeSrc = readFileSync(
    path.join(root, "src/app/analyze/page.tsx"),
    "utf8"
  );
  ok(!/type=["']file["']/.test(flowSrc), "flow no file input");
  ok(!/type=["']file["']/.test(panelSrc), "panel no file input");
  ok(!/\bcapture=/.test(flowSrc + panelSrc), "no capture= file input");
  ok(!/갤러리에서/.test(flowSrc + panelSrc), "no gallery CTA");
  ok(analyzeSrc.includes("갤러리 사진은 분석에 사용하지 않습니다"), "policy copy");

  // CSP allows wasm
  const nextCfg = readFileSync(path.join(root, "next.config.ts"), "utf8");
  ok(nextCfg.includes("wasm-unsafe-eval"), "csp wasm");
  ok(nextCfg.includes("camera=(self)"), "permissions camera self");
  ok(nextCfg.includes("worker-src"), "worker-src");

  console.log("guided-landmark-selftest: OK");
}

run();
