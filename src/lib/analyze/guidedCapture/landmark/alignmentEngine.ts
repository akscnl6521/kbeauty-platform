/**
 * Pure alignment evaluator — requires real LandmarkSnapshot; never invents aligned.
 */

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

export function evaluateAlignment(input: {
  snapshot: LandmarkSnapshot | null;
  template: CaptureAngleTemplate;
  quality?: QualityHints;
  inferenceSlowMs?: number;
}): AlignmentEvaluation {
  const { snapshot, template } = input;
  if (!snapshot) {
    return { status: "no_face", score: null, reasons: ["no_snapshot"] };
  }
  if (snapshot.faceCount <= 0) {
    return { status: "no_face", score: null, reasons: ["faceCount=0"] };
  }
  if (snapshot.faceCount > 1) {
    return {
      status: "multiple_faces",
      score: null,
      reasons: [`faceCount=${snapshot.faceCount}`],
    };
  }
  if (
    typeof input.inferenceSlowMs === "number" &&
    snapshot.inferenceDurationMs > input.inferenceSlowMs
  ) {
    return {
      status: "inference_slow",
      score: null,
      reasons: [`inferenceMs=${snapshot.inferenceDurationMs}`],
    };
  }

  const q = input.quality;
  if (q && typeof q.brightnessMean === "number") {
    const dark = q.darkThreshold ?? 45;
    const bright = q.brightThreshold ?? 220;
    if (q.brightnessMean < dark) {
      return { status: "too_dark", score: null, reasons: ["brightness"] };
    }
    if (q.brightnessMean > bright) {
      return { status: "too_bright", score: null, reasons: ["brightness"] };
    }
  }
  if (
    q &&
    typeof q.sharpnessScore === "number" &&
    q.sharpnessScore < (q.sharpnessMin ?? 12)
  ) {
    return { status: "too_blurry", score: null, reasons: ["sharpness"] };
  }

  if (!snapshot.faceBounds) {
    return { status: "error", score: null, reasons: ["missing_bounds"] };
  }
  const bounds = snapshot.faceBounds;
  const width = bounds.xMax - bounds.xMin;
  const height = bounds.yMax - bounds.yMin;
  const center = centerOfBounds(bounds);

  if (width < template.faceWidth.min || height < template.faceHeight.min) {
    return { status: "move_closer", score: null, reasons: ["face_small"] };
  }
  if (width > template.faceWidth.max || height > template.faceHeight.max) {
    return { status: "move_farther", score: null, reasons: ["face_large"] };
  }

  if (center.x < template.faceCenter.xMin) {
    return { status: "move_right", score: null, reasons: ["center_x"] };
  }
  if (center.x > template.faceCenter.xMax) {
    return { status: "move_left", score: null, reasons: ["center_x"] };
  }
  if (center.y < template.faceCenter.yMin) {
    return { status: "move_down", score: null, reasons: ["center_y"] };
  }
  if (center.y > template.faceCenter.yMax) {
    return { status: "move_up", score: null, reasons: ["center_y"] };
  }

  // Auto-align requires real pose estimates — never invent yaw/pitch/roll.
  if (
    snapshot.yaw === null ||
    snapshot.pitch === null ||
    snapshot.roll === null
  ) {
    return {
      status: "error",
      score: null,
      reasons: ["pose_matrix_unavailable"],
    };
  }
  if (snapshot.yaw < template.yawDeg.min) {
    return { status: "rotate_right", score: null, reasons: ["yaw"] };
  }
  if (snapshot.yaw > template.yawDeg.max) {
    return { status: "rotate_left", score: null, reasons: ["yaw"] };
  }
  if (snapshot.pitch < template.pitchDeg.min) {
    return { status: "tilt_up", score: null, reasons: ["pitch"] };
  }
  if (snapshot.pitch > template.pitchDeg.max) {
    return { status: "tilt_down", score: null, reasons: ["pitch"] };
  }
  if (
    snapshot.roll < template.rollDeg.min ||
    snapshot.roll > template.rollDeg.max
  ) {
    return { status: "level_head", score: null, reasons: ["roll"] };
  }

  const eyeY =
    snapshot.leftEyeCenter && snapshot.rightEyeCenter
      ? (snapshot.leftEyeCenter.y + snapshot.rightEyeCenter.y) / 2
      : null;
  if (eyeY !== null && !inAxis(eyeY, template.eyeLineY)) {
    return {
      status: eyeY < template.eyeLineY.min ? "move_down" : "move_up",
      score: null,
      reasons: ["eye_line"],
    };
  }

  if (snapshot.leftEyeCenter && !inBox(snapshot.leftEyeCenter, template.leftEye)) {
    return { status: "move_left", score: null, reasons: ["left_eye_box"] };
  }
  if (
    snapshot.rightEyeCenter &&
    !inBox(snapshot.rightEyeCenter, template.rightEye)
  ) {
    return { status: "move_right", score: null, reasons: ["right_eye_box"] };
  }
  if (snapshot.noseTip && !inBox(snapshot.noseTip, template.noseTip)) {
    const nx = snapshot.noseTip.x;
    if (nx < template.noseTip.xMin) {
      return { status: "move_right", score: null, reasons: ["nose_box"] };
    }
    if (nx > template.noseTip.xMax) {
      return { status: "move_left", score: null, reasons: ["nose_box"] };
    }
    return {
      status:
        snapshot.noseTip.y < template.noseTip.yMin ? "move_down" : "move_up",
      score: null,
      reasons: ["nose_box"],
    };
  }
  if (
    snapshot.mouthCenter &&
    !inBox(snapshot.mouthCenter, template.mouthCenter)
  ) {
    return { status: "move_closer", score: null, reasons: ["mouth_box"] };
  }
  if (snapshot.chinTip && !inBox(snapshot.chinTip, template.chinTip)) {
    return { status: "move_up", score: null, reasons: ["chin_box"] };
  }

  // Occlusion heuristic: missing key points
  if (
    !snapshot.leftEyeCenter ||
    !snapshot.rightEyeCenter ||
    !snapshot.noseTip ||
    !snapshot.chinTip ||
    !snapshot.mouthCenter
  ) {
    return { status: "face_occluded", score: null, reasons: ["missing_keypoints"] };
  }

  if (bounds.yMin < 0.02 || bounds.yMax > 0.98 || bounds.xMin < 0.02 || bounds.xMax > 0.98) {
    return { status: "move_farther", score: null, reasons: ["clipped"] };
  }

  let score = 1;
  const mid = (template.yawDeg.min + template.yawDeg.max) / 2;
  score -= Math.min(0.3, Math.abs(snapshot.yaw - mid) / 90);
  return { status: "aligned", score: Math.max(0, score), reasons: [] };
}

export function alignmentStatusMessageKo(status: AlignmentStatus): string {
  switch (status) {
    case "loading_model":
      return "얼굴 가이드를 준비하고 있어요.";
    case "no_face":
      return "얼굴을 가이드 안에 맞춰 주세요.";
    case "multiple_faces":
      return "한 명의 얼굴만 보이도록 해 주세요.";
    case "move_left":
      return "얼굴을 조금 왼쪽으로 옮겨 주세요.";
    case "move_right":
      return "얼굴을 조금 오른쪽으로 옮겨 주세요.";
    case "move_up":
      return "휴대폰을 조금 내려 주세요.";
    case "move_down":
      return "휴대폰을 조금 올려 주세요.";
    case "move_closer":
      return "조금 더 가까이 와 주세요.";
    case "move_farther":
      return "조금 더 멀리 떨어져 주세요.";
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
      return "좋아요. 그대로 유지해 주세요.";
    case "detector_unavailable":
      return "자동 정렬을 사용할 수 없어 수동 가이드로 촬영합니다.";
    case "inference_slow":
      return "기기 성능이 낮아 수동 가이드로 전환합니다.";
    case "error":
      return "얼굴 가이드에 문제가 있어요. 수동 촬영으로 진행해 주세요.";
  }
}
