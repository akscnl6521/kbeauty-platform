/**
 * Feature flags for Phase 3.1 landmark auto-capture + voice.
 * Not security boundaries.
 *
 * Default: landmark auto-capture OFF (manual 3-angle guide).
 * Set NEXT_PUBLIC_FACE_LANDMARK_AUTO_CAPTURE=1 to re-enable deferred auto path.
 */

export function isFaceLandmarkAutoCaptureEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  const raw = (env.NEXT_PUBLIC_FACE_LANDMARK_AUTO_CAPTURE ?? "0")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "on";
}

/**
 * Voice countdown only when landmark auto-capture is explicitly ON.
 * Manual capture path never uses speech countdown by default.
 */
export function isCaptureVoiceCountdownEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  if (!isFaceLandmarkAutoCaptureEnabled(env)) return false;
  const raw = (env.NEXT_PUBLIC_CAPTURE_VOICE_COUNTDOWN ?? "1")
    .trim()
    .toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

/** Local debug panel auto-open — only ?landmarkDebug=1 or explicit env. */
export function isLandmarkCaptureDebugEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  if (env.NEXT_PUBLIC_LANDMARK_CAPTURE_DEBUG === "1") return true;
  if (env.NEXT_PUBLIC_LANDMARK_CAPTURE_DEBUG === "0") return false;
  if (typeof window !== "undefined") {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("landmarkDebug") === "1") return true;
    } catch {
      // ignore
    }
  }
  return false;
}

export const FACE_LANDMARKER_WASM_PATH = "/mediapipe/wasm";
export const FACE_LANDMARKER_MODEL_PATH = "/models/face_landmarker.task";
export const LANDMARK_INFER_MAX_FPS = 12;
export const LANDMARK_SLOW_MS = 120;
