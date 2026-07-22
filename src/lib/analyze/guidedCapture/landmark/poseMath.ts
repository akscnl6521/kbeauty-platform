/**
 * Euler angles from MediaPipe facialTransformationMatrix (column-major 4×4).
 * Approximate head pose for alignment — not identity verification.
 */

export function eulerFromColumnMajor4x4(m: ArrayLike<number>): {
  yaw: number;
  pitch: number;
  roll: number;
} {
  if (m.length < 16) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }
  const r00 = m[0]!;
  const r10 = m[1]!;
  const r20 = m[2]!;
  const r21 = m[6]!;
  const r22 = m[10]!;
  const sy = Math.sqrt(r00 * r00 + r10 * r10);
  const singular = sy < 1e-6;
  let pitch: number;
  let yaw: number;
  let roll: number;
  if (!singular) {
    pitch = Math.atan2(r21, r22);
    yaw = Math.atan2(-r20, sy);
    roll = Math.atan2(r10, r00);
  } else {
    pitch = Math.atan2(-m[9]!, m[5]!);
    yaw = Math.atan2(-r20, sy);
    roll = 0;
  }
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  return {
    yaw: toDeg(yaw),
    pitch: toDeg(pitch),
    roll: toDeg(roll),
  };
}

/** MediaPipe Face Landmarker landmark indices (Face Mesh topology). */
export const LM = {
  noseTip: 1,
  chin: 152,
  leftEyeOuter: 33,
  leftEyeInner: 133,
  rightEyeOuter: 263,
  rightEyeInner: 362,
  mouthUpper: 13,
  mouthLower: 14,
  forehead: 10,
} as const;

export function midpoint(
  a: { x: number; y: number } | undefined,
  b: { x: number; y: number } | undefined
): { x: number; y: number } | null {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Mirror X for user-facing preview space (CSS mirrored video). */
export function mirrorNormX(x: number): number {
  return 1 - x;
}
