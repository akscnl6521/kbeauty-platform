/**
 * Phase 3.0 guided multi-angle capture — types only.
 * No face detection claims; pose is explicit unavailable/manual.
 */

export type CaptureAngle = "front" | "left45" | "right45";

export type CaptureInputSource = "camera" | "gallery";

export type CaptureFlowState =
  | "idle"
  | "requesting_permission"
  | "permission_denied"
  | "camera_unavailable"
  | "capturing_front"
  | "reviewing_front"
  | "capturing_left"
  | "reviewing_left"
  | "capturing_right"
  | "reviewing_right"
  | "quality_failed"
  | "ready_for_analysis"
  | "canceled";

export type QualityStatus = "pass" | "fail" | "pending";

/** Honest pose status — never invent detection results. */
export type PoseCheckStatus = "pose_check_unavailable" | "manual_guidance";

export type QualityReasonCode =
  | "unsupported_format"
  | "file_too_large"
  | "resolution_too_low"
  | "too_dark"
  | "too_bright"
  | "sharpness_low"
  | "frame_ratio_suspect"
  | "brightness_variance_high"
  | "pose_check_unavailable"
  | "manual_guidance";

export type CapturedShot = {
  angle: CaptureAngle;
  /** Temporary object URL or data URL — revoke on cleanup when object URL. */
  previewUrl: string;
  width: number;
  height: number;
  byteLength: number;
  mimeType: string;
  brightnessScore: number | null;
  sharpnessScore: number | null;
  qualityStatus: QualityStatus;
  qualityReasons: QualityReasonCode[];
  poseCheckStatus: PoseCheckStatus;
  capturedAt: string;
  inputSource: CaptureInputSource;
  /** Base64 without data: prefix — for /api/analyze */
  imageBase64: string;
  usesObjectUrl: boolean;
};

export type CaptureSession = {
  state: CaptureFlowState;
  shots: Partial<Record<CaptureAngle, CapturedShot>>;
  failedAngle: CaptureAngle | null;
  requestId: string | null;
  activeFacingMode: "user" | "environment";
};

export const CAPTURE_ANGLE_ORDER: readonly CaptureAngle[] = [
  "front",
  "left45",
  "right45",
] as const;

export type AnalysisProgressPhase =
  | "preparing"
  | "checking_photo_quality"
  | "uploading"
  | "analyzing"
  | "matching_scenario"
  | "checking_ingredients"
  | "ranking_products"
  | "building_routine"
  | "saving_result"
  | "completed"
  | "failed"
  | "timed_out";

/** Phases that may be marked complete only after real local/API work. */
export const ANALYSIS_PIPELINE_PHASES: readonly AnalysisProgressPhase[] = [
  "preparing",
  "checking_photo_quality",
  "uploading",
  "analyzing",
  "matching_scenario",
  "checking_ingredients",
  "ranking_products",
  "building_routine",
  "saving_result",
] as const;
