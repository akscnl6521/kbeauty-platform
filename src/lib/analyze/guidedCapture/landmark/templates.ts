/**
 * Capture alignment templates.
 * Absolute screen ranges for center/size/pose; feature boxes are face-relative (0–1 in bounds).
 */

import type { CaptureAngle } from "../types";
import type { CaptureAngleTemplate } from "./types";

/**
 * Front v1.1 — wider tolerances; feature ranges are relative to detected face bounds.
 * Typical MediaPipe front ratios (approx): eyes ~0.35–0.42 y, nose ~0.55, mouth ~0.72, chin ~0.95.
 */
const FRONT: CaptureAngleTemplate = {
  id: "front_template_v1",
  version: "v1",
  angle: "front",
  // ±~10% of screen width around center
  faceCenter: { xMin: 0.38, xMax: 0.62, yMin: 0.35, yMax: 0.62 },
  // Relative eye-line Y within face bounds (soft)
  eyeLineY: { min: 0.28, max: 0.48 },
  leftEye: { xMin: 0.12, xMax: 0.48, yMin: 0.22, yMax: 0.5 },
  rightEye: { xMin: 0.52, xMax: 0.88, yMin: 0.22, yMax: 0.5 },
  noseTip: { xMin: 0.35, xMax: 0.65, yMin: 0.42, yMax: 0.68 },
  mouthCenter: { xMin: 0.28, xMax: 0.72, yMin: 0.58, yMax: 0.82 },
  chinTip: { xMin: 0.28, xMax: 0.72, yMin: 0.82, yMax: 1.05 },
  // Face height ~45–72% of screen; width loose for long/round faces
  faceWidth: { min: 0.22, max: 0.72 },
  faceHeight: { min: 0.42, max: 0.78 },
  // Wide initial pose ranges — tighten later with device data
  yawDeg: { min: -22, max: 22 },
  pitchDeg: { min: -20, max: 20 },
  rollDeg: { min: -18, max: 18 },
  stableHoldMs: 1000,
  /** Soft feature checks never block aligned by themselves. */
  softFeaturesOnly: true,
};

const LEFT_45: CaptureAngleTemplate = {
  id: "left_45_template_v1",
  version: "v1",
  angle: "left45",
  faceCenter: { xMin: 0.34, xMax: 0.62, yMin: 0.32, yMax: 0.64 },
  eyeLineY: { min: 0.26, max: 0.5 },
  leftEye: { xMin: 0.08, xMax: 0.45, yMin: 0.2, yMax: 0.52 },
  rightEye: { xMin: 0.4, xMax: 0.85, yMin: 0.2, yMax: 0.52 },
  noseTip: { xMin: 0.22, xMax: 0.58, yMin: 0.4, yMax: 0.7 },
  mouthCenter: { xMin: 0.2, xMax: 0.65, yMin: 0.55, yMax: 0.85 },
  chinTip: { xMin: 0.22, xMax: 0.7, yMin: 0.8, yMax: 1.05 },
  faceWidth: { min: 0.2, max: 0.7 },
  faceHeight: { min: 0.4, max: 0.78 },
  yawDeg: { min: -60, max: -18 },
  pitchDeg: { min: -22, max: 22 },
  rollDeg: { min: -20, max: 20 },
  stableHoldMs: 1000,
  softFeaturesOnly: true,
};

const RIGHT_45: CaptureAngleTemplate = {
  id: "right_45_template_v1",
  version: "v1",
  angle: "right45",
  faceCenter: { xMin: 0.38, xMax: 0.66, yMin: 0.32, yMax: 0.64 },
  eyeLineY: { min: 0.26, max: 0.5 },
  leftEye: { xMin: 0.15, xMax: 0.6, yMin: 0.2, yMax: 0.52 },
  rightEye: { xMin: 0.55, xMax: 0.92, yMin: 0.2, yMax: 0.52 },
  noseTip: { xMin: 0.42, xMax: 0.78, yMin: 0.4, yMax: 0.7 },
  mouthCenter: { xMin: 0.35, xMax: 0.8, yMin: 0.55, yMax: 0.85 },
  chinTip: { xMin: 0.3, xMax: 0.78, yMin: 0.8, yMax: 1.05 },
  faceWidth: { min: 0.2, max: 0.7 },
  faceHeight: { min: 0.4, max: 0.78 },
  yawDeg: { min: 18, max: 60 },
  pitchDeg: { min: -22, max: 22 },
  rollDeg: { min: -20, max: 20 },
  stableHoldMs: 1000,
  softFeaturesOnly: true,
};

/**
 * Display-space guide oval for UX only (not a hard mask).
 * Approximate typical front face footprint on phone portrait preview.
 */
export const FRONT_GUIDE_OVAL = {
  xMin: 0.18,
  xMax: 0.82,
  yMin: 0.18,
  yMax: 0.82,
} as const;

export const CAPTURE_TEMPLATES = {
  front_template_v1: FRONT,
  left_45_template_v1: LEFT_45,
  right_45_template_v1: RIGHT_45,
} as const;

export function templateForAngle(angle: CaptureAngle): CaptureAngleTemplate {
  if (angle === "left45") return LEFT_45;
  if (angle === "right45") return RIGHT_45;
  return FRONT;
}

/** Map face-relative box → absolute display box using a reference face region. */
export function relativeBoxToDisplay(
  rel: { xMin: number; xMax: number; yMin: number; yMax: number },
  face: { xMin: number; xMax: number; yMin: number; yMax: number }
): { xMin: number; xMax: number; yMin: number; yMax: number } {
  const w = face.xMax - face.xMin;
  const h = face.yMax - face.yMin;
  return {
    xMin: face.xMin + rel.xMin * w,
    xMax: face.xMin + rel.xMax * w,
    yMin: face.yMin + rel.yMin * h,
    yMax: face.yMin + rel.yMax * h,
  };
}
