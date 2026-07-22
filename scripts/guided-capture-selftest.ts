/**
 * Phase 3.0 guided camera capture — pure logic selftest.
 * No DB, no camera hardware, no fake face detection.
 */
import assert from "node:assert/strict";
import {
  assertProgressInvariant,
  canStartAnalyze,
  createInitialProgress,
  markCompleted,
  markFailed,
  shouldBlockDuplicateAnalyze,
  softProgressPercent,
  tickWaitingProgress,
  advanceLocalPhase,
  DELAY_HINT_NORMAL_MS,
  DELAY_HINT_SLOW_MS,
  delayHintForElapsed,
} from "../src/lib/analyze/guidedCapture/analysisProgress";
import {
  classifyGetUserMediaError,
  evaluateCameraSupport,
} from "../src/lib/analyze/guidedCapture/cameraSupport";
import {
  acceptShot,
  allRequiredShotsPassed,
  applyCameraUnavailable,
  applyPermissionDenied,
  beginCameraRequest,
  cancelSession,
  confirmReview,
  createEmptyCaptureSession,
  createRequestId,
  nextAngleAfter,
  primaryShotForAnalysis,
  retakeAngle,
  startCapturing,
} from "../src/lib/analyze/guidedCapture/captureSession";
import { isGuidedCameraCaptureEnabled } from "../src/lib/analyze/guidedCapture/isEnabled";
import { buildCapturedShot } from "../src/lib/analyze/guidedCapture/buildCapturedShot";
import {
  checkBrightnessVarianceAcrossShots,
  checkLocalPhotoQuality,
  sampleImageStatsFromRgba,
  QUALITY_LIMITS,
} from "../src/lib/analyze/guidedCapture/qualityCheck";
import { revokePreviewUrl, revokeAllShotUrls } from "../src/lib/analyze/guidedCapture/sessionCleanup";
import type { CapturedShot } from "../src/lib/analyze/guidedCapture/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
}

function makeRgba(
  w: number,
  h: number,
  rgb: [number, number, number]
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    out[i * 4] = rgb[0];
    out[i * 4 + 1] = rgb[1];
    out[i * 4 + 2] = rgb[2];
    out[i * 4 + 3] = 255;
  }
  return out;
}

function makeShot(
  angle: CapturedShot["angle"],
  overrides?: Partial<CapturedShot>
): CapturedShot {
  const base = buildCapturedShot({
    angle,
    previewUrl: "blob:test",
    usesObjectUrl: false,
    width: 800,
    height: 800,
    byteLength: 120_000,
    mimeType: "image/jpeg",
    brightnessMean: 120,
    sharpnessScore: 40,
    imageBase64: "abc",
    inputSource: "camera",
  });
  return { ...base, ...overrides };
}

console.log("[guided-capture] start");

// 1. Feature flag
ok(isGuidedCameraCaptureEnabled({}), "flag default on");
ok(isGuidedCameraCaptureEnabled({ NEXT_PUBLIC_GUIDED_CAMERA_CAPTURE: "1" }), "flag 1");
ok(
  !isGuidedCameraCaptureEnabled({ NEXT_PUBLIC_GUIDED_CAMERA_CAPTURE: "0" }),
  "flag 0 off"
);

// 2. Camera support
ok(
  evaluateCameraSupport({
    isSecureContext: true,
    hasMediaDevices: true,
    hasGetUserMedia: true,
  }).supported,
  "camera supported"
);
ok(
  !evaluateCameraSupport({
    isSecureContext: false,
    hasMediaDevices: true,
    hasGetUserMedia: true,
  }).supported,
  "insecure fallback"
);
ok(
  !evaluateCameraSupport({
    isSecureContext: true,
    hasMediaDevices: false,
    hasGetUserMedia: false,
  }).supported,
  "no mediaDevices"
);

// 3. Permission deny classify
ok(
  classifyGetUserMediaError({ name: "NotAllowedError" }) === "denied",
  "permission denied"
);
ok(
  classifyGetUserMediaError({ name: "NotFoundError" }) === "unavailable",
  "camera unavailable"
);

// 4–7. Capture order + retake failed only
let session = createEmptyCaptureSession();
session = startCapturing(beginCameraRequest(session), "front");
ok(session.state === "capturing_front", "start front");
session = acceptShot(session, makeShot("front"));
ok(session.state === "reviewing_front", "review front");
session = confirmReview(session, "front");
ok(session.state === "capturing_left", "next left");
ok(nextAngleAfter("front") === "left45", "angle order");
session = acceptShot(session, makeShot("left45"));
session = confirmReview(session, "left45");
ok(session.state === "capturing_right", "next right");
session = acceptShot(session, makeShot("right45"));
session = confirmReview(session, "right45");
ok(session.state === "ready_for_analysis", "ready");
ok(allRequiredShotsPassed(session), "all passed");
ok(primaryShotForAnalysis(session)?.angle === "front", "primary front");

const failed = makeShot("left45", {
  qualityStatus: "fail",
  qualityReasons: ["too_dark", "pose_check_unavailable"],
});
session = retakeAngle(session, "left45");
ok(session.state === "capturing_left", "retake left only");
ok(!!session.shots.front, "front kept");
ok(!session.shots.left45, "left cleared");
ok(!!session.shots.right45, "right kept");
session = acceptShot(session, failed);
ok(session.state === "quality_failed", "quality failed state");
ok(session.failedAngle === "left45", "failed angle left");

// Gallery / manual / cancel paths
ok(
  applyPermissionDenied(createEmptyCaptureSession()).state ===
    "permission_denied",
  "permission_denied state"
);
ok(
  applyCameraUnavailable(createEmptyCaptureSession()).state ===
    "camera_unavailable",
  "camera_unavailable state"
);
ok(cancelSession(session).state === "canceled", "canceled");

// 8–9. Resolution / dark
const lowRes = checkLocalPhotoQuality({
  mimeType: "image/jpeg",
  byteLength: 1000,
  width: 100,
  height: 100,
  brightnessMean: 120,
  sharpnessScore: 40,
});
ok(!lowRes.ok && lowRes.reasons.includes("resolution_too_low"), "low res");

const dark = checkLocalPhotoQuality({
  mimeType: "image/jpeg",
  byteLength: 1000,
  width: 800,
  height: 800,
  brightnessMean: 10,
  sharpnessScore: 40,
});
ok(!dark.ok && dark.reasons.includes("too_dark"), "too dark");

const darkRgba = makeRgba(32, 32, [8, 8, 8]);
const darkStats = sampleImageStatsFromRgba(darkRgba, 32, 32, 2);
ok(darkStats.brightnessMean < QUALITY_LIMITS.darkThreshold, "sample dark");

const brightVar = checkBrightnessVarianceAcrossShots([40, 180]);
ok(brightVar === "brightness_variance_high", "brightness variance");

// Pose never auto-pass as face detection
ok(
  checkLocalPhotoQuality({
    mimeType: "image/jpeg",
    byteLength: 1000,
    width: 800,
    height: 800,
    brightnessMean: 120,
    sharpnessScore: 40,
  }).reasons.includes("pose_check_unavailable"),
  "pose unavailable explicit"
);

// Unsupported format
ok(
  checkLocalPhotoQuality({
    mimeType: "image/bmp",
    byteLength: 1000,
    width: 800,
    height: 800,
    brightnessMean: 120,
    sharpnessScore: 40,
  }).reasons.includes("unsupported_format"),
  "bmp unsupported"
);

// 10. Object URL cleanup is no-throw with usesObjectUrl false
revokePreviewUrl(makeShot("front"));
revokeAllShotUrls({ front: makeShot("front") });

// 11–15. Progress + timeout + retry guards
ok(softProgressPercent(500) < 20, "progress early");
ok(softProgressPercent(5_000) >= 20 && softProgressPercent(5_000) < 75, "mid");
ok(softProgressPercent(20_000) >= 75 && softProgressPercent(20_000) <= 90, "late");
ok(softProgressPercent(80_000) === 90, "cap 90");

let prog = createInitialProgress("req-1");
ok(assertProgressInvariant(prog), "initial invariant");
prog = tickWaitingProgress(prog, 5_000);
ok(prog.percent < 100, "no premature 100");
ok(assertProgressInvariant(prog), "tick invariant");
prog = advanceLocalPhase(prog, "analyzing", 5_000);
ok(!prog.completedPhases.includes("analyzing"), "current not completed yet");
ok(prog.completedPhases.includes("preparing"), "prior phase completed");
const done = markCompleted(prog, [...prog.completedPhases, "saving_result"]);
ok(done.percent === 100 && done.phase === "completed", "100 only on complete");
const timed = markFailed(prog, "timed_out");
ok(timed.phase === "timed_out" && timed.percent < 100, "timeout <100");
ok(delayHintForElapsed(DELAY_HINT_NORMAL_MS) === "normal", "delay normal");
ok(delayHintForElapsed(DELAY_HINT_SLOW_MS) === "slow", "delay slow");

ok(shouldBlockDuplicateAnalyze({ inFlight: true }), "block duplicate");
ok(!shouldBlockDuplicateAnalyze({ inFlight: false }), "allow when idle");
ok(canStartAnalyze({ inFlight: false }), "can start");
ok(!canStartAnalyze({ inFlight: true }), "cannot start in flight");

ok(typeof createRequestId() === "string", "requestId");

// buildCapturedShot pose does not alone fail
const passShot = makeShot("front");
ok(passShot.qualityStatus === "pass", "shot pass without fake pose");
ok(
  passShot.qualityReasons.includes("pose_check_unavailable"),
  "pose reason present"
);

console.log("[guided-capture] passed");
