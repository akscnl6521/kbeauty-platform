/**
 * Unify MediaPipe video-normalized coords with CSS object-fit:cover display space.
 * Overlay and alignmentEngine must use the same transform.
 */

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
  /** true when CSS scale-x-[-1] is applied on the video element */
  mirrorX: boolean;
};

/**
 * object-fit: cover mapping from video-normalized (0–1) → display-normalized (0–1).
 * Accounts for crop offsets when aspect ratios differ.
 */
export function computeCoverTransform(m: VideoDisplayMetrics): {
  scale: number;
  cropX: number;
  cropY: number;
  mirrored: boolean;
  ok: boolean;
} {
  const vw = m.videoWidth;
  const vh = m.videoHeight;
  const cw = m.clientWidth;
  const ch = m.clientHeight;
  if (vw < 2 || vh < 2 || cw < 2 || ch < 2) {
    return { scale: 1, cropX: 0, cropY: 0, mirrored: m.mirrorX, ok: false };
  }
  const scale = Math.max(cw / vw, ch / vh);
  const drawnW = vw * scale;
  const drawnH = vh * scale;
  const cropX = (drawnW - cw) / 2;
  const cropY = (drawnH - ch) / 2;
  return { scale, cropX, cropY, mirrored: m.mirrorX, ok: true };
}

/** Video-space normalized point → display-space normalized point. */
export function videoNormToDisplayNorm(
  p: NormPoint,
  m: VideoDisplayMetrics
): NormPoint {
  const t = computeCoverTransform(m);
  if (!t.ok) {
    return m.mirrorX ? { x: 1 - p.x, y: p.y } : { x: p.x, y: p.y };
  }
  const px = p.x * m.videoWidth * t.scale - t.cropX;
  const py = p.y * m.videoHeight * t.scale - t.cropY;
  let x = px / m.clientWidth;
  const y = py / m.clientHeight;
  if (t.mirrored) x = 1 - x;
  return { x, y };
}

export function videoBoundsToDisplayBounds(
  b: NormBounds,
  m: VideoDisplayMetrics
): NormBounds {
  const a = videoNormToDisplayNorm({ x: b.xMin, y: b.yMin }, m);
  const c = videoNormToDisplayNorm({ x: b.xMax, y: b.yMax }, m);
  return {
    xMin: Math.min(a.x, c.x),
    xMax: Math.max(a.x, c.x),
    yMin: Math.min(a.y, c.y),
    yMax: Math.max(a.y, c.y),
  };
}

/** Point relative to face bounds (0–1 inside bounds). */
export function toFaceRelative(
  p: NormPoint,
  bounds: NormBounds
): NormPoint | null {
  const w = bounds.xMax - bounds.xMin;
  const h = bounds.yMax - bounds.yMin;
  if (w < 1e-6 || h < 1e-6) return null;
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
