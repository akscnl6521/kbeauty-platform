/**
 * Euler from MediaPipe facialTransformationMatrix — pose only, never mutates input.
 * Does not feed translation into face center / bounds.
 */

export function eulerFromColumnMajor4x4(m: ArrayLike<number>): {
  yaw: number;
  pitch: number;
  roll: number;
} | null {
  if (!m || m.length < 16) return null;
  // Copy so MediaPipe buffers are never mutated / shared with landmarks.
  const c = new Float64Array(16);
  for (let i = 0; i < 16; i++) {
    const v = Number(m[i]);
    if (!Number.isFinite(v)) return null;
    c[i] = v;
  }

  const r00 = c[0]!;
  const r10 = c[1]!;
  const r20 = c[2]!;
  const r21 = c[6]!;
  const r22 = c[10]!;
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
    pitch = Math.atan2(-c[9]!, c[5]!);
    yaw = Math.atan2(-r20, sy);
    roll = 0;
  }
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const out = {
    yaw: toDeg(yaw),
    pitch: toDeg(pitch),
    roll: toDeg(roll),
  };
  if (
    !Number.isFinite(out.yaw) ||
    !Number.isFinite(out.pitch) ||
    !Number.isFinite(out.roll)
  ) {
    return null;
  }
  return out;
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
  a: { x: number; y: number } | null | undefined,
  b: { x: number; y: number } | null | undefined
): { x: number; y: number } | null {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function mirrorNormX(x: number): number {
  return 1 - x;
}

/** Copy first 16 matrix values — translation (indices 12–14) never used as face center. */
export function copyMatrix4Data(matrix: unknown): Float64Array | null {
  if (!matrix || typeof matrix !== "object") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (matrix as any).data ?? matrix;
  if (!raw || typeof raw.length !== "number" || raw.length < 16) return null;
  const out = new Float64Array(16);
  for (let i = 0; i < 16; i++) {
    const v = Number(raw[i]);
    if (!Number.isFinite(v)) return null;
    out[i] = v;
  }
  return out;
}
