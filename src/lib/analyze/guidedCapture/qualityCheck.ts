/**
 * Local photo quality checks (no face landmark / pose ML).
 * Pose angle is never auto-validated — callers must set pose_check_unavailable
 * or manual_guidance.
 */

import type { QualityReasonCode } from "./types";

export const QUALITY_LIMITS = {
  minWidth: 480,
  minHeight: 480,
  maxBytes: 10 * 1024 * 1024,
  darkThreshold: 45,
  brightThreshold: 220,
  sharpnessMin: 12,
  /** Max absolute brightness delta across shots (0–255 scale). */
  maxBrightnessDelta: 55,
  allowedMime: new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ]),
} as const;

export type PixelSampleStats = {
  width: number;
  height: number;
  brightnessMean: number;
  sharpnessScore: number;
};

export type LocalQualityInput = {
  mimeType: string;
  byteLength: number;
  width: number;
  height: number;
  brightnessMean: number | null;
  sharpnessScore: number | null;
  /** Aspect width/height — face frame heuristic only. */
  aspectRatio?: number | null;
};

export type LocalQualityResult = {
  ok: boolean;
  reasons: QualityReasonCode[];
  brightnessScore: number | null;
  sharpnessScore: number | null;
};

export function normalizeMime(mime: string): string {
  return mime.trim().toLowerCase().split(";")[0]!.trim();
}

export function checkLocalPhotoQuality(
  input: LocalQualityInput
): LocalQualityResult {
  const reasons: QualityReasonCode[] = [];
  const mime = normalizeMime(input.mimeType || "");

  if (!QUALITY_LIMITS.allowedMime.has(mime)) {
    reasons.push("unsupported_format");
  }
  if (input.byteLength <= 0 || input.byteLength > QUALITY_LIMITS.maxBytes) {
    reasons.push("file_too_large");
  }
  if (
    input.width < QUALITY_LIMITS.minWidth ||
    input.height < QUALITY_LIMITS.minHeight
  ) {
    reasons.push("resolution_too_low");
  }

  const brightnessScore = input.brightnessMean;
  const sharpnessScore = input.sharpnessScore;

  if (typeof brightnessScore === "number") {
    if (brightnessScore < QUALITY_LIMITS.darkThreshold) {
      reasons.push("too_dark");
    } else if (brightnessScore > QUALITY_LIMITS.brightThreshold) {
      reasons.push("too_bright");
    }
  }

  if (
    typeof sharpnessScore === "number" &&
    sharpnessScore < QUALITY_LIMITS.sharpnessMin
  ) {
    reasons.push("sharpness_low");
  }

  const aspect =
    input.aspectRatio ??
    (input.height > 0 ? input.width / input.height : null);
  if (typeof aspect === "number" && (aspect < 0.55 || aspect > 1.85)) {
    reasons.push("frame_ratio_suspect");
  }

  // Pose is never auto-passed.
  reasons.push("pose_check_unavailable");

  const blocking = reasons.filter((r) => r !== "pose_check_unavailable");
  return {
    ok: blocking.length === 0,
    reasons,
    brightnessScore,
    sharpnessScore,
  };
}

export function checkBrightnessVarianceAcrossShots(
  brightnessScores: Array<number | null | undefined>
): QualityReasonCode | null {
  const nums = brightnessScores.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v)
  );
  if (nums.length < 2) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (max - min > QUALITY_LIMITS.maxBrightnessDelta) {
    return "brightness_variance_high";
  }
  return null;
}

/**
 * Estimate brightness (0–255) and Laplacian-ish sharpness from RGBA buffer.
 * Stride sampling keeps Node/browser selftests fast.
 */
export function sampleImageStatsFromRgba(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  sampleStride = 4
): PixelSampleStats {
  let sum = 0;
  let count = 0;
  let sharpAcc = 0;
  let sharpCount = 0;

  const grayAt = (x: number, y: number): number => {
    const i = (y * width + x) * 4;
    const r = rgba[i] ?? 0;
    const g = rgba[i + 1] ?? 0;
    const b = rgba[i + 2] ?? 0;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };

  for (let y = 1; y < height - 1; y += sampleStride) {
    for (let x = 1; x < width - 1; x += sampleStride) {
      const g = grayAt(x, y);
      sum += g;
      count += 1;
      const lap =
        -4 * g +
        grayAt(x - 1, y) +
        grayAt(x + 1, y) +
        grayAt(x, y - 1) +
        grayAt(x, y + 1);
      sharpAcc += lap * lap;
      sharpCount += 1;
    }
  }

  return {
    width,
    height,
    brightnessMean: count > 0 ? sum / count : 0,
    sharpnessScore: sharpCount > 0 ? sharpAcc / sharpCount : 0,
  };
}

export function qualityReasonMessageKo(code: QualityReasonCode): string {
  switch (code) {
    case "unsupported_format":
      return "지원하지 않는 이미지 형식입니다. JPEG·PNG·WebP를 사용해 주세요.";
    case "file_too_large":
      return "파일 크기가 너무 큽니다. 10MB 이하로 다시 촬영해 주세요.";
    case "resolution_too_low":
      return "해상도가 너무 낮습니다. 조금 더 가까이 오거나 더 선명하게 촬영해 주세요.";
    case "too_dark":
      return "조명이 너무 어둡습니다. 밝은 곳에서 다시 촬영해 주세요.";
    case "too_bright":
      return "사진이 너무 밝습니다. 강한 빛이나 역광을 피해 주세요.";
    case "sharpness_low":
      return "초점이 흐리거나 흔들린 것 같습니다. 잠시 움직이지 말고 다시 촬영해 주세요.";
    case "frame_ratio_suspect":
      return "얼굴 가이드에 맞춰 다시 촬영해 주세요.";
    case "brightness_variance_high":
      return "사진 간 밝기 차이가 큽니다. 같은 조명에서 다시 촬영해 주세요.";
    case "pose_check_unavailable":
      return "자동 얼굴 각도 검사는 아직 사용할 수 없습니다. 안내 문구에 맞춰 수동으로 확인해 주세요.";
    case "manual_guidance":
      return "안내에 따라 각도를 맞춘 뒤 촬영해 주세요.";
    default:
      return "사진 품질을 확인해 주세요.";
  }
}
