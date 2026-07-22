/**
 * Capture alignment templates (normalized 0–1). Versioned; not scattered magic numbers.
 */

import type { CaptureAngle } from "../types";
import type { CaptureAngleTemplate } from "./types";

const FRONT: CaptureAngleTemplate = {
  id: "front_template_v1",
  version: "v1",
  angle: "front",
  faceCenter: { xMin: 0.42, xMax: 0.58, yMin: 0.38, yMax: 0.58 },
  eyeLineY: { min: 0.32, max: 0.48 },
  leftEye: { xMin: 0.28, xMax: 0.45, yMin: 0.3, yMax: 0.48 },
  rightEye: { xMin: 0.55, xMax: 0.72, yMin: 0.3, yMax: 0.48 },
  noseTip: { xMin: 0.44, xMax: 0.56, yMin: 0.45, yMax: 0.62 },
  mouthCenter: { xMin: 0.42, xMax: 0.58, yMin: 0.58, yMax: 0.74 },
  chinTip: { xMin: 0.42, xMax: 0.58, yMin: 0.72, yMax: 0.92 },
  faceWidth: { min: 0.28, max: 0.62 },
  faceHeight: { min: 0.34, max: 0.78 },
  yawDeg: { min: -12, max: 12 },
  pitchDeg: { min: -12, max: 12 },
  rollDeg: { min: -10, max: 10 },
  stableHoldMs: 1000,
};

/** User turns face toward screen-left (their right cheek visible more). */
const LEFT_45: CaptureAngleTemplate = {
  id: "left_45_template_v1",
  version: "v1",
  angle: "left45",
  faceCenter: { xMin: 0.38, xMax: 0.58, yMin: 0.36, yMax: 0.6 },
  eyeLineY: { min: 0.3, max: 0.5 },
  leftEye: { xMin: 0.22, xMax: 0.42, yMin: 0.28, yMax: 0.5 },
  rightEye: { xMin: 0.42, xMax: 0.62, yMin: 0.28, yMax: 0.5 },
  noseTip: { xMin: 0.34, xMax: 0.5, yMin: 0.44, yMax: 0.64 },
  mouthCenter: { xMin: 0.34, xMax: 0.52, yMin: 0.56, yMax: 0.76 },
  chinTip: { xMin: 0.36, xMax: 0.54, yMin: 0.7, yMax: 0.92 },
  faceWidth: { min: 0.26, max: 0.6 },
  faceHeight: { min: 0.32, max: 0.78 },
  yawDeg: { min: -55, max: -25 },
  pitchDeg: { min: -14, max: 14 },
  rollDeg: { min: -12, max: 12 },
  stableHoldMs: 1000,
};

const RIGHT_45: CaptureAngleTemplate = {
  id: "right_45_template_v1",
  version: "v1",
  angle: "right45",
  faceCenter: { xMin: 0.42, xMax: 0.62, yMin: 0.36, yMax: 0.6 },
  eyeLineY: { min: 0.3, max: 0.5 },
  leftEye: { xMin: 0.38, xMax: 0.58, yMin: 0.28, yMax: 0.5 },
  rightEye: { xMin: 0.58, xMax: 0.78, yMin: 0.28, yMax: 0.5 },
  noseTip: { xMin: 0.5, xMax: 0.66, yMin: 0.44, yMax: 0.64 },
  mouthCenter: { xMin: 0.48, xMax: 0.66, yMin: 0.56, yMax: 0.76 },
  chinTip: { xMin: 0.46, xMax: 0.64, yMin: 0.7, yMax: 0.92 },
  faceWidth: { min: 0.26, max: 0.6 },
  faceHeight: { min: 0.32, max: 0.78 },
  yawDeg: { min: 25, max: 55 },
  pitchDeg: { min: -14, max: 14 },
  rollDeg: { min: -12, max: 12 },
  stableHoldMs: 1000,
};

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
