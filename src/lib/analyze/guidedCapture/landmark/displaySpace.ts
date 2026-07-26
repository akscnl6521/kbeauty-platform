/**
 * Unify MediaPipe video-normalized coords with CSS object-fit:cover display space.
 * Mirror X applied exactly once. Rejects non-normalized inputs (no silent clamp).
 */

import { isValidRawCoord } from "./landmarkSanity";

export type NormPoint = { x: number; y: number };

export type NormBounds = {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
};

export type VideoDisplayMetrics = {
  videoWidth: number;
  videoHeight: number;
  clientWidth: number;
  clientHeight: number;
  mirrorX: boolean;
};

export type CoverTransform = {
  scale: number;
  cropX: number;
  cropY: number;
  mirrored: boolean;
  ok: boolean;
  sourceAspect: number;
  containerAspect: number;
  mirrorApplyCount: 0 | 1;
};

export function computeCoverTransform(m: VideoDisplayMetrics): CoverTransform {
  const vw = m.videoWidth;
  const vh = m.videoHeight;
  const cw = m.clientWidth;
  const ch = m.clientHeight;
  const sourceAspect = vh > 0 ? vw / vh : 0;
  const containerAspect = ch > 0 ? cw / ch : 0;
  if (vw < 2 || vh < 2 || cw < 2 || ch < 2) {
    return {
      scale: 1,
      cropX: 0,
      cropY: 0,
      mirrored: m.mirrorX,
      ok: false,
      sourceAspect,
      containerAspect,
      mirrorApplyCount: m.mirrorX ? 1 : 0,
    };
  }
  const scale = Math.max(cw / vw, ch / vh);
  if (!Number.isFinite(scale) || scale <= 0) {
    return {
      scale: 1,
      cropX: 0,
      cropY: 0,
      mirrored: m.mirrorX,
      ok: false,
      sourceAspect,
      containerAspect,
      mirrorApplyCount: m.mirrorX ? 1 : 0,
    };
  }
  const drawnW = vw * scale;
  const drawnH = vh * scale;
  const cropX = (drawnW - cw) / 2;
  const cropY = (drawnH - ch) / 2;
  return {
    scale,
    cropX,
    cropY,
    mirrored: m.mirrorX,
    ok: true,
    sourceAspect,
    containerAspect,
    mirrorApplyCount: m.mirrorX ? 1 : 0,
  };
}

/**
 * Video normalized (0–1) → display normalized.
 * Input must already be valid raw coords — never double-scale.
 */
export function videoNormToDisplayNorm(
  p: NormPoint,
  m: VideoDisplayMetrics,
  cover?: CoverTransform
): NormPoint | null {
  if (!isValidRawCoord(p.x) || !isValidRawCoord(p.y)) return null;
  const t = cover ?? computeCoverTransform(m);
  if (!t.ok) return null;

  // 1) source pixel
  const px = p.x * m.videoWidth;
  const py = p.y * m.videoHeight;
  // 2–3) cover scale
  const renderedX = px * t.scale;
  const renderedY = py * t.scale;
  // 4) crop
  const displayPxX = renderedX - t.cropX;
  const displayPxY = renderedY - t.cropY;
  // 5) client normalized
  let x = displayPxX / m.clientWidth;
  const y = displayPxY / m.clientHeight;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  // 6) mirror once
  if (t.mirrored) x = 1 - x;
  return { x, y };
}

export function videoBoundsToDisplayBounds(
  b: NormBounds,
  m: VideoDisplayMetrics,
  cover?: CoverTransform
): NormBounds | null {
  const t = cover ?? computeCoverTransform(m);
  const a = videoNormToDisplayNorm({ x: b.xMin, y: b.yMin }, m, t);
  const c = videoNormToDisplayNorm({ x: b.xMax, y: b.yMax }, m, t);
  if (!a || !c) return null;
  return {
    xMin: Math.min(a.x, c.x),
    xMax: Math.max(a.x, c.x),
    yMin: Math.min(a.y, c.y),
    yMax: Math.max(a.y, c.y),
  };
}

export function boundsCenter(b: NormBounds): NormPoint {
  return {
    x: (b.xMin + b.xMax) / 2,
    y: (b.yMin + b.yMax) / 2,
  };
}

export function toFaceRelative(
  p: NormPoint,
  bounds: NormBounds
): NormPoint | null {
  const w = bounds.xMax - bounds.xMin;
  const h = bounds.yMax - bounds.yMin;
  if (!(w > 0) || !(h > 0) || !Number.isFinite(w) || !Number.isFinite(h)) {
    return null;
  }
  return {
    x: (p.x - bounds.xMin) / w,
    y: (p.y - bounds.yMin) / h,
  };
}

export function readVideoDisplayMetrics(
  video: HTMLVideoElement,
  mirrorX: boolean
): VideoDisplayMetrics {
  return {
    videoWidth: video.videoWidth || 0,
    videoHeight: video.videoHeight || 0,
    clientWidth: video.clientWidth || 0,
    clientHeight: video.clientHeight || 0,
    mirrorX,
  };
}

export function assertSingleMirror(cover: CoverTransform): void {
  if (cover.mirrorApplyCount > 1) {
    throw new Error(`mirror applied ${cover.mirrorApplyCount} times`);
  }
}
