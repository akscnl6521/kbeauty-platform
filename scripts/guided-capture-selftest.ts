/**
 * Phase 3.0 guided camera capture — pure logic selftest.
 * No DB, no camera hardware, no fake face detection.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
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
  applyCameraStartFailed,
  applyCameraUnavailable,
  applyPermissionDenied,
  applyVideoPlayFailed,
  beginCameraRequest,
  beginPermissionRequest,
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
import {
  attachStreamAndPlay,
  CAMERA_STARTUP_TIMEOUT_MS,
  classifyCameraStartFailure,
  fallbackVideoConstraints,
  isDuplicateCameraRequest,
  preferredVideoConstraints,
  shouldRetryWithFallbackConstraints,
  stopStreamIfOwned,
  waitForVideoElement,
} from "../src/lib/analyze/guidedCapture/cameraStart";
import { isCameraDiagnosticsEnabled } from "../src/lib/analyze/guidedCapture/cameraDiagnostics";
import {
  ANALYSIS_SCOPE_COPY_KO,
  CAMERA_ONLY_POLICY_COPY_KO,
  isGalleryAllowedForGeneralUsers,
  isUserFacingInputSource,
  USER_FACING_INPUT_SOURCES,
} from "../src/lib/analyze/guidedCapture/inputPolicy";
import {
  isCaptureVoiceCountdownEnabled,
  isFaceLandmarkAutoCaptureEnabled,
} from "../src/lib/analyze/guidedCapture/landmark/isEnabled";
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

// --- Phase 3.0.1 camera start stabilisation ---
ok(CAMERA_STARTUP_TIMEOUT_MS === 5_000, "startup timeout 5s");
ok(
  preferredVideoConstraints("user").video &&
    typeof preferredVideoConstraints("user").video === "object",
  "preferred constraints"
);
ok(fallbackVideoConstraints().video === true, "fallback video true");
ok(
  shouldRetryWithFallbackConstraints({ name: "OverconstrainedError" }),
  "overconstrained retry"
);
ok(
  !shouldRetryWithFallbackConstraints({ name: "NotAllowedError" }),
  "denied no constraint retry"
);

ok(
  classifyCameraStartFailure({ name: "NotAllowedError" }, "getUserMedia") ===
    "permission_denied",
  "denied classify"
);
ok(
  classifyCameraStartFailure({ name: "NotReadableError" }, "getUserMedia") ===
    "camera_unavailable",
  "unavailable classify"
);
ok(
  classifyCameraStartFailure(new Error("x"), "play") === "video_play_failed",
  "play fail classify"
);
ok(
  classifyCameraStartFailure(new Error("x"), "timeout") === "startup_timeout",
  "timeout classify"
);
ok(
  classifyCameraStartFailure(new Error("x"), "getUserMedia") ===
    "camera_start_failed",
  "generic start fail — not permission_denied"
);

const fakeTrack = {
  stopCalls: 0,
  stop() {
    this.stopCalls += 1;
  },
  readyState: "live",
};
const streamA = {
  id: "a",
  active: true,
  getTracks: () => [fakeTrack],
} as unknown as MediaStream;
const streamB = {
  id: "b",
  active: true,
  getTracks: () => [fakeTrack],
} as unknown as MediaStream;
ok(!stopStreamIfOwned(streamA, streamB), "different identity not stopped");
ok(stopStreamIfOwned(streamA, streamA), "same identity stopped");
ok(fakeTrack.stopCalls === 1, "track.stop once");

ok(isDuplicateCameraRequest({ inFlight: true }), "duplicate camera request");
ok(!isDuplicateCameraRequest({ inFlight: false }), "camera request allowed");

let cam = beginPermissionRequest();
ok(cam.state === "requesting_permission", "requesting_permission first");
cam = startCapturing(cam, "front");
ok(cam.state === "capturing_front", "live → capturing_front");
ok(applyCameraStartFailed(cam).state === "camera_start_failed", "start failed");
ok(applyVideoPlayFailed(cam).state === "video_play_failed", "play failed state");

ok(
  isCameraDiagnosticsEnabled({ NODE_ENV: "development" }),
  "diag on in development"
);
ok(
  !isCameraDiagnosticsEnabled({
    NODE_ENV: "production",
    VERCEL_ENV: "production",
  }),
  "diag off in production"
);
ok(
  isCameraDiagnosticsEnabled({
    NODE_ENV: "production",
    VERCEL_ENV: "preview",
  }),
  "diag on in preview"
);

ok(!isGalleryAllowedForGeneralUsers(), "gallery forbidden for general users");

// Phase 3.1 deferred: default manual capture (landmark flag OFF)
ok(!isFaceLandmarkAutoCaptureEnabled({}), "landmark default OFF");
ok(
  !isFaceLandmarkAutoCaptureEnabled({
    NEXT_PUBLIC_FACE_LANDMARK_AUTO_CAPTURE: "0",
  }),
  "landmark flag=0 → manual"
);
ok(
  isFaceLandmarkAutoCaptureEnabled({
    NEXT_PUBLIC_FACE_LANDMARK_AUTO_CAPTURE: "1",
  }),
  "landmark flag=1 → auto entry"
);
ok(
  !isCaptureVoiceCountdownEnabled({
    NEXT_PUBLIC_CAPTURE_VOICE_COUNTDOWN: "1",
  }),
  "voice requires landmark flag"
);
ok(isUserFacingInputSource("camera"), "camera user-facing");
ok(isUserFacingInputSource("questionnaire_only"), "questionnaire user-facing");
ok(!isUserFacingInputSource("gallery"), "gallery not user-facing");
ok(
  USER_FACING_INPUT_SOURCES.join(",") === "camera,questionnaire_only",
  "only two user sources"
);
ok(
  CAMERA_ONLY_POLICY_COPY_KO.noGallery.includes("갤러리"),
  "policy copy mentions no gallery"
);
ok(
  ANALYSIS_SCOPE_COPY_KO.noExternalVision.includes("외부 AI"),
  "scope copy denies external AI pixels"
);
ok(
  ANALYSIS_SCOPE_COPY_KO.consentAnalysisLabel.includes("문진"),
  "consent labels questionnaire-based guide"
);

const flowSrc = readFileSync(
  path.join(
    process.cwd(),
    "src/components/analyze/guidedCapture/GuidedCaptureFlow.tsx"
  ),
  "utf8"
);
ok(!/갤러리에서 가져오기/.test(flowSrc), "no gallery button label in flow UI");
ok(!/type=\"file\"/.test(flowSrc), "no file input in guided flow");
ok(!/galleryInputRef/.test(flowSrc), "no gallery input ref");
ok(
  /data-testid=\"analyze-camera-start\"/.test(flowSrc),
  "camera start test id"
);
ok(
  /data-testid=\"analyze-questionnaire-only\"/.test(flowSrc),
  "questionnaire test id"
);
ok(!/openGalleryFallback/.test(flowSrc), "no gallery fallback helper");
ok(
  /ANALYSIS_SCOPE_COPY_KO/.test(flowSrc),
  "guided flow uses honest analysis scope copy"
);
ok(
  /dynamic<CameraCapturePanelProps>/.test(flowSrc) &&
    /import\("\.\/CameraCapturePanel"\)/.test(flowSrc),
  "camera and landmark implementation loads as a client chunk"
);
ok(
  !/import\s*\{\s*CameraCapturePanel\s*\}\s*from\s*["']\.\/CameraCapturePanel["']/.test(
    flowSrc
  ),
  "no eager CameraCapturePanel runtime import"
);
ok(
  /ssr:\s*false/.test(flowSrc) &&
    /카메라를 준비하고 있어요/.test(flowSrc) &&
    /aria-live="polite"/.test(flowSrc),
  "lazy camera has an SSR-safe accessible loading fallback"
);

const pageSrc = readFileSync(
  path.join(process.cwd(), "src/app/analyze/page.tsx"),
  "utf8"
);
ok(!/id=\"file-input\"/.test(pageSrc), "no file-input on analyze page");
ok(!/사진을 업로드하세요/.test(pageSrc), "no upload CTA copy on analyze page");
ok(
  !/사진을 업로드한 뒤/.test(pageSrc),
  "no stale upload-then-analyze copy on analyze page"
);
ok(
  /사진 픽셀은 외부 AI로 보내지 않습니다/.test(pageSrc),
  "analyze page discloses no external vision pixels"
);

async function runAsyncCameraStartTests() {
  let el: { tag: string } | null = null;
  const late = await waitForVideoElement(
    () => el as unknown as HTMLVideoElement | null,
    {
      timeoutMs: 200,
      now: (() => {
        let t = 0;
        return () => {
          t += 60;
          if (t >= 120) el = { tag: "video" };
          return t;
        };
      })(),
      delay: async () => undefined,
    }
  );
  ok(!!late, "late video element found");

  const missing = await waitForVideoElement(() => null, {
    timeoutMs: 30,
    now: (() => {
      let t = 0;
      return () => {
        t += 40;
        return t;
      };
    })(),
    delay: async () => undefined,
  });
  ok(missing === null, "video wait timeout");

  const videoMock = {
    muted: false,
    playsInline: false,
    autoplay: false,
    readyState: 2,
    srcObject: null as MediaStream | null,
    setAttribute() {},
    addEventListener() {},
    removeEventListener() {},
  };
  const playOk = await attachStreamAndPlay({
    video: videoMock as unknown as HTMLVideoElement,
    stream: streamA,
    play: async () => undefined,
    waitForReady: async () => undefined,
  });
  ok(playOk.ok && videoMock.srcObject === streamA, "stream attached + play ok");

  const playFail = await attachStreamAndPlay({
    video: videoMock as unknown as HTMLVideoElement,
    stream: streamA,
    play: async () => {
      throw Object.assign(new Error("play blocked"), { name: "NotAllowedError" });
    },
    waitForReady: async () => undefined,
  });
  ok(
    !playFail.ok && playFail.kind === "video_play_failed",
    "play reject → video_play_failed"
  );
}

void runAsyncCameraStartTests()
  .then(() => {
    console.log("[guided-capture] passed");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
