/**
 * Phase 3.1 landmark alignment types.
 * No identity embeddings — pose for capture alignment only.
 */

export type NormPoint = { x: number; y: number };

export type LandmarkSnapshot = {
  faceCount: number;
  leftEyeCenter: NormPoint | null;
  rightEyeCenter: NormPoint | null;
  noseTip: NormPoint | null;
  mouthCenter: NormPoint | null;
  chinTip: NormPoint | null;
  faceBounds: {
    xMin: number;
    yMin: number;
    xMax: number;
    yMax: number;
  } | null;
  /** Degrees. Null when matrix unavailable. */
  yaw: number | null;
  pitch: number | null;
  roll: number | null;
  detectionConfidence: number | null;
  inferenceTimestamp: number;
  inferenceDurationMs: number;
};

export type AlignmentStatus =
  | "loading_model"
  | "no_face"
  | "multiple_faces"
  | "move_left"
  | "move_right"
  | "move_up"
  | "move_down"
  | "move_closer"
  | "move_farther"
  | "rotate_left"
  | "rotate_right"
  | "tilt_up"
  | "tilt_down"
  | "level_head"
  | "too_dark"
  | "too_bright"
  | "too_blurry"
  | "face_occluded"
  | "aligned"
  | "detector_unavailable"
  | "inference_slow"
  | "error";

export type AutoCapturePhase =
  | "adjusting"
  | "ready"
  | "countdown"
  | "capturing"
  | "reviewing"
  | "captured"
  | "quality_failed";

export type AlignmentMode = "landmark_auto" | "manual_guidance";

export type CaptureGuideVisualState =
  | "neutral"
  | "adjusting"
  | "ready"
  | "countdown"
  | "captured"
  | "error";

export type CaptureAngleTemplateId =
  | "front_template_v1"
  | "left_45_template_v1"
  | "right_45_template_v1";

export type AxisRange = { min: number; max: number };
export type BoxRange = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

export type CaptureAngleTemplate = {
  id: CaptureAngleTemplateId;
  version: "v1";
  angle: "front" | "left45" | "right45";
  /** Absolute display-space face center tolerance. */
  faceCenter: BoxRange;
  /**
   * Feature ranges are face-relative (0–1 inside detected face bounds),
   * not absolute screen coordinates.
   */
  eyeLineY: AxisRange;
  leftEye: BoxRange;
  rightEye: BoxRange;
  noseTip: BoxRange;
  mouthCenter: BoxRange;
  chinTip: BoxRange;
  faceWidth: AxisRange;
  faceHeight: AxisRange;
  yawDeg: AxisRange;
  pitchDeg: AxisRange;
  rollDeg: AxisRange;
  /** ms aligned must hold before countdown */
  stableHoldMs: number;
  /**
   * When true, eye/nose/mouth/chin mismatches are soft warnings only
   * and do not block `aligned` (glasses / face-shape tolerance).
   */
  softFeaturesOnly: boolean;
};

export type AlignmentEvaluation = {
  status: AlignmentStatus;
  score: number | null;
  reasons: string[];
  /** Soft guidance codes — never alone block aligned. */
  softWarnings: string[];
};

export type AutoCaptureMachineState = {
  phase: AutoCapturePhase;
  alignmentStatus: AlignmentStatus;
  countdownDigit: 3 | 2 | 1 | null;
  alignedSinceMs: number | null;
  lastCaptureAtMs: number | null;
  capturedForAngle: boolean;
};

export type CaptureShotMeta = {
  templateId: CaptureAngleTemplateId;
  templateVersion: "v1";
  captureAngle: "front" | "left45" | "right45";
  frameWidth: number;
  frameHeight: number;
  alignmentMode: AlignmentMode;
  alignmentScore: number | null;
  yaw: number | null;
  pitch: number | null;
  roll: number | null;
  brightnessScore: number | null;
  sharpnessScore: number | null;
  qualityStatus: "passed" | "warning" | "failed" | "manual_review";
  qualityReasons: string[];
  capturedAt: string;
  inputSource: "camera";
  voiceLocale: string;
  autoCaptured: boolean;
};

/** Future revisit comparison hooks — no Storage in Phase 3.1. */
export type FutureComparisonHints = {
  templateId: CaptureAngleTemplateId;
  templateVersion: "v1";
  preferredFaceWidth: AxisRange;
  preferredYawDeg: AxisRange;
  preferredBrightness: AxisRange;
  cameraFacing: "user" | "environment";
};
