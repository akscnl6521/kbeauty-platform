/**
 * Robust MediaPipe landmark list parsing.
 * Handles array / array-like / nested .landmarks shapes without trusting TS types alone.
 * Never clamps invalid coords into a fake-normal range.
 */

import type { NormBounds } from "./displaySpace";
import {
  FACE_SIZE_MAX,
  isFiniteNumber,
  isValidFaceSize,
  isValidRawCoord,
  RAW_COORD_MAX,
  RAW_COORD_MIN,
} from "./landmarkSanity";

export type LandmarkListInspect = {
  faceLandmarksPresent: boolean;
  faceCount: number;
  landmarkArrayLength: number;
  firstPointKeys: string;
  validPointCount: number;
  invalidPointCount: number;
  /** Local debug only — first finite sample or INVALID. */
  sample0: string;
  parseNote: string;
};

export type BoundsFromLandmarksResult =
  | {
      ok: true;
      bounds: NormBounds;
      usedCount: number;
      invalidCount: number;
      totalCount: number;
      inspect: LandmarkListInspect;
    }
  | {
      ok: false;
      reason: string;
      usedCount: number;
      invalidCount: number;
      totalCount: number;
      inspect: LandmarkListInspect;
    };

function keysOf(p: unknown): string {
  if (p == null || typeof p !== "object") {
    return typeof p;
  }
  try {
    const keys = Object.keys(p as object);
    if (keys.length > 0) return keys.slice(0, 8).join(",");
    // class instances may hide fields on prototype / wasm getters
    const protoKeys = ["x", "y", "z", "visibility"].filter(
      (k) => k in (p as object)
    );
    return protoKeys.length ? protoKeys.join(",") : "object";
  } catch {
    return "unreadable";
  }
}

/** Coerce one MediaPipe face entry into a plain array of point-like values. */
export function coerceLandmarkList(face: unknown): unknown[] {
  if (face == null) return [];
  if (Array.isArray(face)) return face;
  // Interleaved Float32Array / TypedArray: x,y,z,x,y,z,...
  if (ArrayBuffer.isView(face)) {
    const view = face as unknown as ArrayLike<number>;
    const n = view.length;
    if (typeof n === "number" && n >= 6 && n % 3 === 0) {
      const out: Array<{ x: number; y: number; z: number }> = [];
      for (let i = 0; i + 2 < n; i += 3) {
        out.push({
          x: Number(view[i]),
          y: Number(view[i + 1]),
          z: Number(view[i + 2]),
        });
      }
      return out;
    }
  }
  if (typeof face === "object") {
    const o = face as Record<string, unknown>;
    if (Array.isArray(o.landmarks)) return o.landmarks;
    if (Array.isArray(o.landmark)) return o.landmark;
    if (typeof (o as { length?: unknown }).length === "number") {
      try {
        return Array.from(face as ArrayLike<unknown>);
      } catch {
        // fall through
      }
    }
  }
  return [];
}

/**
 * Read x/y from one landmark point — copies primitives only.
 * Supports {x,y}, [x,y], getter-based WASM objects.
 */
export function extractLandmarkXY(raw: unknown): { x: number; y: number } | null {
  if (raw == null || typeof raw === "number" || typeof raw === "boolean") {
    return null;
  }
  if (typeof raw === "string") return null;

  let x: number | null = null;
  let y: number | null = null;

  if (Array.isArray(raw) && raw.length >= 2) {
    x = Number(raw[0]);
    y = Number(raw[1]);
  } else if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const xr = o.x ?? o.X;
    const yr = o.y ?? o.Y;
    if (xr != null && yr != null) {
      x = Number(xr);
      y = Number(yr);
    } else if (
      typeof (raw as { getX?: () => unknown }).getX === "function" &&
      typeof (raw as { getY?: () => unknown }).getY === "function"
    ) {
      x = Number((raw as { getX: () => unknown }).getX());
      y = Number((raw as { getY: () => unknown }).getY());
    }
  }

  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;
  if (!isValidRawCoord(x) || !isValidRawCoord(y)) return null;
  return { x, y };
}

/**
 * If most finite points look like pixel coordinates (>> 1.5), convert using video size.
 * This is a unit conversion, not a clamp-to-normal fake.
 */
export function extractLandmarkXYMaybePixels(
  raw: unknown,
  videoWidth: number,
  videoHeight: number
): { x: number; y: number } | null {
  const norm = extractLandmarkXY(raw);
  if (norm) return norm;
  if (!(videoWidth > 1) || !(videoHeight > 1)) return null;
  if (raw == null || typeof raw !== "object") return null;

  let x: number | null = null;
  let y: number | null = null;
  if (Array.isArray(raw) && raw.length >= 2) {
    x = Number(raw[0]);
    y = Number(raw[1]);
  } else {
    const o = raw as Record<string, unknown>;
    x = Number(o.x ?? o.X);
    y = Number(o.y ?? o.Y);
  }
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;
  // Pixel-space heuristic: clearly outside normalized defensive range but within frame.
  if (x > RAW_COORD_MAX || y > RAW_COORD_MAX) {
    if (x < -2 || y < -2 || x > videoWidth * 1.5 || y > videoHeight * 1.5) {
      return null;
    }
    const nx = x / videoWidth;
    const ny = y / videoHeight;
    if (!isValidRawCoord(nx) || !isValidRawCoord(ny)) return null;
    return { x: nx, y: ny };
  }
  if (x < RAW_COORD_MIN || y < RAW_COORD_MIN) return null;
  return null;
}

export function inspectLandmarkList(
  faceLandmarks: unknown,
  faceIndex = 0,
  videoWidth = 0,
  videoHeight = 0
): LandmarkListInspect & { points: Array<{ x: number; y: number }> } {
  const present = Array.isArray(faceLandmarks);
  const faceCount = present ? (faceLandmarks as unknown[]).length : 0;
  const face =
    present && faceCount > faceIndex
      ? (faceLandmarks as unknown[])[faceIndex]
      : null;
  const list = coerceLandmarkList(face);
  const points: Array<{ x: number; y: number }> = [];
  let invalid = 0;
  let finiteOutside = 0;
  for (let i = 0; i < list.length; i++) {
    const raw = list[i];
    const pt =
      extractLandmarkXY(raw) ??
      extractLandmarkXYMaybePixels(raw, videoWidth, videoHeight);
    if (pt) points.push(pt);
    else {
      invalid += 1;
      if (raw != null && typeof raw === "object") {
        const o = raw as Record<string, unknown>;
        const x = Number(o.x ?? o.X);
        const y = Number(o.y ?? o.Y);
        if (isFiniteNumber(x) && isFiniteNumber(y)) finiteOutside += 1;
      }
    }
  }
  const first = list[0];
  const samplePt = points[0];
  let parseNote = "ok";
  if (!present) parseNote = "faceLandmarks_missing";
  else if (faceCount === 0) parseNote = "face_count_0";
  else if (list.length === 0) parseNote = "empty_landmark_list";
  else if (points.length === 0 && finiteOutside > 0) {
    parseNote = "finite_but_out_of_range";
  } else if (points.length === 0) parseNote = "no_valid_xy";

  return {
    faceLandmarksPresent: present,
    faceCount,
    landmarkArrayLength: list.length,
    firstPointKeys: keysOf(first),
    validPointCount: points.length,
    invalidPointCount: invalid,
    sample0: samplePt
      ? `${samplePt.x.toFixed(3)},${samplePt.y.toFixed(3)}`
      : "INVALID",
    parseNote,
    points,
  };
}

const MIN_VALID_POINTS = 8;

export function buildBoundsFromParsedPoints(
  points: Array<{ x: number; y: number }>,
  inspect: LandmarkListInspect,
  totalCount: number
): BoundsFromLandmarksResult {
  if (points.length < MIN_VALID_POINTS) {
    return {
      ok: false,
      reason: "raw_bounds_invalid",
      usedCount: points.length,
      invalidCount: inspect.invalidPointCount,
      totalCount,
      inspect,
    };
  }
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  for (const p of points) {
    xMin = Math.min(xMin, p.x);
    yMin = Math.min(yMin, p.y);
    xMax = Math.max(xMax, p.x);
    yMax = Math.max(yMax, p.y);
  }
  const width = xMax - xMin;
  const height = yMax - yMin;
  if (!isValidFaceSize(width) || !isValidFaceSize(height)) {
    return {
      ok: false,
      reason: "invalid_bounds_size",
      usedCount: points.length,
      invalidCount: inspect.invalidPointCount,
      totalCount,
      inspect,
    };
  }
  const cx = (xMin + xMax) / 2;
  const cy = (yMin + yMax) / 2;
  if (!isValidRawCoord(cx) || !isValidRawCoord(cy)) {
    return {
      ok: false,
      reason: "invalid_bounds_center",
      usedCount: points.length,
      invalidCount: inspect.invalidPointCount,
      totalCount,
      inspect,
    };
  }
  return {
    ok: true,
    bounds: { xMin, yMin, xMax, yMax },
    usedCount: points.length,
    invalidCount: inspect.invalidPointCount,
    totalCount,
    inspect,
  };
}

export function buildFaceBoundsFromFaceLandmarks(
  faceLandmarks: unknown,
  opts?: { faceIndex?: number; videoWidth?: number; videoHeight?: number }
): BoundsFromLandmarksResult {
  const inspected = inspectLandmarkList(
    faceLandmarks,
    opts?.faceIndex ?? 0,
    opts?.videoWidth ?? 0,
    opts?.videoHeight ?? 0
  );
  const { points, ...inspect } = inspected;
  return buildBoundsFromParsedPoints(
    points,
    inspect,
    inspected.landmarkArrayLength
  );
}

export { MIN_VALID_POINTS, RAW_COORD_MIN, RAW_COORD_MAX, FACE_SIZE_MAX };
