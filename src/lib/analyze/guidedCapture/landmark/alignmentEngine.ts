/**
 * Pure alignment evaluator — requires real LandmarkSnapshot; never invents aligned.
 * Hard: face count, center, size, yaw/roll (pitch soft for front), brightness, sharpness.
 * Soft: eye/nose/mouth/chin relative positions (warnings only when softFeaturesOnly).
 */

import { toFaceRelative } from "./displaySpace";
import type {
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

function centerOfBounds(
  b: NonNullable<LandmarkSnapshot["faceBounds"]>
): NormPoint {
  return {
    x: (b.xMin + b.xMax) / 2,
    y: (b.yMin + b.yMax) / 2,
  };
}

export type QualityHints = {
  brightnessMean: number | null;
  sharpnessScore: number | null;
  darkThreshold?: number;
  brightThreshold?: number;
  sharpnessMin?: number;
};

function fail(
  status: AlignmentStatus,
  reasons: string[],
  softWarnings: string[] = []
): AlignmentEvaluation {
  return { status, score: null, reasons, softWarnings };
}

export function evaluateAlignment(input: {
  snapshot: LandmarkSnapshot | null;
  template: CaptureAngleTemplate;
  quality?: QualityHints;
  inferenceSlowMs?: number;
}): AlignmentEvaluation {
  const { snapshot, template } = input;
  if (!snapshot) {
    return fail("no_face", ["no_snapshot"]);
  }
  if (snapshot.faceCount <= 0) {
    return fail("no_face", ["faceCount=0"]);
  }
  if (snapshot.faceCount > 1) {
    return fail("multiple_faces", [`faceCount=${snapshot.faceCount}`]);
  }
  if (
    typeof input.inferenceSlowMs === "number" &&
    snapshot.inferenceDurationMs > input.inferenceSlowMs
  ) {
    return fail("inference_slow", [
      `inferenceMs=${snapshot.inferenceDurationMs}`,
    ]);
  }

  const q = input.quality;
  if (q && typeof q.brightnessMean === "number") {
    const dark = q.darkThreshold ?? 40;
    const bright = q.brightThreshold ?? 230;
    if (q.brightnessMean < dark) {
      return fail("too_dark", ["brightness"]);
    }
    if (q.brightnessMean > bright) {
      return fail("too_bright", ["brightness"]);
    }
  }
  if (
    q &&
    typeof q.sharpnessScore === "number" &&
    q.sharpnessScore < (q.sharpnessMin ?? 8)
  ) {
    return fail("too_blurry", ["sharpness"]);
  }

  if (!snapshot.faceBounds) {
    return fail("error", ["missing_bounds"]);
  }
  const bounds = snapshot.faceBounds;
  const width = bounds.xMax - bounds.xMin;
  const height = bounds.yMax - bounds.yMin;
  const center = centerOfBounds(bounds);

  // Prefer height for “closer/farther”; width alone can fail long faces.
  if (height < template.faceHeight.min) {
    return fail("move_closer", ["face_small"]);
  }
  if (height > template.faceHeight.max) {
    return fail("move_farther", ["face_large"]);
  }
  if (width < template.faceWidth.min) {
    return fail("move_closer", ["face_narrow"]);
  }
  if (width > template.faceWidth.max) {
    return fail("move_farther", ["face_wide"]);
  }

  if (center.x < template.faceCenter.xMin) {
    return fail("move_right", ["center_x"]);
  }
  if (center.x > template.faceCenter.xMax) {
    return fail("move_left", ["center_x"]);
  }
  if (center.y < template.faceCenter.yMin) {
    return fail("move_down", ["center_y"]);
  }
  if (center.y > template.faceCenter.yMax) {
    return fail("move_up", ["center_y"]);
  }

  // Hard pose: yaw + roll required. Pitch soft for front (phone angle varies).
  if (snapshot.yaw === null || snapshot.roll === null) {
    return fail("error", ["pose_matrix_unavailable"]);
  }
  if (snapshot.yaw < template.yawDeg.min) {
    return fail("rotate_right", ["yaw"]);
  }
  if (snapshot.yaw > template.yawDeg.max) {
    return fail("rotate_left", ["yaw"]);
  }
  if (
    snapshot.roll < template.rollDeg.min ||
    snapshot.roll > template.rollDeg.max
  ) {
    return fail("level_head", ["roll"]);
  }

  const softWarnings: string[] = [];
  if (
    typeof snapshot.pitch === "number" &&
    (snapshot.pitch < template.pitchDeg.min ||
      snapshot.pitch > template.pitchDeg.max)
  ) {
    if (template.angle === "front" && template.softFeaturesOnly) {
      softWarnings.push("pitch_soft");
    } else if (snapshot.pitch < template.pitchDeg.min) {
      return fail("tilt_up", ["pitch"], softWarnings);
    } else {
      return fail("tilt_down", ["pitch"], softWarnings);
    }
  }

  // Soft relative features (glasses-tolerant).
  const soft = template.softFeaturesOnly;
  const hasNose = !!snapshot.noseTip;
  const hasChin = !!snapshot.chinTip;
  const hasMouth = !!snapshot.mouthCenter;
  const hasBothEyes = !!snapshot.leftEyeCenter && !!snapshot.rightEyeCenter;

  // Occlusion: only hard-fail when nose AND most features missing (not glasses alone).
  if (!hasNose && !hasChin && !hasMouth) {
    return fail("face_occluded", ["missing_core_keypoints"], softWarnings);
  }

  if (hasBothEyes) {
    const relL = toFaceRelative(snapshot.leftEyeCenter!, bounds);
    const relR = toFaceRelative(snapshot.rightEyeCenter!, bounds);
    if (relL && relR) {
      const eyeY = (relL.y + relR.y) / 2;
      if (!inAxis(eyeY, template.eyeLineY)) {
        softWarnings.push("eye_line");
        if (!soft) {
          return fail(
            eyeY < template.eyeLineY.min ? "move_down" : "move_up",
            ["eye_line"],
            softWarnings
          );
        }
      }
      if (!inBox(relL, template.leftEye) || !inBox(relR, template.rightEye)) {
        softWarnings.push("eye_box");
        // Glasses often shift eye landmarks — never hard-block when soft.
      }
    }
  } else {
    softWarnings.push("eyes_missing_or_low_confidence");
    // Glasses: fall back to bounds + nose + pose (already passed).
  }

  if (snapshot.noseTip) {
    const rel = toFaceRelative(snapshot.noseTip, bounds);
    if (rel && !inBox(rel, template.noseTip)) {
      softWarnings.push("nose_box");
      if (!soft) {
        return fail(
          rel.x < template.noseTip.xMin ? "move_right" : "move_left",
          ["nose_box"],
          softWarnings
        );
      }
    }
  }
  if (snapshot.mouthCenter) {
    const rel = toFaceRelative(snapshot.mouthCenter, bounds);
    if (rel && !inBox(rel, template.mouthCenter)) {
      softWarnings.push("mouth_box");
    }
  }
  if (snapshot.chinTip) {
    const rel = toFaceRelative(snapshot.chinTip, bounds);
    if (rel && !inBox(rel, template.chinTip)) {
      softWarnings.push("chin_box");
    }
  }

  // Mild clip OK; severe clip → move farther
  if (
    bounds.yMin < -0.02 ||
    bounds.yMax > 1.02 ||
    bounds.xMin < -0.02 ||
    bounds.xMax > 1.02
  ) {
    return fail("move_farther", ["clipped"], softWarnings);
  }

  let score = 1;
  const mid = (template.yawDeg.min + template.yawDeg.max) / 2;
  score -= Math.min(0.25, Math.abs(snapshot.yaw - mid) / 90);
  score -= Math.min(0.15, softWarnings.length * 0.03);
  return {
    status: "aligned",
    score: Math.max(0, score),
    reasons: [],
    softWarnings,
  };
}

export function alignmentStatusMessageKo(status: AlignmentStatus): string {
  switch (status) {
    case "loading_model":
      return "얼굴 가이드를 준비하고 있어요.";
    case "no_face":
      return "얼굴을 화면 중앙에 맞춰 주세요.";
    case "multiple_faces":
      return "한 명의 얼굴만 보이도록 해 주세요.";
    case "move_left":
      return "얼굴을 조금 왼쪽으로 옮겨 주세요.";
    case "move_right":
      return "얼굴을 조금 오른쪽으로 옮겨 주세요.";
    case "move_up":
      return "휴대폰을 조금 내려 주세요.";
    case "move_down":
      return "휴대폰을 눈높이로 올려 주세요.";
    case "move_closer":
      return "조금 더 가까이 와 주세요.";
    case "move_farther":
      return "얼굴을 조금 더 멀리해 주세요.";
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
    case "error":
      return "얼굴 가이드에 문제가 있어요. 수동 촬영으로 진행해 주세요.";
  }
}

/** Prefer a single primary guidance message. */
export function primaryGuidanceMessage(
  status: AlignmentStatus,
  softWarnings: string[],
  angle: "front" | "left45" | "right45" = "front"
): string {
  if (status === "aligned") {
    return softWarnings.length > 0
      ? "거의 맞았어요. 그대로 유지해 주세요."
      : alignmentStatusMessageKo("aligned");
  }
  if (
    angle === "front" &&
    (status === "rotate_left" || status === "rotate_right")
  ) {
    return "고개를 정면으로 돌려 주세요.";
  }
  return alignmentStatusMessageKo(status);
}
