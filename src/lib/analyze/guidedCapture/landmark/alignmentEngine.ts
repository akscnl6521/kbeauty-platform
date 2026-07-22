/**
 * Pure alignment evaluator — display-space only; never re-mirrors.
 * Requires real LandmarkSnapshot; never invents aligned.
 */

import { boundsCenter, toFaceRelative } from "./displaySpace";
import type {
  AlignmentDiagnostics,
  AlignmentEvaluation,
  AlignmentStatus,
  AxisRange,
  BoxRange,
  CaptureAngleTemplate,
  LandmarkSnapshot,
  NormPoint,
} from "./types";

function inAxis(v: number, r: AxisRange): boolean {
  return v >= r.min && v <= r.max;
}

function inBox(p: NormPoint, b: BoxRange): boolean {
  return p.x >= b.xMin && p.x <= b.xMax && p.y >= b.yMin && p.y <= b.yMax;
}

export type QualityHints = {
  brightnessMean: number | null;
  sharpnessScore: number | null;
  darkThreshold?: number;
  brightThreshold?: number;
  sharpnessMin?: number;
};

export const LANDMARK_STALE_MS = 700;

function targetOf(template: CaptureAngleTemplate): {
  x: number;
  y: number;
  allowedX: number;
  allowedY: number;
} {
  const x =
    (template.faceCenter.xMin + template.faceCenter.xMax) / 2;
  const y =
    (template.faceCenter.yMin + template.faceCenter.yMax) / 2;
  return {
    x,
    y,
    allowedX: (template.faceCenter.xMax - template.faceCenter.xMin) / 2,
    allowedY: (template.faceCenter.yMax - template.faceCenter.yMin) / 2,
  };
}

function buildDiagnostics(input: {
  snapshot: LandmarkSnapshot | null;
  template: CaptureAngleTemplate;
  landmarkAgeMs: number | null;
}): AlignmentDiagnostics {
  const t = targetOf(input.template);
  const vb = input.snapshot?.videoFaceBounds ?? null;
  const db = input.snapshot?.faceBounds ?? null;
  const videoCenter = vb ? boundsCenter(vb) : null;
  const displayCenter = db ? boundsCenter(db) : null;
  const w = db ? db.xMax - db.xMin : null;
  const h = db ? db.yMax - db.yMin : null;
  return {
    faceCenterVideoX: videoCenter?.x ?? null,
    faceCenterVideoY: videoCenter?.y ?? null,
    faceCenterDisplayX: displayCenter?.x ?? null,
    faceCenterDisplayY: displayCenter?.y ?? null,
    targetCenterX: t.x,
    targetCenterY: t.y,
    centerDeltaX:
      displayCenter != null ? displayCenter.x - t.x : null,
    centerDeltaY:
      displayCenter != null ? displayCenter.y - t.y : null,
    allowedDeltaX: t.allowedX,
    allowedDeltaY: t.allowedY,
    faceWidthRatio: w,
    faceHeightRatio: h,
    yaw: input.snapshot?.yaw ?? null,
    pitch: input.snapshot?.pitch ?? null,
    roll: input.snapshot?.roll ?? null,
    landmarkAgeMs: input.landmarkAgeMs,
    coordinateSpace: input.snapshot?.coordinateSpace ?? "none",
  };
}

function result(
  status: AlignmentStatus,
  primaryFailReason: string | null,
  reasons: string[],
  softWarnings: string[],
  diagnostics: AlignmentDiagnostics,
  score: number | null = null
): AlignmentEvaluation {
  return {
    status,
    score,
    primaryFailReason,
    reasons,
    softWarnings,
    diagnostics,
  };
}

export function evaluateAlignment(input: {
  snapshot: LandmarkSnapshot | null;
  template: CaptureAngleTemplate;
  quality?: QualityHints;
  inferenceSlowMs?: number;
  /** Age of snapshot since inference (ms). */
  landmarkAgeMs?: number | null;
  transformOk?: boolean;
}): AlignmentEvaluation {
  const { snapshot, template } = input;
  const age =
    typeof input.landmarkAgeMs === "number" ? input.landmarkAgeMs : null;
  const diag = () =>
    buildDiagnostics({
      snapshot,
      template,
      landmarkAgeMs: age,
    });

  // Priority 1–3
  if (input.transformOk === false) {
    return result("transform_error", "invalid_transform", ["transform"], [], diag());
  }
  if (!snapshot) {
    return result("no_face", "no_snapshot", ["no_snapshot"], [], diag());
  }
  if (age !== null && age > LANDMARK_STALE_MS) {
    return result(
      "stale_landmark",
      "stale_landmark",
      [`ageMs=${age}`],
      [],
      diag()
    );
  }
  if (snapshot.faceCount <= 0) {
    return result("no_face", "faceCount=0", ["faceCount=0"], [], diag());
  }
  if (snapshot.faceCount > 1) {
    return result(
      "multiple_faces",
      "multiple_faces",
      [`faceCount=${snapshot.faceCount}`],
      [],
      diag()
    );
  }
  if (
    typeof input.inferenceSlowMs === "number" &&
    snapshot.inferenceDurationMs > input.inferenceSlowMs
  ) {
    return result(
      "inference_slow",
      "inference_slow",
      [`inferenceMs=${snapshot.inferenceDurationMs}`],
      [],
      diag()
    );
  }

  if (!snapshot.faceBounds) {
    return result("error", "missing_bounds", ["missing_bounds"], [], diag());
  }

  const bounds = snapshot.faceBounds;
  const width = bounds.xMax - bounds.xMin;
  const height = bounds.yMax - bounds.yMin;
  const center = boundsCenter(bounds);
  const softWarnings: string[] = [];

  // Priority 4 — size before center (user request)
  if (height < template.faceHeight.min) {
    return result("move_closer", "face_too_small", ["face_small"], softWarnings, diag());
  }
  if (height > template.faceHeight.max) {
    return result("move_farther", "face_too_large", ["face_large"], softWarnings, diag());
  }
  if (width < template.faceWidth.min) {
    return result("move_closer", "face_too_narrow", ["face_narrow"], softWarnings, diag());
  }
  if (width > template.faceWidth.max) {
    return result("move_farther", "face_too_wide", ["face_wide"], softWarnings, diag());
  }

  // Priority 5–6 — center (display-space bounds center)
  if (center.x < template.faceCenter.xMin) {
    return result("move_right", "center_x", ["center_x"], softWarnings, diag());
  }
  if (center.x > template.faceCenter.xMax) {
    return result("move_left", "center_x", ["center_x"], softWarnings, diag());
  }
  if (center.y < template.faceCenter.yMin) {
    return result("move_down", "center_y", ["center_y"], softWarnings, diag());
  }
  if (center.y > template.faceCenter.yMax) {
    return result("move_up", "center_y", ["center_y"], softWarnings, diag());
  }

  // Priority 7–8 — yaw / roll
  if (snapshot.yaw === null || snapshot.roll === null) {
    return result(
      "error",
      "pose_matrix_unavailable",
      ["pose_matrix_unavailable"],
      softWarnings,
      diag()
    );
  }
  if (snapshot.yaw < template.yawDeg.min) {
    return result("rotate_right", "yaw", ["yaw"], softWarnings, diag());
  }
  if (snapshot.yaw > template.yawDeg.max) {
    return result("rotate_left", "yaw", ["yaw"], softWarnings, diag());
  }
  if (
    snapshot.roll < template.rollDeg.min ||
    snapshot.roll > template.rollDeg.max
  ) {
    return result("level_head", "roll", ["roll"], softWarnings, diag());
  }

  if (
    typeof snapshot.pitch === "number" &&
    (snapshot.pitch < template.pitchDeg.min ||
      snapshot.pitch > template.pitchDeg.max)
  ) {
    if (template.angle === "front" && template.softFeaturesOnly) {
      softWarnings.push("pitch_soft");
    } else if (snapshot.pitch < template.pitchDeg.min) {
      return result("tilt_up", "pitch", ["pitch"], softWarnings, diag());
    } else {
      return result("tilt_down", "pitch", ["pitch"], softWarnings, diag());
    }
  }

  // Priority 9–10 — brightness / sharpness
  const q = input.quality;
  if (q && typeof q.brightnessMean === "number") {
    const dark = q.darkThreshold ?? 40;
    const bright = q.brightThreshold ?? 230;
    if (q.brightnessMean < dark) {
      return result("too_dark", "brightness", ["brightness"], softWarnings, diag());
    }
    if (q.brightnessMean > bright) {
      return result("too_bright", "brightness", ["brightness"], softWarnings, diag());
    }
  }
  if (
    q &&
    typeof q.sharpnessScore === "number" &&
    q.sharpnessScore < (q.sharpnessMin ?? 8)
  ) {
    return result("too_blurry", "sharpness", ["sharpness"], softWarnings, diag());
  }

  const hasNose = !!snapshot.noseTip;
  const hasChin = !!snapshot.chinTip;
  const hasMouth = !!snapshot.mouthCenter;
  const hasBothEyes = !!snapshot.leftEyeCenter && !!snapshot.rightEyeCenter;

  if (!hasNose && !hasChin && !hasMouth) {
    return result(
      "face_occluded",
      "missing_core_keypoints",
      ["missing_core_keypoints"],
      softWarnings,
      diag()
    );
  }

  const soft = template.softFeaturesOnly;
  if (hasBothEyes) {
    const relL = toFaceRelative(snapshot.leftEyeCenter!, bounds);
    const relR = toFaceRelative(snapshot.rightEyeCenter!, bounds);
    if (relL && relR) {
      const eyeY = (relL.y + relR.y) / 2;
      if (!inAxis(eyeY, template.eyeLineY)) {
        softWarnings.push("eye_line");
        if (!soft) {
          return result(
            eyeY < template.eyeLineY.min ? "move_down" : "move_up",
            "eye_line",
            ["eye_line"],
            softWarnings,
            diag()
          );
        }
      }
      if (!inBox(relL, template.leftEye) || !inBox(relR, template.rightEye)) {
        softWarnings.push("eye_box");
      }
    }
  } else {
    softWarnings.push("eyes_missing_or_low_confidence");
  }

  if (snapshot.noseTip) {
    const rel = toFaceRelative(snapshot.noseTip, bounds);
    if (rel && !inBox(rel, template.noseTip)) softWarnings.push("nose_box");
  }
  if (snapshot.mouthCenter) {
    const rel = toFaceRelative(snapshot.mouthCenter, bounds);
    if (rel && !inBox(rel, template.mouthCenter)) softWarnings.push("mouth_box");
  }
  if (snapshot.chinTip) {
    const rel = toFaceRelative(snapshot.chinTip, bounds);
    if (rel && !inBox(rel, template.chinTip)) softWarnings.push("chin_box");
  }

  if (
    bounds.yMin < -0.05 ||
    bounds.yMax > 1.05 ||
    bounds.xMin < -0.05 ||
    bounds.xMax > 1.05
  ) {
    return result(
      "move_farther",
      "bounds_outside",
      ["clipped"],
      softWarnings,
      diag()
    );
  }

  let score = 1;
  const mid = (template.yawDeg.min + template.yawDeg.max) / 2;
  score -= Math.min(0.25, Math.abs(snapshot.yaw - mid) / 90);
  score -= Math.min(0.15, softWarnings.length * 0.03);
  return result(
    "aligned",
    null,
    [],
    softWarnings,
    diag(),
    Math.max(0, score)
  );
}

export function alignmentStatusMessageKo(status: AlignmentStatus): string {
  switch (status) {
    case "loading_model":
      return "얼굴 가이드를 준비하고 있어요.";
    case "no_face":
      return "얼굴을 찾을 수 없어요. 가이드 안에 들어와 주세요.";
    case "multiple_faces":
      return "한 명의 얼굴만 보이도록 해 주세요.";
    case "move_left":
      return "얼굴을 좌우 중앙에 맞춰 주세요.";
    case "move_right":
      return "얼굴을 좌우 중앙에 맞춰 주세요.";
    case "move_up":
      return "얼굴을 조금 위로 올려 주세요.";
    case "move_down":
      return "얼굴을 조금 아래로 내려 주세요.";
    case "move_closer":
      return "조금 더 가까이 와 주세요.";
    case "move_farther":
      return "휴대폰을 조금 멀리해 주세요.";
    case "rotate_left":
      return "얼굴을 화면의 왼쪽 방향으로 천천히 돌려 주세요.";
    case "rotate_right":
      return "얼굴을 화면의 오른쪽 방향으로 천천히 돌려 주세요.";
    case "tilt_up":
      return "턱을 조금 들어 주세요.";
    case "tilt_down":
      return "턱을 조금 내려 주세요.";
    case "level_head":
      return "고개를 조금만 세워 주세요.";
    case "too_dark":
      return "조명이 너무 어두워요.";
    case "too_bright":
      return "조명이 너무 밝아요.";
    case "too_blurry":
      return "초점이 흐려요. 잠시 움직이지 마세요.";
    case "face_occluded":
      return "얼굴을 가리는 머리카락이나 손을 정리해 주세요.";
    case "aligned":
      return "거의 맞았어요. 그대로 유지해 주세요.";
    case "detector_unavailable":
      return "자동 정렬을 사용할 수 없어 수동 가이드로 촬영합니다.";
    case "inference_slow":
      return "기기 성능이 낮아 수동 가이드로 전환합니다.";
    case "stale_landmark":
      return "얼굴 위치를 다시 확인하고 있어요.";
    case "transform_error":
      return "카메라 정렬 정보를 다시 계산하고 있어요.";
    case "error":
      return "얼굴 가이드에 문제가 있어요. 수동 촬영으로 진행해 주세요.";
  }
}

/** One accurate guidance line; never map unrelated fails to “center”. */
export function primaryGuidanceMessage(
  status: AlignmentStatus,
  softWarnings: string[],
  angle: "front" | "left45" | "right45" = "front",
  primaryFailReason?: string | null
): string {
  if (status === "aligned") {
    return softWarnings.length > 0
      ? "거의 맞았어요. 그대로 유지해 주세요."
      : alignmentStatusMessageKo("aligned");
  }
  if (primaryFailReason === "center_x") {
    return "얼굴을 좌우 중앙에 맞춰 주세요.";
  }
  if (primaryFailReason === "center_y") {
    return status === "move_up"
      ? "얼굴을 조금 위로 올려 주세요."
      : "얼굴을 조금 아래로 내려 주세요.";
  }
  if (
    primaryFailReason === "face_too_large" ||
    primaryFailReason === "face_too_wide"
  ) {
    return "휴대폰을 조금 멀리해 주세요.";
  }
  if (
    primaryFailReason === "face_too_small" ||
    primaryFailReason === "face_too_narrow"
  ) {
    return "조금 더 가까이 와 주세요.";
  }
  if (
    angle === "front" &&
    (status === "rotate_left" || status === "rotate_right")
  ) {
    return "고개를 정면으로 돌려 주세요.";
  }
  return alignmentStatusMessageKo(status);
}

/** Test helper: centered face in display space must not fail on center. */
export function assertCenterPassesWhenInside(
  evalResult: AlignmentEvaluation,
  template: CaptureAngleTemplate
): void {
  const d = evalResult.diagnostics;
  if (!d || d.faceCenterDisplayX == null || d.faceCenterDisplayY == null) {
    return;
  }
  const insideX =
    d.faceCenterDisplayX >= template.faceCenter.xMin &&
    d.faceCenterDisplayX <= template.faceCenter.xMax;
  const insideY =
    d.faceCenterDisplayY >= template.faceCenter.yMin &&
    d.faceCenterDisplayY <= template.faceCenter.yMax;
  if (
    insideX &&
    insideY &&
    (evalResult.primaryFailReason === "center_x" ||
      evalResult.primaryFailReason === "center_y")
  ) {
    throw new Error(
      `center inside allowed box but fail=${evalResult.primaryFailReason}`
    );
  }
}
