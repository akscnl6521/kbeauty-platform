/**
 * Build CapturedShot from measured metrics (shared by camera + gallery).
 */

import { checkLocalPhotoQuality } from "./qualityCheck";
import type {
  CaptureAngle,
  CaptureInputSource,
  CapturedShot,
  PoseCheckStatus,
} from "./types";

export function buildCapturedShot(input: {
  angle: CaptureAngle;
  previewUrl: string;
  usesObjectUrl: boolean;
  width: number;
  height: number;
  byteLength: number;
  mimeType: string;
  brightnessMean: number | null;
  sharpnessScore: number | null;
  imageBase64: string;
  inputSource: CaptureInputSource;
  poseCheckStatus?: PoseCheckStatus;
  capturedAt?: string;
}): CapturedShot {
  const quality = checkLocalPhotoQuality({
    mimeType: input.mimeType,
    byteLength: input.byteLength,
    width: input.width,
    height: input.height,
    brightnessMean: input.brightnessMean,
    sharpnessScore: input.sharpnessScore,
    aspectRatio: input.height > 0 ? input.width / input.height : null,
  });

  const poseCheckStatus = input.poseCheckStatus ?? "manual_guidance";
  const reasons = quality.reasons.includes("pose_check_unavailable")
    ? quality.reasons
    : [...quality.reasons, "pose_check_unavailable" as const];

  // pose_check_unavailable is informational — does not fail the shot alone.
  const blocking = reasons.filter((r) => r !== "pose_check_unavailable");

  return {
    angle: input.angle,
    previewUrl: input.previewUrl,
    width: input.width,
    height: input.height,
    byteLength: input.byteLength,
    mimeType: input.mimeType,
    brightnessScore: quality.brightnessScore,
    sharpnessScore: quality.sharpnessScore,
    qualityStatus: blocking.length === 0 ? "pass" : "fail",
    qualityReasons: reasons,
    poseCheckStatus,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    inputSource: input.inputSource,
    imageBase64: input.imageBase64,
    usesObjectUrl: input.usesObjectUrl,
  };
}
