/**
 * Phase 3.1.2 alignment diagnosis fix — pure logic selftest.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  assertCenterPassesWhenInside,
  evaluateAlignment,
  alignmentStatusMessageKo,
  primaryGuidanceMessage,
  LANDMARK_STALE_MS,
} from "../src/lib/analyze/guidedCapture/landmark/alignmentEngine";
import {
  COUNTDOWN_STEP_MS,
  createAutoCaptureState,
  tickAutoCapture,
} from "../src/lib/analyze/guidedCapture/landmark/autoCaptureMachine";
import {
  assertSingleMirror,
  boundsCenter,
  computeCoverTransform,
  videoNormToDisplayNorm,
  videoBoundsToDisplayBounds,
} from "../src/lib/analyze/guidedCapture/landmark/displaySpace";
import {
  FACE_LANDMARKER_MODEL_PATH,
  FACE_LANDMARKER_WASM_PATH,
} from "../src/lib/analyze/guidedCapture/landmark/isEnabled";
import { templateForAngle } from "../src/lib/analyze/guidedCapture/landmark/templates";
import type { LandmarkSnapshot } from "../src/lib/analyze/guidedCapture/landmark/types";

function ok(cond: unknown, msg: string) {
  assert.ok(cond, msg);
}

function snap(overrides?: Partial<LandmarkSnapshot>): LandmarkSnapshot {
  return {
    faceCount: 1,
    leftEyeCenter: { x: 0.36, y: 0.42 },
    rightEyeCenter: { x: 0.64, y: 0.42 },
    noseTip: { x: 0.5, y: 0.55 },
    mouthCenter: { x: 0.5, y: 0.68 },
    chinTip: { x: 0.5, y: 0.82 },
    faceBounds: { xMin: 0.28, yMin: 0.22, xMax: 0.72, yMax: 0.82 },
    videoFaceBounds: { xMin: 0.28, yMin: 0.22, xMax: 0.72, yMax: 0.82 },
    yaw: 0,
    pitch: 0,
    roll: 0,
    detectionConfidence: 0.9,
    inferenceTimestamp: 1000,
    inferenceDurationMs: 20,
    coordinateSpace: "display",
    videoTime: 1.2,
    ...overrides,
  };
}

function run() {
  const front = templateForAngle("front");
  ok(front.faceCenter.xMin <= 0.36 + 1e-9, "center X allow ±0.14");
  ok(front.faceHeight.max >= 0.82, "face height max 0.82");

  // Attachment-like centered face MUST pass center
  const attachedLike = snap({
    faceBounds: { xMin: 0.22, yMin: 0.18, xMax: 0.78, yMax: 0.78 },
  });
  const c = boundsCenter(attachedLike.faceBounds!);
  ok(Math.abs(c.x - 0.5) < 0.02, "attached center ~0.5");
  const ev = evaluateAlignment({ snapshot: attachedLike, template: front });
  ok(ev.status === "aligned", `attached-like aligned got ${ev.status}/${ev.primaryFailReason}`);
  assertCenterPassesWhenInside(ev, front);

  // Center inside but fail center_* must throw
  const fakeCenterFail = evaluateAlignment({
    snapshot: attachedLike,
    template: front,
  });
  assertCenterPassesWhenInside(fakeCenterFail, front);

  // Misleading message regression: no_face ≠ “중앙에 맞춰”
  ok(
    !alignmentStatusMessageKo("no_face").includes("중앙에 맞춰"),
    "no_face message not center"
  );
  ok(
    primaryGuidanceMessage("no_face", [], "front", "faceCount=0").includes(
      "찾을 수 없"
    ),
    "no_face guidance"
  );
  ok(
    primaryGuidanceMessage("move_farther", [], "front", "face_too_large").includes(
      "멀리"
    ),
    "size message"
  );
  ok(
    primaryGuidanceMessage("stale_landmark", [], "front", "stale_landmark").includes(
      "다시 확인"
    ),
    "stale message"
  );

  // Stale landmark
  const stale = evaluateAlignment({
    snapshot: attachedLike,
    template: front,
    landmarkAgeMs: LANDMARK_STALE_MS + 50,
  });
  ok(stale.status === "stale_landmark", "stale");
  ok(stale.primaryFailReason === "stale_landmark", "stale reason");

  // Transform error
  ok(
    evaluateAlignment({
      snapshot: null,
      template: front,
      transformOk: false,
    }).status === "transform_error",
    "transform error"
  );

  // Null snapshot (skip without prior) → no_face with no_snapshot — not center_x
  const noSnap = evaluateAlignment({ snapshot: null, template: front });
  ok(noSnap.primaryFailReason === "no_snapshot", "no_snapshot reason");
  ok(noSnap.primaryFailReason !== "center_x", "not center_x");

  // Mirror exactly once
  const mMirror = {
    videoWidth: 720,
    videoHeight: 1280,
    clientWidth: 375,
    clientHeight: 500,
    mirrorX: true,
  };
  const coverM = computeCoverTransform(mMirror);
  assertSingleMirror(coverM);
  ok(coverM.mirrorApplyCount === 1, "mirror count 1");
  const p = videoNormToDisplayNorm({ x: 0.25, y: 0.4 }, mMirror, coverM);
  // If we mirrored again wrongly, x would go back near 0.25
  ok(p.x > 0.5, "single mirror flips left→right on screen");

  // Cover: 1280x720 into portrait container (horizontal crop)
  const landscape = {
    videoWidth: 1280,
    videoHeight: 720,
    clientWidth: 375,
    clientHeight: 500,
    mirrorX: false,
  };
  const cLand = computeCoverTransform(landscape);
  ok(cLand.ok && cLand.cropX > 0, "horizontal crop");
  ok(Math.abs(cLand.cropY) < 1, "little vertical crop");
  const midL = videoNormToDisplayNorm({ x: 0.5, y: 0.5 }, landscape, cLand);
  ok(Math.abs(midL.x - 0.5) < 0.03 && Math.abs(midL.y - 0.5) < 0.05, "mid maps");

  // Cover: 720x1280 into portrait (may be vertical or none)
  const portrait = {
    videoWidth: 720,
    videoHeight: 1280,
    clientWidth: 375,
    clientHeight: 500,
    mirrorX: false,
  };
  const cPort = computeCoverTransform(portrait);
  ok(cPort.ok, "portrait cover ok");
  const midP = videoNormToDisplayNorm({ x: 0.5, y: 0.5 }, portrait, cPort);
  ok(Math.abs(midP.x - 0.5) < 0.03, "portrait mid x");

  // Overlay/engine same transform for bounds
  const vb = { xMin: 0.3, yMin: 0.25, xMax: 0.7, yMax: 0.75 };
  const db = videoBoundsToDisplayBounds(vb, portrait, cPort);
  const engineCenter = boundsCenter(db);
  ok(
    Math.abs(engineCenter.x - midP.x) < 0.08,
    "bounds center near frame mid when face centered in video"
  );

  // Glasses still ok
  ok(
    evaluateAlignment({
      snapshot: snap({ leftEyeCenter: null, rightEyeCenter: null }),
      template: front,
    }).status === "aligned",
    "glasses"
  );

  // Countdown machine still works
  let st = createAutoCaptureState();
  let r = tickAutoCapture(st, {
    nowMs: 0,
    alignmentStatus: "aligned",
    stableHoldMs: 1000,
  });
  r = tickAutoCapture(r.state, {
    nowMs: 1000 + COUNTDOWN_STEP_MS * 3,
    alignmentStatus: "aligned",
    stableHoldMs: 1000,
  });
  ok(r.shouldCapture, "auto capture");

  // Diagnostics present
  ok(ev.diagnostics?.faceCenterDisplayX != null, "diag display center");
  ok(ev.diagnostics?.coordinateSpace === "display", "diag space");

  const root = path.resolve(__dirname, "..");
  ok(
    existsSync(
      path.join(root, "public", FACE_LANDMARKER_MODEL_PATH.replace(/^\//, ""))
    ) &&
      statSync(
        path.join(root, "public", FACE_LANDMARKER_MODEL_PATH.replace(/^\//, ""))
      ).size > 1e6,
    "model"
  );
  ok(
    existsSync(
      path.join(root, "public", FACE_LANDMARKER_WASM_PATH.replace(/^\//, ""))
    ),
    "wasm"
  );

  const client = readFileSync(
    path.join(
      root,
      "src/lib/analyze/guidedCapture/landmark/faceLandmarkerClient.ts"
    ),
    "utf8"
  );
  ok(!/currentTime === this\.lastVideoTime/.test(client), "no currentTime gate");
  ok(client.includes("minIntervalMs"), "throttle by interval");

  const panel = readFileSync(
    path.join(
      root,
      "src/components/analyze/guidedCapture/CameraCapturePanel.tsx"
    ),
    "utf8"
  );
  ok(panel.includes("showDiagnostics"), "diag always path");
  ok(panel.includes("landmarkAgeMs"), "age passed");

  console.log("guided-landmark-selftest: OK");
}

run();
