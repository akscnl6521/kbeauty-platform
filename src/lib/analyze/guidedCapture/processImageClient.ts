/**
 * Browser-only image decode + EXIF strip + quality sample.
 * Not imported by Node selftests (uses Image/canvas).
 */

"use client";

import { stripImageExifBestEffort } from "@/lib/care/media/stripExif";
import { sampleImageStatsFromRgba } from "./qualityCheck";
import { bytesToBase64 } from "./sessionCleanup";
import { buildCapturedShot } from "./buildCapturedShot";
import type { CaptureAngle, CaptureInputSource, CapturedShot } from "./types";

function mimeFromFile(file: Blob, fallback = "image/jpeg"): string {
  if (file.type && file.type.startsWith("image/")) return file.type;
  return fallback;
}

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 불러오지 못했습니다."));
    };
    img.src = url;
  });
}

/**
 * Decode blob → strip JPEG EXIF → canvas sample → CapturedShot.
 * Preview uses a fresh object URL of stripped bytes when possible.
 */
export async function processImageBlobToShot(input: {
  blob: Blob;
  angle: CaptureAngle;
  inputSource: CaptureInputSource;
}): Promise<CapturedShot> {
  const mime = mimeFromFile(input.blob);
  const rawBytes = await blobToUint8Array(input.blob);
  const stripped = stripImageExifBestEffort(rawBytes, mime);
  const workBytes = new Uint8Array(stripped.bytes);
  const workBlob = new Blob([workBytes], {
    type: mime.startsWith("image/") ? mime : "image/jpeg",
  });

  const img = await loadImageFromBlob(workBlob);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  const canvas = document.createElement("canvas");
  const maxEdge = 640;
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1));
  const sw = Math.max(1, Math.round(width * scale));
  const sh = Math.max(1, Math.round(height * scale));
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("이미지 품질 검사를 준비하지 못했습니다.");
  }
  ctx.drawImage(img, 0, 0, sw, sh);
  const imageData = ctx.getImageData(0, 0, sw, sh);
  const stats = sampleImageStatsFromRgba(imageData.data, sw, sh, 3);

  const previewUrl = URL.createObjectURL(workBlob);
  const imageBase64 = bytesToBase64(stripped.bytes);

  return buildCapturedShot({
    angle: input.angle,
    previewUrl,
    usesObjectUrl: true,
    width,
    height,
    byteLength: stripped.bytes.byteLength,
    mimeType: mime,
    brightnessMean: stats.brightnessMean,
    sharpnessScore: stats.sharpnessScore,
    imageBase64,
    inputSource: input.inputSource,
    poseCheckStatus: "manual_guidance",
  });
}

export async function captureVideoFrameToShot(input: {
  video: HTMLVideoElement;
  angle: CaptureAngle;
  facingMode: "user" | "environment";
}): Promise<CapturedShot> {
  const video = input.video;
  const width = video.videoWidth || 0;
  const height = video.videoHeight || 0;
  if (width < 2 || height < 2) {
    throw new Error("카메라 프레임을 아직 준비하지 못했습니다.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("촬영에 실패했습니다.");

  // Mirror front camera for natural selfie preview parity with video CSS.
  if (input.facingMode === "user") {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("JPEG 인코딩에 실패했습니다."))),
      "image/jpeg",
      0.92
    );
  });

  return processImageBlobToShot({
    blob,
    angle: input.angle,
    inputSource: "camera",
  });
}
