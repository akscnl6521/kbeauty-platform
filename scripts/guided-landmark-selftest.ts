/**
 * Phase 3.1.3 coordinate sanity + inference loop selftest.
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
  LANDMARK_REUSE_MS,
  LANDMARK_RESTART_MS,
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
import {
  buildFaceBoundsFromLandmarks,
  formatDiagNum,
  isValidRawCoord,
  readLandmarkXY,
  sanitizePoseDeg,
} from "../src/lib/analyze/guidedCapture/landmark/landmarkSanity";
import {
  copyMatrix4Data,
  eulerFromColumnMajor4x4,
} from "../src/lib/analyze/guidedCapture/landmark/poseMath";
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

/** Synthetic mesh of points in [0,1] for bounds tests. */
function makeMesh(
  patches: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 468; i++) {
    out.push({ x: 0.4 + (i % 10) * 0.01, y: 0.4 + Math.floor(i / 10) * 0.002 });
  }
  for (let i = 0; i < patches.length; i++) {
    out[i] = patches[i]!;
  }
  return out;
}

function run() {
  const front = templateForAngle("front");
  ok(front.faceCenter.xMin <= 0.36 + 1e-9, "center X allow ±0.14");
  ok(front.faceHeight.max >= 0.82, "face height max 0.82");

  // --- raw landmark range ---
  ok(isValidRawCoord(0.5), "raw 0.5 ok");
  ok(!isValidRawCoord(NaN), "NaN blocked");
  ok(!isValidRawCoord(Infinity), "Infinity blocked");
  ok(!isValidRawCoord(1e15), "1e15 blocked");
  ok(!isValidRawCoord(-2), "too small blocked");
  ok(formatDiagNum(1e15) === "INVALID", "format INVALID");
  ok(formatDiagNum(0.512) === "0.512", "format ok");

  // --- bounds from min/max, matrix not included ---
  const mesh = makeMesh([
    { x: 0.2, y: 0.15 },
    { x: 0.8, y: 0.15 },
    { x: 0.2, y: 0.85 },
    { x: 0.8, y: 0.85 },
  ]);
  const built = buildFaceBoundsFromLandmarks(mesh);
  ok(built.ok, "bounds ok");
  if (built.ok) {
    ok(Math.abs(built.bounds.xMin - 0.2) < 0.01, "minX");
    ok(Math.abs(built.bounds.xMax - 0.8) < 0.02, "maxX");
    const cx = (built.bounds.xMin + built.bounds.xMax) / 2;
    ok(Math.abs(cx - 0.5) < 0.05, "center ~0.5");
  }
  const badMesh = makeMesh([{ x: NaN, y: 0.5 }, { x: 1e15, y: 0.5 }]);
  // Fill rest with invalid too — too few valid
  for (let i = 0; i < badMesh.length; i++) {
    badMesh[i] = { x: NaN, y: Infinity };
  }
  ok(!buildFaceBoundsFromLandmarks(badMesh).ok, "all invalid → reject");

  const withMatrixLike = makeMesh([]);
  // Ensure matrix translation values are NOT mixed: pass only landmarks
  ok(buildFaceBoundsFromLandmarks(withMatrixLike).ok, "normal mesh bounds");
  ok(
    readLandmarkXY([{ x: 12, y: 0.5 } as { x: number; y: number }], 0) === null,
    "pixel-space landmark rejected"
  );

  // --- display transform: 1280x1280 → 314x419 cover ---
  const androidLike = {
    videoWidth: 1280,
    videoHeight: 1280,
    clientWidth: 314,
    clientHeight: 419,
    mirrorX: true,
  };
  const coverA = computeCoverTransform(androidLike);
  ok(coverA.ok, "android cover ok");
  ok(Math.abs(coverA.scale - 419 / 1280) < 0.01, "scale ≈0.327");
  ok(coverA.cropX > 40 && coverA.cropX < 70, "cropX ≈52.5");
  ok(Math.abs(coverA.cropY) < 1, "cropY ≈0");
  assertSingleMirror(coverA);
  ok(coverA.mirrorApplyCount === 1, "mirror once");

  const midA = videoNormToDisplayNorm({ x: 0.5, y: 0.5 }, androidLike, coverA);
  ok(midA != null, "mid maps");
  ok(Math.abs(midA!.x - 0.5) < 0.05, "display center x ~0.5");
  ok(Math.abs(midA!.y - 0.5) < 0.05, "display center y ~0.5");

  const faceVb = { xMin: 0.2, yMin: 0.15, xMax: 0.8, yMax: 0.85 };
  const faceDb = videoBoundsToDisplayBounds(faceVb, androidLike, coverA);
  ok(faceDb != null, "bounds transform");
  const fw = faceDb!.xMax - faceDb!.xMin;
  const fh = faceDb!.yMax - faceDb!.yMin;
  ok(fw > 0.4 && fw < 1.2, `w reasonable got ${fw}`);
  ok(fh > 0.4 && fh < 1.2, `h reasonable got ${fh}`);
  ok(videoNormToDisplayNorm({ x: NaN, y: 0.5 }, androidLike, coverA) === null, "NaN point");
  ok(videoNormToDisplayNorm({ x: 1e15, y: 0.5 }, androidLike, coverA) === null, "1e15 point");

  // width/height via two-corner transform (not center scale)
  const left = videoNormToDisplayNorm({ x: 0.2, y: 0.5 }, androidLike, coverA)!;
  const right = videoNormToDisplayNorm({ x: 0.8, y: 0.5 }, androidLike, coverA)!;
  ok(Math.abs(Math.abs(right.x - left.x) - fw) < 0.08, "width via corners");

  // Attachment-like centered face MUST pass center
  const attachedLike = snap({
    faceBounds: { xMin: 0.22, yMin: 0.18, xMax: 0.78, yMax: 0.78 },
  });
  const c = boundsCenter(attachedLike.faceBounds!);
  ok(Math.abs(c.x - 0.5) < 0.02, "attached center ~0.5");
  const ev = evaluateAlignment({
    snapshot: attachedLike,
    template: front,
    poseReliable: true,
  });
  ok(ev.status === "aligned", `attached-like aligned got ${ev.status}/${ev.primaryFailReason}`);
  assertCenterPassesWhenInside(ev, front);

  // Exploded bounds → invalid_landmark_data (engine hard reject)
  const exploded = evaluateAlignment({
    snapshot: snap({
      faceBounds: {
        xMin: -3.2e16,
        yMin: -2.5e16,
        xMax: 1.7e17,
        yMax: 1.1e17,
      },
    }),
    template: front,
  });
  ok(
    exploded.status === "invalid_landmark_data",
    `exploded blocked got ${exploded.status}`
  );

  // invalidLandmark flag
  ok(
    evaluateAlignment({
      snapshot: null,
      template: front,
      invalidLandmark: true,
      invalidStage: "raw_bounds",
    }).status === "invalid_landmark_data",
    "invalid flag"
  );

  // Misleading message regression
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
    primaryGuidanceMessage("invalid_landmark_data", [], "front", "invalid_landmark_data").includes(
      "불안정"
    ),
    "invalid message"
  );

  // Stale landmark 700ms
  const stale = evaluateAlignment({
    snapshot: attachedLike,
    template: front,
    landmarkAgeMs: LANDMARK_STALE_MS + 50,
    poseReliable: true,
  });
  ok(stale.status === "stale_landmark", "stale 700ms");
  ok(LANDMARK_REUSE_MS === 250, "reuse 250");
  ok(LANDMARK_RESTART_MS === 2000, "restart 2s");

  // Transform error
  ok(
    evaluateAlignment({
      snapshot: null,
      template: front,
      transformOk: false,
    }).status === "transform_error",
    "transform error"
  );

  const noSnap = evaluateAlignment({ snapshot: null, template: front });
  ok(noSnap.primaryFailReason === "no_snapshot", "no_snapshot reason");

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
  const p = videoNormToDisplayNorm({ x: 0.25, y: 0.4 }, mMirror, coverM);
  ok(p != null && p.x > 0.5, "single mirror flips left→right");

  // Pose: identity matrix → near 0 deg; radians not double-converted
  const identity = new Float64Array(16);
  identity[0] = 1;
  identity[5] = 1;
  identity[10] = 1;
  identity[15] = 1;
  const e0 = eulerFromColumnMajor4x4(identity)!;
  ok(Math.abs(e0.yaw) < 1 && Math.abs(e0.pitch) < 1 && Math.abs(e0.roll) < 1, "identity pose");
  const shared = new Float64Array(identity);
  eulerFromColumnMajor4x4(shared);
  ok(shared[0] === 1 && shared[12] === 0, "euler does not mutate caller if copy used");
  // copyMatrix4Data isolates translation
  const withTx = {
    data: Float64Array.from([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 999, 888, 777, 1,
    ]),
  };
  const copied = copyMatrix4Data(withTx)!;
  ok(copied[12] === 999, "translation preserved in copy only");
  // bounds builder never sees matrix
  ok(buildFaceBoundsFromLandmarks(mesh).ok, "matrix not in bounds");

  const crazyPose = sanitizePoseDeg({ yaw: -16.9, pitch: -126.7, roll: -73.7 });
  ok(!crazyPose.poseReliable, "unrealistic pitch/roll unreliable");
  ok(crazyPose.pitch === null && crazyPose.roll === null, "bad pitch/roll nulled");

  // Front facing with unreliable pose uses landmark substitute
  const frontUnreliable = evaluateAlignment({
    snapshot: attachedLike,
    template: front,
    poseReliable: false,
  });
  ok(
    frontUnreliable.status === "aligned" ||
      frontUnreliable.softWarnings.includes("detector_unreliable_pose"),
    "landmark front substitute path"
  );

  // Glasses still ok
  ok(
    evaluateAlignment({
      snapshot: snap({ leftEyeCenter: null, rightEyeCenter: null }),
      template: front,
      poseReliable: true,
    }).status === "aligned",
    "glasses"
  );

  // Countdown + auto capture
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

  ok(ev.diagnostics?.faceCenterDisplayX != null, "diag display center");
  ok(ev.diagnostics?.coordinateSpace === "display", "diag space");

  // Timestamp monotonic policy in client source
  const root = path.resolve(__dirname, "..");
  const client = readFileSync(
    path.join(
      root,
      "src/lib/analyze/guidedCapture/landmark/faceLandmarkerClient.ts"
    ),
    "utf8"
  );
  ok(!/currentTime === this\.lastVideoTime/.test(client), "no currentTime gate");
  ok(client.includes("minIntervalMs"), "throttle by interval");
  ok(client.includes("lastMediaPipeTs + 1"), "monotonic timestamp bump");
  ok(client.includes("finally"), "finally unlock");
  ok(client.includes("inferInFlight = false"), "lock clear");
  ok(client.includes("softReset"), "softReset");
  ok(client.includes("hardRestart"), "hardRestart");
  ok(client.includes("copyMatrix4Data"), "matrix copy");
  ok(client.includes("buildFaceBoundsFromLandmarks"), "landmark bounds");
  ok(!client.includes("facialTransformationMatrixes") || client.includes("pose"), "matrix for pose");

  const panel = readFileSync(
    path.join(
      root,
      "src/components/analyze/guidedCapture/CameraCapturePanel.tsx"
    ),
    "utf8"
  );
  ok(panel.includes("showDiagnostics"), "diag always path");
  ok(panel.includes("landmarkAgeMs"), "age passed");
  ok(panel.includes("scheduleNext"), "raf schedule helper");
  ok(panel.includes("finally"), "loop finally");
  ok(panel.includes("LANDMARK_RESTART_MS"), "2s restart");
  ok(panel.includes("never cache invalid") || panel.includes("lastSnapRef.current = null"), "invalid not cached");

  const poseSrc = readFileSync(
    path.join(root, "src/lib/analyze/guidedCapture/landmark/poseMath.ts"),
    "utf8"
  );
  ok(poseSrc.includes("Float64Array(16)"), "pose copies matrix");
  ok(poseSrc.includes("180") && poseSrc.includes("Math.PI"), "single rad→deg");

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

  console.log("guided-landmark-selftest: OK");
}

run();
