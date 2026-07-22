/**
 * Temporary preview URL cleanup — browser memory only.
 */

import type { CapturedShot } from "./types";

export function revokePreviewUrl(shot: CapturedShot | null | undefined): void {
  if (!shot?.usesObjectUrl || !shot.previewUrl) return;
  try {
    if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(shot.previewUrl);
    }
  } catch {
    // ignore
  }
}

export function revokeAllShotUrls(
  shots: Partial<Record<string, CapturedShot>>
): void {
  for (const shot of Object.values(shots)) {
    revokePreviewUrl(shot);
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
