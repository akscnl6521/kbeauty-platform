/**
 * Lightweight live frame brightness/sharpness sample for alignment hints.
 * Never logs pixel buffers.
 */

"use client";

import { sampleImageStatsFromRgba } from "../qualityCheck";

export type LiveFrameQuality = {
  brightnessMean: number | null;
  sharpnessScore: number | null;
};

const SAMPLE_W = 64;
const SAMPLE_H = 80;

export function sampleLiveVideoQuality(
  video: HTMLVideoElement
): LiveFrameQuality {
  if (video.readyState < 2 || video.videoWidth < 2) {
    return { brightnessMean: null, sharpnessScore: null };
  }
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_W;
  canvas.height = SAMPLE_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { brightnessMean: null, sharpnessScore: null };
  try {
    ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
    const data = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
    const stats = sampleImageStatsFromRgba(
      data.data,
      SAMPLE_W,
      SAMPLE_H,
      2
    );
    return {
      brightnessMean: stats.brightnessMean,
      sharpnessScore: stats.sharpnessScore,
    };
  } catch {
    return { brightnessMean: null, sharpnessScore: null };
  }
}
