import type { NormPoint } from "./types";
import type { NormBounds } from "./displaySpace";

/** Defensive range for raw MediaPipe normalized landmarks. */
export const RAW_COORD_MIN = -0.5;
export const RAW_COORD_MAX = 1.5;
export const DISPLAY_CENTER_MIN = -0.25;
export const DISPLAY_CENTER_MAX = 1.25;
export const FACE_SIZE_MAX = 1.5;
export const POSE_DEG_ABS_MAX = 180;

export function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function isValidRawCoord(n: unknown): n is number {
  return isFiniteNumber(n) && n >= RAW_COORD_MIN && n <= RAW_COORD_MAX;
}

export function isValidDisplayCenter(n: unknown): n is number {
  return isFiniteNumber(n) && n >= DISPLAY_CENTER_MIN && n <= DISPLAY_CENTER_MAX;
}

export function isValidFaceSize(n: unknown): n is number {
  return isFiniteNumber(n) && n > 0 && n <= FACE_SIZE_MAX;
}

export function isValidPoseDeg(n: unknown): n is number {
  return isFiniteNumber(n) && Math.abs(n) <= POSE_DEG_ABS_MAX;
}

export function readLandmarkXY(
  landmarks: ArrayLike<{ x?: unknown; y?: unknown; z?: unknown } | number>,
  index: number
): NormPoint | null {
  if (index < 0 || index >= landmarks.length) return null;
  const p = landmarks[index];
  if (p == null || typeof p === "number") return null;
  const x = Number((p as { x?: unknown }).x);
  const y = Number((p as { y?: unknown }).y);
  if (!isValidRawCoord(x) || !isValidRawCoord(y)) return null;
  return { x, y };
}

export type BoundsBuildResult =
  | { ok: true; bounds: NormBounds; usedCount: number }
  | { ok: false; reason: string };

/** Simple list bounds — tests / callers with plain {x,y}[]. */
export function buildFaceBoundsFromLandmarks(
  landmarks: ArrayLike<{ x?: unknown; y?: unknown } | number>
): BoundsBuildResult {
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  let used = 0;
  const len = landmarks.length;
  for (let i = 0; i < len; i++) {
    const pt = readLandmarkXY(landmarks, i);
    if (!pt) continue;
    used += 1;
    xMin = Math.min(xMin, pt.x);
    yMin = Math.min(yMin, pt.y);
    xMax = Math.max(xMax, pt.x);
    yMax = Math.max(yMax, pt.y);
  }
  if (used < 8 || !Number.isFinite(xMin) || !Number.isFinite(xMax)) {
    return { ok: false, reason: "raw_bounds_invalid" };
  }
  const width = xMax - xMin;
  const height = yMax - yMin;
  if (!isValidFaceSize(width) || !isValidFaceSize(height)) {
    return { ok: false, reason: "invalid_bounds_size" };
  }
  const cx = (xMin + xMax) / 2;
  const cy = (yMin + yMax) / 2;
  if (!isValidRawCoord(cx) || !isValidRawCoord(cy)) {
    return { ok: false, reason: "invalid_bounds_center" };
  }
  return {
    ok: true,
    usedCount: used,
    bounds: { xMin, yMin, xMax, yMax },
  };
}

export function validateDisplayBounds(b: NormBounds): boolean {
  if (
    !isFiniteNumber(b.xMin) ||
    !isFiniteNumber(b.xMax) ||
    !isFiniteNumber(b.yMin) ||
    !isFiniteNumber(b.yMax)
  ) {
    return false;
  }
  const w = b.xMax - b.xMin;
  const h = b.yMax - b.yMin;
  if (!isValidFaceSize(w) || !isValidFaceSize(h)) return false;
  const cx = (b.xMin + b.xMax) / 2;
  const cy = (b.yMin + b.yMax) / 2;
  return isValidDisplayCenter(cx) && isValidDisplayCenter(cy);
}

export function validateDisplayPoint(p: NormPoint | null): p is NormPoint {
  if (!p) return false;
  return isValidDisplayCenter(p.x) && isValidDisplayCenter(p.y);
}

export function sanitizePoseDeg(input: {
  yaw: number | null;
  pitch: number | null;
  roll: number | null;
}): {
  yaw: number | null;
  pitch: number | null;
  roll: number | null;
  poseReliable: boolean;
} {
  const yaw = input.yaw != null && isValidPoseDeg(input.yaw) ? input.yaw : null;
  const pitch =
    input.pitch != null && isValidPoseDeg(input.pitch) ? input.pitch : null;
  const roll =
    input.roll != null && isValidPoseDeg(input.roll) ? input.roll : null;
  // Front face: extreme pitch/roll means matrix is unreliable — null them out.
  const poseReliable =
    yaw != null &&
    pitch != null &&
    roll != null &&
    Math.abs(pitch) <= 60 &&
    Math.abs(roll) <= 60;
  if (!poseReliable) {
    return {
      yaw: yaw != null && Math.abs(yaw) <= 90 ? yaw : null,
      pitch: null,
      roll: null,
      poseReliable: false,
    };
  }
  return { yaw, pitch, roll, poseReliable: true };
}

/** UI helper — never print astronomical garbage. */
export function formatDiagNum(n: number | null | undefined, digits = 3): string {
  if (!isFiniteNumber(n)) return "INVALID";
  if (Math.abs(n) > 10) return "INVALID";
  return n.toFixed(digits);
}
